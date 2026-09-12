import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  download: vi.fn(), move: vi.fn(), remove: vi.fn(), close: vi.fn(), read: vi.fn(), size: 1024,
}));
vi.mock("expo-crypto", () => ({ randomUUID: () => "unique" }));
vi.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "file:///cache/", downloadAsync: mocks.download, moveAsync: mocks.move, deleteAsync: mocks.remove,
}));
vi.mock("expo-file-system", () => ({
  FileMode: { ReadOnly: "r" },
  File: class {
    get size() { return mocks.size; }
    open() { return { readBytes: mocks.read, close: mocks.close }; }
  },
}));
import { downloadRemoteFile } from "./downloadRemoteFile";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.size = 1024;
  mocks.read.mockReturnValue(new TextEncoder().encode("%PDF-1.7"));
  mocks.remove.mockResolvedValue(undefined);
  mocks.download.mockResolvedValue({ status: 200, headers: { "Content-Type": "application/pdf" } });
});
it("validates the prefix, closes the handle and names the downloaded file before sharing", async () => {
  const result = await downloadRemoteFile("https://files.test/hash", "report");
  expect(result).toMatchObject({ uri: "file:///cache/unique-report.pdf", mimeType: "application/pdf" });
  expect(mocks.read).toHaveBeenCalledWith(512);
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.move).toHaveBeenCalledWith({ from: "file:///cache/unique-download", to: result.uri });
});
it.each([401,403,404,500])("rejects HTTP %i and deletes the failed download", async status => {
  mocks.download.mockResolvedValue({ status, headers: {} });
  await expect(downloadRemoteFile("https://files.test/file.pdf")).rejects.toThrow("HTTP " + status);
  expect(mocks.move).not.toHaveBeenCalled();
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("rejects an HTML login response even with HTTP 200", async () => {
  mocks.read.mockReturnValue(new TextEncoder().encode("<!doctype html><html>Login"));
  await expect(downloadRemoteFile("https://files.test/file.pdf")).rejects.toThrow("thay vì tệp");
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.move).not.toHaveBeenCalled();
});
it("rejects empty files and cleans up", async () => {
  mocks.size = 0;
  await expect(downloadRemoteFile("https://files.test/file.pdf")).rejects.toThrow("trống");
  expect(mocks.remove).toHaveBeenCalledOnce();
});
