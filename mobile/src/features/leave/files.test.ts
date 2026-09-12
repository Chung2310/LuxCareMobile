import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  pick: vi.fn(),
  upload: vi.fn(),
  fetch: vi.fn(),
  share: vi.fn(),
  remove: vi.fn(),
  base64: vi.fn(),
  legacyReadAsString: vi.fn(),
  size: 4,
}));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: mocks.pick }));
vi.mock("expo-file-system", () => ({
  Paths: { cache: { uri: "file:///cache/" } },
  File: class {
    exists = true;
    get size() {
      return mocks.size;
    }
    uri = "file:///cache/download.pdf";
    base64 = mocks.base64;
    delete = mocks.remove;
    write = vi.fn();
  },
}));
vi.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: mocks.legacyReadAsString,
  copyAsync: vi.fn(),
  deleteAsync: vi.fn(),
  cacheDirectory: "file:///cache/",
  EncodingType: { Base64: "base64" },
}));
vi.mock("expo-sharing", () => ({ isAvailableAsync: async () => true, shareAsync: mocks.share }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "unique" }));
vi.mock("../../api/services", () => ({ api: { transport: { fetch: mocks.fetch } }, leave: { upload: mocks.upload } }));
import { MAX_LEAVE_FILE_BYTES, pickLeaveAttachment, shareLeaveFile } from "./files";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.size = 4;
  mocks.base64.mockResolvedValue("dGVzdA==");
  mocks.pick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///cache/picker.pdf", name: "proof.pdf", mimeType: "application/pdf" }],
  });
  mocks.upload.mockResolvedValue({ url: "https://example.com/proof.pdf", uploadToken: "owned-token" });
});
it("preserves upload ownership metadata and removes only the picker cache copy", async () => {
  const result = await pickLeaveAttachment();
  expect(result).toMatchObject({ uploadToken: "owned-token", name: "proof.pdf", size: 4, mimeType: "application/pdf" });
  expect(mocks.upload).toHaveBeenCalledWith({
    file: "data:application/pdf;base64,dGVzdA==",
    fileName: "proof.pdf",
    size: 4,
    mimeType: "application/pdf",
  });
  expect(mocks.remove).toHaveBeenCalledTimes(1);
});
it("rejects oversized files before reading/uploading", async () => {
  mocks.size = MAX_LEAVE_FILE_BYTES + 1;
  await expect(pickLeaveAttachment()).rejects.toThrow("20 MB");
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("does not delete a picked file outside app cache", async () => {
  mocks.pick.mockResolvedValue({
    canceled: false,
    assets: [{ uri: "content://documents/original", name: "proof.pdf" }],
  });
  await pickLeaveAttachment();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("cancelling the picker does not upload", async () => {
  mocks.pick.mockResolvedValue({ canceled: true });
  await expect(pickLeaveAttachment()).resolves.toBeNull();
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("does not lose the upload token if cache cleanup fails", async () => {
  mocks.remove.mockImplementationOnce(() => {
    throw new Error("File locked");
  });
  await expect(pickLeaveAttachment()).resolves.toMatchObject({ uploadToken: "owned-token" });
});
it("recovers from FileSystemFile.base64 Missing READ permission error via fallback", async () => {
  mocks.base64.mockRejectedValue(
    new Error("Call to function 'FileSystemFile.base64' has been rejected. Missing 'READ' permission for accessing the file."),
  );
  mocks.legacyReadAsString.mockResolvedValue("dGVzdEZhbGxiYWNr");

  const result = await pickLeaveAttachment();
  expect(result).toMatchObject({ uploadToken: "owned-token", name: "proof.pdf" });
  expect(mocks.upload).toHaveBeenCalledWith(
    expect.objectContaining({
      file: "data:application/pdf;base64,dGVzdEZhbGxiYWNr",
    }),
  );
});
it("downloads through the authenticated API client without putting a token in the URL", async () => {
  mocks.fetch.mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));
  await shareLeaveFile("https://example.com/proof.pdf", "proof.pdf");
  expect(mocks.fetch.mock.calls[0][0]).toBe(
    "/api/v1/media/download?url=https%3A%2F%2Fexample.com%2Fproof.pdf&filename=proof.pdf",
  );
  expect(mocks.share).toHaveBeenCalledTimes(1);
});

