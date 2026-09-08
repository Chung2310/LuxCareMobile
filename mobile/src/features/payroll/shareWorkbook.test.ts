import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  download: vi.fn(),
  available: vi.fn(),
  share: vi.fn(),
  write: vi.fn(),
  remove: vi.fn(),
  file: vi.fn(),
}));
vi.mock("../../api/services", () => ({ payroll: { downloadWorkbook: mocks.download } }));
vi.mock("expo-sharing", () => ({ isAvailableAsync: mocks.available, shareAsync: mocks.share }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "unique" }));
vi.mock("expo-file-system", () => ({
  Paths: { cache: "cache" },
  File: class {
    uri = "file:///cache/workbook.xlsx";
    exists = true;
    constructor(...args: unknown[]) {
      mocks.file(...args);
    }
    write = mocks.write;
    delete = mocks.remove;
  },
}));
import { shareWorkbook } from "./shareWorkbook";
import { createPayrollService } from "../../../../src/services/payrollService";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.available.mockResolvedValue(true);
  mocks.download.mockResolvedValue(new Uint8Array([1, 2]));
});
afterEach(() => vi.useRealTimers());
it("shares original workbook bytes and keeps the cache file for the receiving app", async () => {
  await shareWorkbook("run", "detailed", "2026/09", new AbortController().signal);
  expect(mocks.file).toHaveBeenCalledWith("cache", "unique-payroll-2026_09-detailed.xlsx");
  expect(mocks.write).toHaveBeenCalledWith(new Uint8Array([1, 2]));
  expect(mocks.share).toHaveBeenCalledWith(
    "file:///cache/workbook.xlsx",
    expect.objectContaining({
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      UTI: "org.openxmlformats.spreadsheetml.sheet",
    }),
  );
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("does not download if sharing is unavailable", async () => {
  mocks.available.mockResolvedValue(false);
  await expect(shareWorkbook("r", "detailed", "p", new AbortController().signal)).rejects.toThrow("chưa hỗ trợ");
  expect(mocks.download).not.toHaveBeenCalled();
});
it("cleans a cache file when canceled before handoff", async () => {
  const controller = new AbortController();
  mocks.write.mockImplementation(() => controller.abort());
  await expect(shareWorkbook("r", "detailed", "p", controller.signal)).rejects.toThrow("Đã dừng");
  expect(mocks.remove).toHaveBeenCalledOnce();
  expect(mocks.share).not.toHaveBeenCalled();
});
it("times out while waiting for the document body", async () => {
  vi.useFakeTimers();
  mocks.download.mockImplementation(
    (_r, _e, signal) =>
      new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("timeout")))),
  );
  const result = expect(shareWorkbook("r", "detailed", "p", new AbortController().signal)).rejects.toThrow("timeout");
  await vi.advanceTimersByTimeAsync(120000);
  await result;
  expect(mocks.share).not.toHaveBeenCalled();
});
it("downloads through authenticated export endpoint with encoded identifiers", async () => {
  const fetch = vi.fn().mockResolvedValue(
    new Response(new Uint8Array([80, 75, 3, 4, 255, 0]), {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet; charset=utf-8" },
    }),
  );
  const signal = new AbortController().signal;
  const bytes = await createPayrollService({ fetch, getAccessToken: () => "token" }).downloadWorkbook(
    "r/1",
    "pit",
    signal,
  );
  expect(bytes).toEqual(new Uint8Array([80, 75, 3, 4, 255, 0]));
  expect(fetch).toHaveBeenCalledWith("/api/v1/payroll/runs/r%2F1/exports", {
    method: "POST",
    body: JSON.stringify({ type: "pit" }),
    headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
    signal,
  });
});
it.each([403, 404, 409])("preserves API refusal %s instead of exporting cached data", async (status) => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "PAYROLL_RUN_NOT_CLOSED" }), { status }));
  await expect(
    createPayrollService({ fetch, getAccessToken: () => "t" }).downloadWorkbook("r", "detailed"),
  ).rejects.toMatchObject({ status, code: "PAYROLL_RUN_NOT_CLOSED" });
});
it.each([
  new Response("{}", { headers: { "Content-Type": "application/json" } }),
  new Response("", {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  }),
  new Response("html", {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Length": "20971521",
    },
  }),
  new Response("x".repeat(20971521), {
    headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  }),
])("rejects invalid, empty or oversized documents", async (response) => {
  const fetch = vi.fn().mockResolvedValue(response);
  await expect(
    createPayrollService({ fetch, getAccessToken: () => "t" }).downloadWorkbook("r", "detailed"),
  ).rejects.toThrow();
});
