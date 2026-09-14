import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ pick: vi.fn(), upload: vi.fn(), remove: vi.fn(), base64: vi.fn(), size: 10, camera: vi.fn(), legacyRead: vi.fn() }));
vi.mock("../../files/captureDocumentPhoto", () => ({ captureDocumentPhoto: mocks.camera }));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: mocks.pick }));
vi.mock("expo-file-system/legacy", () => ({ readAsStringAsync: mocks.legacyRead, EncodingType: { Base64: "base64" } }));
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

it.each(["contract", "signed", "extension", "extensionSigned"] as const)("uploads a camera photo for %s", async kind => {
  const photo = { file: "data:image/jpeg;base64,dGVzdA==", name: "photo.jpg", mimeType: "image/jpeg", size: 4 };
  mocks.camera.mockResolvedValue(photo);
  expect(await pickContractFile(scope, kind, "camera")).toMatchObject({ uploadToken: "token", name: "photo.jpg" });
  expect(mocks.upload).toHaveBeenCalledWith(scope, { ...photo, kind });
  expect(mocks.pick).not.toHaveBeenCalled();
});
it("does not upload a canceled camera photo", async () => {
  mocks.camera.mockResolvedValue(null);
  expect(await pickContractFile(scope, "signed", "camera")).toBeNull();
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("reports the selected filename while reading and uploading", async () => {
  const onProgress = vi.fn();
  mocks.base64.mockImplementation(async () => {
    expect(onProgress).toHaveBeenLastCalledWith({ stage: "preparing", name: "doc.pdf" });
    return "dGVzdA==";
  });
  mocks.upload.mockImplementation(async () => {
    expect(onProgress).toHaveBeenLastCalledWith({ stage: "uploading", name: "doc.pdf" });
    return { url: "url", uploadToken: "token" };
  });
  await pickContractFile(scope, "contract", "file", onProgress);
  expect(onProgress).toHaveBeenCalledTimes(2);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const extensionCases = [["extension","pdf","application/pdf"],["extension","doc","application/msword"],["extension","docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document"],["extension","xls","application/vnd.ms-excel"],["extension","xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],["extensionSigned","pdf","application/pdf"],["extensionSigned","doc","application/msword"],["extensionSigned","docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document"],["extensionSigned","xls","application/vnd.ms-excel"],["extensionSigned","xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]] as const;

it.each(extensionCases)("uploads %s %s on device", async (kind, ext, mimeType) => {
  const name = "appendix." + ext.toUpperCase();
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/appendix", name }] });
  const result = await pickContractFile(scope, kind);
  expect(mocks.pick.mock.calls[0][0].type).toContain(mimeType);
  expect(mocks.upload).toHaveBeenCalledWith(scope, { file: "data:" + mimeType + ";base64,dGVzdA==", name, mimeType, size: 10, kind });
  expect(result).toMatchObject({ name, mimeType, uploadToken: "token" });
});
it.each(extensionCases)("uploads %s %s in the browser", async (kind, ext, mimeType) => {
  const name = "appendix." + ext;
  const browserFile = new globalThis.File(["test"], name, { type: mimeType });
  vi.stubGlobal("FileReader", class {
    result = "data:" + mimeType + ";base64,dGVzdA==";
    readAsDataURL() { (this as any).onload(); }
  });
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "blob:appendix", name, file: browserFile, size: 999 }] });
  await pickContractFile(scope, kind);
  expect(mocks.upload).toHaveBeenCalledWith(scope, { file: "data:" + mimeType + ";base64,dGVzdA==", name, mimeType, size: 4, kind });
  expect(mocks.base64).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(revoke).toHaveBeenCalledWith("blob:appendix");
});
it("rejects oversized browser appendices before reading", async () => {
  const read = vi.fn();
  vi.stubGlobal("FileReader", class { readAsDataURL = read; });
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "blob:large", name: "appendix.pdf", file: { size: 10485761 } }] });
  await expect(pickContractFile(scope, "extensionSigned")).rejects.toThrow("10 MB");
  expect(read).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(revoke).toHaveBeenCalledWith("blob:large");
});
it("reports browser read failures without uploading", async () => {
  vi.stubGlobal("FileReader", class { readAsDataURL() { (this as any).onerror(); } });
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "blob:bad", name: "appendix.pdf", file: { size: 4 } }] });
  await expect(pickContractFile(scope, "extension")).rejects.toThrow("Vui lòng chọn lại");
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(revoke).toHaveBeenCalledWith("blob:bad");
});

it("uploads through the legacy reader when FileSystemFile.base64 is rejected", async () => {
  mocks.base64.mockRejectedValue(new Error('Call to function "FileSystemFile.base64" has been rejected'));
  mocks.legacyRead.mockResolvedValue("dGVzdA==");
  const progress = vi.fn();
  const result = await pickContractFile(scope, "contract", "file", progress);
  expect(result).toMatchObject({ uploadToken: "token", name: "doc.pdf" });
  expect(mocks.legacyRead).toHaveBeenCalledWith("file:///cache/doc.pdf", { encoding: "base64" });
  expect(mocks.upload).toHaveBeenCalledOnce();
  expect(mocks.upload.mock.calls[0][1].file).toBe("data:application/pdf;base64,dGVzdA==");
  expect(progress).toHaveBeenLastCalledWith({ stage: "uploading", name: "doc.pdf" });
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("does not open the picker after cancellation", async () => {
  const controller = new AbortController();
  controller.abort();
  expect(await pickContractFile(scope, "extension", "file", undefined, controller.signal)).toBeNull();
  expect(mocks.pick).not.toHaveBeenCalled();
});
it("does not upload after the screen closes while reading a file", async () => {
  const controller = new AbortController();
  mocks.base64.mockImplementation(async () => { controller.abort(); return "dGVzdA=="; });
  expect(await pickContractFile(scope, "extensionSigned", "file", undefined, controller.signal)).toBeNull();
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("does not upload a camera result after cancellation", async () => {
  const controller = new AbortController();
  mocks.camera.mockImplementation(async () => { controller.abort(); return { file: "photo" }; });
  expect(await pickContractFile(scope, "extension", "camera", undefined, controller.signal)).toBeNull();
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("passes cancellation to the upload and ignores a late server result", async () => {
  const controller = new AbortController();
  mocks.upload.mockImplementation(async () => { controller.abort(); return { url: "url", uploadToken: "token" }; });
  expect(await pickContractFile(scope, "extension", "file", undefined, controller.signal)).toBeNull();
  expect(mocks.upload.mock.calls[0][2]).toBe(controller.signal);
});
it("forwards cancellation through the contract service", async () => {
  const { createHrContractService } = await import("../../../../src/services/hrContractService");
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { url: "url", uploadToken: "token" } })));
  const service = createHrContractService({ fetch, getAccessToken: () => "access" });
  const signal = new AbortController().signal;
  await service.upload(scope, { file: "data", name: "file.pdf", mimeType: "application/pdf", size: 4, kind: "extension" }, signal);
  expect(fetch.mock.calls[0][1].signal).toBe(signal);
});
