import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  available: vi.fn(),
  share: vi.fn(),
  write: vi.fn(),
  file: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("../api/services", () => ({ api: { transport: { fetch: mocks.fetch } } }));
vi.mock("expo-sharing", () => ({ isAvailableAsync: mocks.available, shareAsync: mocks.share }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "unique" }));
vi.mock("expo-file-system", () => ({
  Paths: { cache: { uri: "file:///cache/" } },
  File: class {
    uri = "file:///cache/file.pdf";
    exists = true;
    constructor(...args: unknown[]) {
      mocks.file(...args);
    }
    write = mocks.write;
    delete = mocks.remove;
  },
}));
import { shareApiFile, MAX_SHARED_FILE_BYTES } from "./shareFile";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.available.mockResolvedValue(true);
  mocks.fetch.mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
});
afterEach(() => vi.useRealTimers());
it("keeps the timeout active while reading the body", async () => {
  vi.useFakeTimers();
  mocks.fetch.mockImplementation(async (_url, init) => ({
    headers: new Headers(),
    arrayBuffer: () =>
      new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("timeout")))),
  }));
  const result = expect(shareApiFile("https://res.cloudinary.com/f", "f")).rejects.toThrow("timeout");
  await vi.advanceTimersByTimeAsync(120000);
  await result;
  expect(mocks.share).not.toHaveBeenCalled();
});
it("removes a cache file if cancellation occurs before handing it to another app", async () => {
  const controller = new AbortController();
  mocks.write.mockImplementation(() => controller.abort());
  await expect(shareApiFile("https://res.cloudinary.com/f", "f", controller.signal)).rejects.toThrow("Đã dừng");
  expect(mocks.remove).toHaveBeenCalledOnce();
  expect(mocks.share).not.toHaveBeenCalled();
});
it("uses the authenticated proxy and a sanitized local file, retaining it for the recipient", async () => {
  await shareApiFile("https://res.cloudinary.com/doc?a=1&b=2", "../Hợp đồng.pdf");
  expect(mocks.fetch.mock.calls[0][0]).toBe(
    "/api/v1/media/download?url=https%3A%2F%2Fres.cloudinary.com%2Fdoc%3Fa%3D1%26b%3D2&filename=..%2FH%E1%BB%A3p%20%C4%91%E1%BB%93ng.pdf",
  );
  expect(mocks.file).toHaveBeenCalledWith({ uri: "file:///cache/" }, "unique-.._Hợp_đồng.pdf");
  expect(mocks.share).toHaveBeenCalledWith("file:///cache/file.pdf", { dialogTitle: "../Hợp đồng.pdf" });
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("rejects invalid schemes and credentials before downloading", async () => {
  for (const url of ["file:///private", "javascript:alert(1)", "https://user:pass@example.com/file"])
    await expect(shareApiFile(url, "f")).rejects.toThrow();
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("rejects an oversized declared response before reading its body", async () => {
  const read = vi.fn();
  mocks.fetch.mockResolvedValue({
    headers: new Headers({ "content-length": String(MAX_SHARED_FILE_BYTES + 1) }),
    arrayBuffer: read,
  });
  await expect(shareApiFile("https://res.cloudinary.com/f", "f")).rejects.toThrow("20 MB");
  expect(read).not.toHaveBeenCalled();
});
it("rejects empty or oversized actual content even without content-length", async () => {
  for (const size of [0, MAX_SHARED_FILE_BYTES + 1]) {
    mocks.fetch.mockResolvedValue(new Response(new Uint8Array(size)));
    await expect(shareApiFile("https://res.cloudinary.com/f", "f")).rejects.toThrow("20 MB");
  }
  expect(mocks.write).not.toHaveBeenCalled();
});
it("does not share when the screen is left during body download", async () => {
  const controller = new AbortController();
  mocks.fetch.mockResolvedValue({
    headers: new Headers(),
    arrayBuffer: async () => {
      controller.abort();
      return new Uint8Array([1]).buffer;
    },
  });
  await expect(shareApiFile("https://res.cloudinary.com/f", "f", controller.signal)).rejects.toThrow("Đã dừng");
  expect(mocks.share).not.toHaveBeenCalled();
  expect(mocks.write).not.toHaveBeenCalled();
});
it("does not download if sharing is unavailable or the request is already cancelled", async () => {
  mocks.available.mockResolvedValue(false);
  await expect(shareApiFile("https://res.cloudinary.com/f", "f")).rejects.toThrow("chưa hỗ trợ");
  const controller = new AbortController();
  controller.abort();
  await expect(shareApiFile("https://res.cloudinary.com/f", "f", controller.signal)).rejects.toThrow("Đã dừng");
  expect(mocks.fetch).not.toHaveBeenCalled();
});
it("does not write or share after an API access error", async () => {
  mocks.fetch.mockRejectedValue(new Error("Không có quyền"));
  await expect(shareApiFile("https://res.cloudinary.com/f", "f")).rejects.toThrow("Không có quyền");
  expect(mocks.write).not.toHaveBeenCalled();
  expect(mocks.share).not.toHaveBeenCalled();
});
