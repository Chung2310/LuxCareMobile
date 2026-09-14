import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  available: vi.fn(),
  share: vi.fn(),
  write: vi.fn(),
  file: vi.fn(),
  remove: vi.fn(),
  legacyWrite: vi.fn(),
  pickDirectory: vi.fn(),
  createFile: vi.fn(),
  list: vi.fn(),
  savedWrite: vi.fn(),
  savedRemove: vi.fn(),
}));
vi.mock("../api/services", () => ({ api: { getOrigin: () => "https://example.com", transport: { fetch: mocks.fetch } } }));
vi.mock("expo-sharing", () => ({ isAvailableAsync: mocks.available, shareAsync: mocks.share }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "unique" }));
vi.mock("expo-file-system", () => ({
  Directory: { pickDirectoryAsync: mocks.pickDirectory },
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
vi.mock("expo-file-system/legacy", () => ({ writeAsStringAsync: mocks.legacyWrite }));
import { shareApiFile, downloadApiFile, MAX_SHARED_FILE_BYTES } from "./shareFile";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.available.mockResolvedValue(true);
  mocks.list.mockReturnValue([]);
  mocks.pickDirectory.mockResolvedValue({ list: mocks.list, createFile: mocks.createFile });
  mocks.createFile.mockReturnValue({ uri: "content://downloads/report.pdf", exists: true, write: mocks.savedWrite, delete: mocks.savedRemove });
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("direct request unavailable")));
  mocks.fetch.mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
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
  expect(mocks.file).toHaveBeenCalledWith({ uri: "file:///cache/" }, "unique-Hợp_đồng.pdf");
  expect(mocks.share).toHaveBeenCalledWith("file:///cache/file.pdf", { dialogTitle: "Hợp_đồng.pdf", mimeType: "application/pdf" });
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
it("resolves relative URLs to full origin URLs before downloading", async () => {
  await shareApiFile("/uploads/bieu-mau.docx", "bieu-mau.docx");
  expect(mocks.fetch.mock.calls[0][0]).toContain("/api/v1/media/download?url=https%3A%2F%2Fexample.com%2Fuploads%2Fbieu-mau.docx");
  expect(mocks.share).toHaveBeenCalledOnce();
});


it("keeps binary bytes exact when native write falls back to Base64", async () => {
  const bytes = new Uint8Array([0,255,128,13,10,80,75]);
  mocks.fetch.mockResolvedValue(new Response(bytes));
  mocks.write.mockImplementation(() => { throw new Error("native write failed"); });
  vi.stubGlobal("btoa", undefined);
  await shareApiFile("https://files.test/report.xlsx", "report.xlsx");
  expect(mocks.legacyWrite).toHaveBeenCalledWith("file:///cache/file.pdf", Buffer.from(bytes).toString("base64"), { encoding: "base64" });
  expect(mocks.share).toHaveBeenCalledWith("file:///cache/file.pdf", expect.objectContaining({ mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
});
it("rejects HTTP 200 HTML instead of sharing it as a PDF", async () => {
  mocks.fetch.mockResolvedValue(new Response("<html>Login</html>", { headers: { "content-type": "text/html" } }));
  await expect(shareApiFile("https://files.test/report.pdf", "report.pdf")).rejects.toThrow("thay vì tệp");
  expect(mocks.write).not.toHaveBeenCalled();
  expect(mocks.share).not.toHaveBeenCalled();
});
it("does not retry an authorization failure as a public download", async () => {
  mocks.fetch.mockResolvedValue(new Response("denied", { status: 403 }));
  await expect(shareApiFile("https://files.test/report.pdf", "report.pdf")).rejects.toThrow("403");
  expect(fetch).not.toHaveBeenCalled();
});
it("adds a missing extension from server metadata and shares the right MIME", async () => {
  mocks.fetch.mockResolvedValue(new Response(new Uint8Array([1,2,3]), { headers: { "content-type": "application/pdf", "content-disposition": "attachment; filename=report.pdf" } }));
  await shareApiFile("https://files.test/hash", "report");
  expect(mocks.file).toHaveBeenCalledWith({ uri: "file:///cache/" }, "unique-report.pdf");
  expect(mocks.share).toHaveBeenCalledWith("file:///cache/file.pdf", { dialogTitle: "report.pdf", mimeType: "application/pdf" });
});

it("downloads to the selected folder without checking or opening sharing", async () => {
  mocks.available.mockResolvedValue(false);
  const bytes = new Uint8Array([37,80,68,70,45]);
  mocks.fetch.mockResolvedValue(new Response(bytes, { headers: { "content-type": "application/pdf" } }));
  await expect(downloadApiFile("https://files.test/report.pdf", "report.pdf")).resolves.toEqual({ name: "report.pdf", uri: "content://downloads/report.pdf" });
  expect(mocks.createFile).toHaveBeenCalledWith("report.pdf", "application/pdf");
  expect(mocks.savedWrite).toHaveBeenCalledWith(bytes);
  expect(mocks.share).not.toHaveBeenCalled();
  expect(mocks.available).not.toHaveBeenCalled();
  expect(mocks.savedRemove).not.toHaveBeenCalled();
});
it("does not overwrite existing downloads and preserves the extension", async () => {
  mocks.list.mockReturnValue([{ name: "report.pdf" }, { name: "REPORT (1).PDF" }]);
  await expect(downloadApiFile("https://files.test/report.pdf", "report.pdf")).resolves.toMatchObject({ name: "report (2).pdf" });
  expect(mocks.createFile).toHaveBeenCalledWith("report (2).pdf", "application/pdf");
});
it.each(["ERR_FILE_PICKING_CANCELLED", "ERR_PICKER_CANCELLED"])("treats %s as cancellation, not a successful save", async code => {
  mocks.pickDirectory.mockRejectedValue(Object.assign(new Error("cancelled"), { code }));
  await expect(downloadApiFile("https://files.test/report.pdf", "report.pdf")).resolves.toBeUndefined();
  expect(mocks.createFile).not.toHaveBeenCalled();
  expect(mocks.share).not.toHaveBeenCalled();
});
it("does not time out while the user selects a save folder", async () => {
  vi.useFakeTimers();
  mocks.pickDirectory.mockImplementation(async () => {
    await vi.advanceTimersByTimeAsync(120001);
    return { list: mocks.list, createFile: mocks.createFile };
  });
  await expect(downloadApiFile("https://files.test/report.pdf", "report.pdf")).resolves.toHaveProperty("uri");
  expect(vi.getTimerCount()).toBe(0);
});
it("cleans up a failed save instead of reporting success or opening sharing", async () => {
  mocks.savedWrite.mockImplementation(() => { throw new Error("disk full"); });
  mocks.legacyWrite.mockRejectedValue(new Error("disk full"));
  await expect(downloadApiFile("https://files.test/report.pdf", "report.pdf")).rejects.toThrow("Không thể lưu");
  expect(mocks.savedRemove).toHaveBeenCalledOnce();
  expect(mocks.share).not.toHaveBeenCalled();
});
it("still opens sharing when explicitly sharing a file", async () => {
  await shareApiFile("https://files.test/report.pdf", "report.pdf");
  expect(mocks.share).toHaveBeenCalledOnce();
  expect(mocks.pickDirectory).not.toHaveBeenCalled();
});

it.each([
  { code: "ERR_SHARING_CANCELED" },
  { code: "ERR_SHARING_CANCELLED" },
  { name: "AbortError", message: "The user aborted a request." },
  { domain: "NSCocoaErrorDomain", code: 3072 },
  { message: "The user cancelled the sharing dialog." },
])("treats native share dismissal as cancellation: %j", async cancellation => {
  mocks.share.mockRejectedValueOnce(cancellation);
  await expect(shareApiFile("https://files.test/template.pdf", "template.pdf")).resolves.toBeUndefined();
  expect(mocks.remove).not.toHaveBeenCalled();
  // The next user-initiated share is still available.
  mocks.fetch.mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
  await shareApiFile("https://files.test/template.pdf", "template.pdf");
  expect(mocks.share).toHaveBeenCalledTimes(2);
});

it("still reports genuine native sharing failures", async () => {
  mocks.share.mockRejectedValueOnce(Object.assign(new Error("Cannot open the activity"), { code: "ERR_SHARING_FAILED" }));
  await expect(shareApiFile("https://files.test/template.pdf", "template.pdf")).rejects.toThrow("Cannot open the activity");
});

it("does not suppress AbortError while downloading", async () => {
  mocks.fetch.mockRejectedValueOnce(Object.assign(new Error("Download aborted"), { name: "AbortError" }));
  await expect(shareApiFile("https://files.test/template.pdf", "template.pdf")).rejects.toThrow("Download aborted");
  expect(mocks.share).not.toHaveBeenCalled();
});

it("does not time out while the user leaves the share sheet open and then returns", async () => {
  vi.useFakeTimers();
  let dismiss!: () => void;
  mocks.share.mockImplementationOnce(() => new Promise<void>(resolve => { dismiss = resolve; }));
  const sharing = shareApiFile("https://files.test/template.pdf", "template.pdf");
  await vi.advanceTimersByTimeAsync(0);
  expect(mocks.share).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(180000);
  dismiss();
  await expect(sharing).resolves.toBeUndefined();
});
