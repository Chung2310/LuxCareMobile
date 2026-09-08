import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  available: vi.fn(),
  share: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
  file: vi.fn(),
}));
vi.mock("../../api/services", () => ({ payroll: { downloadPayslip: mocks.download } }));
vi.mock("expo-sharing", () => ({ isAvailableAsync: mocks.available, shareAsync: mocks.share }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "unique" }));
vi.mock("expo-file-system", () => ({
  Paths: { cache: "cache" },
  File: class {
    uri = "file:///cache/payslip.html";
    exists = true;
    constructor(...args: unknown[]) {
      mocks.file(...args);
    }
    write = mocks.write;
    delete = mocks.remove;
  },
}));
import { sharePayslip } from "./sharePayslip";
import { createPayrollService } from "../../../../src/services/payrollService";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.available.mockResolvedValue(true);
  mocks.download.mockResolvedValue(new Uint8Array([1, 2]));
});
afterEach(() => vi.useRealTimers());
it("shares original bytes as HTML and keeps the cache file for the receiving app", async () => {
  await sharePayslip("run", "employee", "2026/09", new AbortController().signal);
  expect(mocks.file).toHaveBeenCalledWith("cache", "unique-phieu-luong-2026_09.html");
  expect(mocks.write).toHaveBeenCalledWith(new Uint8Array([1, 2]));
  expect(mocks.share).toHaveBeenCalledWith(
    "file:///cache/payslip.html",
    expect.objectContaining({ mimeType: "text/html", UTI: "public.html" }),
  );
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("does not download if sharing is unavailable", async () => {
  mocks.available.mockResolvedValue(false);
  await expect(sharePayslip("r", "e", "p", new AbortController().signal)).rejects.toThrow("chưa hỗ trợ");
  expect(mocks.download).not.toHaveBeenCalled();
});
it("cleans a cache file when canceled before handoff", async () => {
  const controller = new AbortController();
  mocks.write.mockImplementation(() => controller.abort());
  await expect(sharePayslip("r", "e", "p", controller.signal)).rejects.toThrow("Đã dừng");
  expect(mocks.remove).toHaveBeenCalledOnce();
  expect(mocks.share).not.toHaveBeenCalled();
});
it("times out while waiting for the document body", async () => {
  vi.useFakeTimers();
  mocks.download.mockImplementation(
    (_r, _e, signal) =>
      new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("timeout")))),
  );
  const result = expect(sharePayslip("r", "e", "p", new AbortController().signal)).rejects.toThrow("timeout");
  await vi.advanceTimersByTimeAsync(120000);
  await result;
  expect(mocks.share).not.toHaveBeenCalled();
});
it("downloads through authenticated print endpoint with encoded identifiers", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response("<html>salary</html>", { headers: { "Content-Type": "text/html; charset=utf-8" } }),
    );
  const signal = new AbortController().signal;
  const bytes = await createPayrollService({ fetch, getAccessToken: () => "token" }).downloadPayslip(
    "r/1",
    "e?2",
    signal,
  );
  expect(new TextDecoder().decode(bytes)).toBe("<html>salary</html>");
  expect(fetch).toHaveBeenCalledWith("/api/v1/payroll/runs/r%2F1/payslips/e%3F2/print", {
    headers: { Authorization: "Bearer token" },
    signal,
  });
});
it.each([403, 404, 409])("preserves API refusal %s instead of exporting cached data", async (status) => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "PAYSLIP_NOT_PUBLISHED" }), { status }));
  await expect(
    createPayrollService({ fetch, getAccessToken: () => "t" }).downloadPayslip("r", "e"),
  ).rejects.toMatchObject({ status, code: "PAYSLIP_NOT_PUBLISHED" });
});
it.each([
  new Response("{}", { headers: { "Content-Type": "application/json" } }),
  new Response("", { headers: { "Content-Type": "text/html" } }),
  new Response("html", { headers: { "Content-Type": "text/html", "Content-Length": "2097153" } }),
  new Response("x".repeat(2097153), { headers: { "Content-Type": "text/html" } }),
])("rejects invalid, empty or oversized documents", async (response) => {
  const fetch = vi.fn().mockResolvedValue(response);
  await expect(createPayrollService({ fetch, getAccessToken: () => "t" }).downloadPayslip("r", "e")).rejects.toThrow();
});
