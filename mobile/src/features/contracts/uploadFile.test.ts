import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ pick: vi.fn(), upload: vi.fn(), remove: vi.fn(), base64: vi.fn(), size: 10 }));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: mocks.pick }));
vi.mock("expo-file-system", () => ({
  Paths: { cache: { uri: "file:///cache/" } },
  File: class {
    exists = true;
    get size() {
      return mocks.size;
    }
    base64 = mocks.base64;
    delete = mocks.remove;
  },
}));
vi.mock("../../api/services", () => ({ contracts: { upload: mocks.upload } }));
import { pickContractFile } from "./uploadFile";
import { contractFileMime, contractUploadFields } from "./uploadModel";
const scope = { companyCode: "COMP", branchId: "branch" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.size = 10;
  mocks.base64.mockResolvedValue("dGVzdA==");
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/doc.pdf", name: "doc.pdf" }] });
  mocks.upload.mockResolvedValue({ url: "https://files.example/doc", uploadToken: "token" });
});
it("uploads the cache copy with scope, data URL and ownership token", async () => {
  const file = await pickContractFile(scope, "contract");
  expect(mocks.upload).toHaveBeenCalledWith(scope, {
    file: "data:application/pdf;base64,dGVzdA==",
    name: "doc.pdf",
    mimeType: "application/pdf",
    size: 10,
    kind: "contract",
  });
  expect(file).toMatchObject({ uploadToken: "token", size: 10 });
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("does not upload after picker cancellation", async () => {
  mocks.pick.mockResolvedValue({ canceled: true });
  expect(await pickContractFile(scope, "extension")).toBeNull();
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("validates actual size before base64 allocation and upload", async () => {
  mocks.size = 10485761;
  await expect(pickContractFile(scope, "contract")).rejects.toThrow("10 MB");
  expect(mocks.base64).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("rejects non-images for signed slots and unsupported documents", () => {
  expect(() => contractFileMime("doc.pdf", 10, "signed")).toThrow();
  expect(() => contractFileMime("x.exe", 10, "contract")).toThrow();
  expect(contractFileMime("scan.JPG", 10, "extensionSigned")).toBe("image/jpeg");
});
it("maps each token to its backend field without sending arrays or resource IDs", () => {
  const file = { url: "url", uploadToken: "token", name: "file", mimeType: "mime", size: 10 };
  for (const [kind, prefix, token] of [
    ["contract", "contractFile", "contractFileUploadToken"],
    ["signed", "signedImage", "signedImageUploadToken"],
    ["extension", "extensionFile", "extensionFileUploadToken"],
    ["extensionSigned", "signedImage", "extensionSignedImageUploadToken"],
  ]) {
    expect(contractUploadFields({ [kind]: file })).toEqual({
      [`${prefix}Url`]: "url",
      [`${prefix}Name`]: "file",
      [`${prefix}MimeType`]: "mime",
      [`${prefix}Size`]: 10,
      [token]: "token",
    });
  }
  expect(contractUploadFields({})).toEqual({});
});
it("rejects an incomplete server response and preserves original files outside cache", async () => {
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "content://original", name: "doc.pdf" }] });
  mocks.upload.mockResolvedValue({ url: "url" });
  await expect(pickContractFile(scope, "contract")).rejects.toThrow("Chưa xác nhận");
  expect(mocks.remove).not.toHaveBeenCalled();
});
