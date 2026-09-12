import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fileBase64: vi.fn(),
  legacyReadAsString: vi.fn(),
  copyAsync: vi.fn(),
  deleteAsync: vi.fn(),
}));

vi.mock("expo-file-system", () => ({
  Paths: { cache: { uri: "file:///cache/" } },
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    base64 = mocks.fileBase64;
  },
}));

vi.mock("expo-file-system/legacy", () => ({
  readAsStringAsync: mocks.legacyReadAsString,
  copyAsync: mocks.copyAsync,
  deleteAsync: mocks.deleteAsync,
  cacheDirectory: "file:///cache/",
  EncodingType: { Base64: "base64" },
}));

import { readPickedFileAsBase64 } from "./readBase64";

beforeEach(() => {
  vi.resetAllMocks();
});

it("reads via new File(uri).base64() when available", async () => {
  mocks.fileBase64.mockResolvedValue("dGVzdA==");
  const result = await readPickedFileAsBase64("file:///data/test.pdf");
  expect(result).toBe("dGVzdA==");
  expect(mocks.fileBase64).toHaveBeenCalledOnce();
  expect(mocks.legacyReadAsString).not.toHaveBeenCalled();
});

it("falls back to legacy FileSystem.readAsStringAsync when native File base64 rejects with permission error", async () => {
  mocks.fileBase64.mockRejectedValue(
    new Error("Call to function 'FileSystemFile.base64' has been rejected. Missing 'READ' permission for accessing the file."),
  );
  mocks.legacyReadAsString.mockResolvedValue("ZmFsbGJhY2s=");

  const result = await readPickedFileAsBase64("content://com.android.providers/test.pdf");
  expect(result).toBe("ZmFsbGJhY2s=");
  expect(mocks.legacyReadAsString).toHaveBeenCalledWith(
    "content://com.android.providers/test.pdf",
    expect.objectContaining({ encoding: "base64" }),
  );
});

it("falls back to copyAsync into app cache if direct read methods fail", async () => {
  mocks.fileBase64.mockRejectedValue(new Error("Permission denied"));
  mocks.legacyReadAsString
    .mockRejectedValueOnce(new Error("Cannot read content URI directly"))
    .mockResolvedValueOnce("Y29waWVk");
  mocks.copyAsync.mockResolvedValue(undefined);
  mocks.deleteAsync.mockResolvedValue(undefined);

  const result = await readPickedFileAsBase64("file:///storage/emulated/0/Download/doc.pdf", "doc.pdf");
  expect(result).toBe("Y29waWVk");
  expect(mocks.copyAsync).toHaveBeenCalledOnce();
  expect(mocks.deleteAsync).toHaveBeenCalledOnce();
});

it("throws descriptive error when all fallback strategies fail", async () => {
  mocks.fileBase64.mockRejectedValue(new Error("native failed"));
  mocks.legacyReadAsString.mockRejectedValue(new Error("legacy failed"));
  mocks.copyAsync.mockRejectedValue(new Error("copy failed"));

  await expect(readPickedFileAsBase64("invalid://uri", "test.pdf")).rejects.toThrow(
    "Không thể đọc nội dung tệp đính kèm",
  );
});
