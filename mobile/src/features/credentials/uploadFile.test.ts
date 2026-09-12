import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ pick: vi.fn(), upload: vi.fn(), remove: vi.fn(), base64: vi.fn(), size: 10, sizeError: false, camera: vi.fn(), legacyRead: vi.fn() }));
vi.mock("../../files/captureDocumentPhoto", () => ({ captureDocumentPhoto: mocks.camera }));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: mocks.pick }));
vi.mock("expo-file-system/legacy", () => ({ readAsStringAsync: mocks.legacyRead, EncodingType: { Base64: "base64" } }));
vi.mock("expo-file-system", () => ({
  Paths: { cache: { uri: "file:///cache/" } },
  File: class {
    exists = true;
    get size() {
      if (mocks.sizeError) throw new Error("Cannot read file metadata");
      return mocks.size;
    }
    base64 = mocks.base64;
    delete = mocks.remove;
  },
}));
vi.mock("../../api/services", () => ({ credentials: { upload: mocks.upload } }));
import { pickCredentialFile } from "./uploadFile";
import { createHrCredentialService } from "../../../../src/services/hrCredentialService";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.size = 10;
  mocks.sizeError = false;
  mocks.base64.mockResolvedValue("dGVzdA==");
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/doc.pdf", name: "doc.pdf" }] });
  mocks.upload.mockResolvedValue({ url: "https://files.example/doc", uploadToken: "token" });
});
it("uploads with tenant and maps the pending token to credential fields", async () => {
  const signal = new AbortController().signal;
  expect(await pickCredentialFile("COMP", signal)).toEqual({
    fileUrl: "https://files.example/doc",
    fileName: "doc.pdf",
    fileMimeType: "application/pdf",
    fileSize: 4,
    uploadToken: "token",
  });
  expect(mocks.upload).toHaveBeenCalledWith(
    "COMP",
    { file: "data:application/pdf;base64,dGVzdA==", name: "doc.pdf", mimeType: "application/pdf", size: 4 },
    signal,
  );
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("does not upload when picker is canceled", async () => {
  mocks.pick.mockResolvedValue({ canceled: true });
  expect(await pickCredentialFile("A", new AbortController().signal)).toBeNull();
  expect(mocks.upload).not.toHaveBeenCalled();
});
it.each([10485761])("rejects actual file size %s before reading base64", async (size) => {
  mocks.size = size;
  await expect(pickCredentialFile("A", new AbortController().signal)).rejects.toThrow("10 MB");
  expect(mocks.base64).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it.each(["script.exe", "scan.gif"])("rejects %s when the format is unsupported", async (name) => {
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/doc", name }] });
  await expect(pickCredentialFile("A", new AbortController().signal)).rejects.toThrow("PDF");
  expect(mocks.base64).not.toHaveBeenCalled();
});
it("does not upload after scope cancellation and cleans the cache copy", async () => {
  const controller = new AbortController();
  mocks.base64.mockImplementation(async () => {
    controller.abort();
    return "data";
  });
  await expect(pickCredentialFile("A", controller.signal)).rejects.toThrow("hủy");
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("rejects missing tokens and preserves files outside cache", async () => {
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "content://original", name: "scan.png" }] });
  mocks.upload.mockResolvedValue({ url: "url" });
  await expect(pickCredentialFile("A", new AbortController().signal)).rejects.toThrow("Chưa xác nhận");
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("sends authenticated upload and preserves metadata/token on PATCH", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { url: "url", uploadToken: "token" } })));
  const service = createHrCredentialService({ fetch, getAccessToken: () => "access" });
  const signal = new AbortController().signal;
  const value = { file: "data", name: "scan.pdf", mimeType: "application/pdf", size: 10 };
  await expect(service.upload("A&B", value, signal)).resolves.toEqual({ url: "url", uploadToken: "token" });
  expect(fetch).toHaveBeenCalledWith("/api/v1/hr-credentials/upload?companyCode=A%26B", {
    method: "POST",
    headers: { Authorization: "Bearer access", "Content-Type": "application/json" },
    body: JSON.stringify(value),
    signal,
  });
  fetch.mockResolvedValue(new Response(JSON.stringify({ data: { _id: "id" } })));
  const fields = {
    fileUrl: "url",
    fileName: "scan.pdf",
    fileMimeType: "application/pdf",
    fileSize: 10,
    uploadToken: "token",
  };
  await service.update("A", "id", fields);
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual(fields);
});
it("propagates failed upload without retrying", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Denied" }), { status: 403 }));
  const service = createHrCredentialService({ fetch, getAccessToken: () => "access" });
  await expect(
    service.upload("A", { file: "data", name: "scan.pdf", mimeType: "application/pdf", size: 10 }),
  ).rejects.toMatchObject({ status: 403 });
  expect(fetch).toHaveBeenCalledOnce();
});

it("maps camera photo metadata to credential file fields", async () => {
  const signal = new AbortController().signal;
  const photo = { file: "data:image/jpeg;base64,dGVzdA==", name: "photo.jpg", mimeType: "image/jpeg", size: 4 };
  mocks.camera.mockResolvedValue(photo);
  expect(await pickCredentialFile("COMP", signal, "camera")).toMatchObject({ fileName: "photo.jpg", fileSize: 4, fileMimeType: "image/jpeg", uploadToken: "token" });
  expect(mocks.upload).toHaveBeenCalledWith("COMP", photo, signal);
  expect(mocks.pick).not.toHaveBeenCalled();
});
it("does not upload a camera photo after cancellation", async () => {
  const controller = new AbortController();
  mocks.camera.mockImplementation(async () => { controller.abort(); return { file: "photo" }; });
  expect(await pickCredentialFile("COMP", controller.signal, "camera")).toBeNull();
  expect(mocks.upload).not.toHaveBeenCalled();
});

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each([
  ["scan.doc", "application/msword"],
  ["scan.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ["scan.xls", "application/vnd.ms-excel"],
  ["scan.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  ["scan.pdf", "application/pdf"],
  ["scan.JPG", "image/jpeg"],
  ["scan.jpeg", "image/jpeg"],
  ["scan.png", "image/png"],
  ["scan.webp", "image/webp"],
])("uploads browser file %s without native filesystem access", async (name, mimeType) => {
  const browserFile = new globalThis.File(["test"], name, { type: mimeType });
  const read = vi.fn(function (this: any) {
    this.result = "data:" + mimeType + ";base64,dGVzdA==";
    this.onload();
  });
  vi.stubGlobal("FileReader", class { readAsDataURL = read; });
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "blob:test", file: browserFile, name, size: 999 }] });
  const result = await pickCredentialFile("A", new AbortController().signal);
  expect(result).toMatchObject({ fileName: name, fileMimeType: mimeType, fileSize: 4 });
  expect(mocks.upload.mock.calls[0][1]).toEqual({ file: "data:" + mimeType + ";base64,dGVzdA==", name, mimeType, size: 4 });
  expect(read).toHaveBeenCalledWith(browserFile);
  expect(mocks.base64).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(revoke).toHaveBeenCalledWith("blob:test");
});

it("rejects oversized browser files before reading and releases the object URL", async () => {
  const read = vi.fn();
  vi.stubGlobal("FileReader", class { readAsDataURL = read; });
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "blob:large", file: { size: 10485761 }, name: "scan.pdf", size: 4 }] });
  await expect(pickCredentialFile("A", new AbortController().signal)).rejects.toThrow("10 MB");
  expect(read).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(revoke).toHaveBeenCalledWith("blob:large");
});

it("reports browser read failures and releases the object URL", async () => {
  vi.stubGlobal("FileReader", class { readAsDataURL() { (this as any).onerror(); } });
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "blob:bad", file: { size: 4 }, name: "scan.pdf" }] });
  await expect(pickCredentialFile("A", new AbortController().signal)).rejects.toThrow("Vui lòng chọn lại");
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(revoke).toHaveBeenCalledWith("blob:bad");
});

it("does not open the picker for an already canceled upload", async () => {
  const controller = new AbortController();
  controller.abort();
  expect(await pickCredentialFile("A", controller.signal)).toBeNull();
  expect(mocks.pick).not.toHaveBeenCalled();
});

it("reports an empty picker result without uploading", async () => {
  mocks.pick.mockResolvedValue({ canceled: false, assets: [] });
  await expect(pickCredentialFile("A", new AbortController().signal)).rejects.toThrow("Vui lòng chọn lại");
  expect(mocks.upload).not.toHaveBeenCalled();
});

it.each([["doc","application/msword"],["docx","application/vnd.openxmlformats-officedocument.wordprocessingml.document"],["xls","application/vnd.ms-excel"],["xlsx","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"]])("uploads native Office file %s with the expected MIME", async (ext, mimeType) => {
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/office", name: "document." + ext.toUpperCase() }] });
  await pickCredentialFile("A", new AbortController().signal);
  expect(mocks.pick.mock.calls[0][0].type).toContain(mimeType);
  expect(mocks.upload.mock.calls[0][1]).toMatchObject({ mimeType, file: "data:" + mimeType + ";base64,dGVzdA==" });
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
  await pickCredentialFile("COMP", new AbortController().signal, "file", onProgress);
  expect(onProgress).toHaveBeenCalledTimes(2);
});
it("uploads through the legacy reader when FileSystemFile.base64 is rejected", async () => {
  mocks.base64.mockRejectedValue(new Error('Call to function "FileSystemFile.base64" has been rejected'));
  mocks.legacyRead.mockResolvedValue("dGVzdA==");
  const result = await pickCredentialFile("COMP", new AbortController().signal);
  expect(result).toMatchObject({ uploadToken: "token", fileName: "doc.pdf" });
  expect(mocks.legacyRead).toHaveBeenCalledWith("file:///cache/doc.pdf", { encoding: "base64" });
  expect(mocks.upload).toHaveBeenCalledOnce();
  expect(mocks.upload.mock.calls[0][1].file).toBe("data:application/pdf;base64,dGVzdA==");
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("does not upload if the form is canceled during fallback reading", async () => {
  const controller = new AbortController();
  mocks.base64.mockRejectedValue(new Error("FileSystemFile.base64 rejected"));
  mocks.legacyRead.mockImplementation(async () => { controller.abort(); return "dGVzdA=="; });
  await expect(pickCredentialFile("COMP", controller.signal)).rejects.toThrow("hủy");
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it.each(["throws", "zero"])("reads a selected file when native size %s", async (failure) => {
  mocks.sizeError = failure === "throws";
  mocks.size = 0;
  mocks.base64.mockRejectedValue(new Error("Native reader unavailable"));
  mocks.legacyRead.mockResolvedValue("dGVzdA==");
  const result = await pickCredentialFile("COMP", new AbortController().signal);
  expect(result).toMatchObject({ fileSize: 4, uploadToken: "token" });
  expect(mocks.upload.mock.calls[0][1].size).toBe(4);
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("rejects oversized picker metadata when native metadata is unavailable", async () => {
  mocks.sizeError = true;
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/doc.pdf", name: "doc.pdf", size: 10485761 }] });
  await expect(pickCredentialFile("COMP", new AbortController().signal)).rejects.toThrow("10 MB");
  expect(mocks.base64).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
});
it.each(["", "AAAA".repeat(3495254)])("rejects empty or oversized content despite metadata", async (content) => {
  const browserFile = new globalThis.File(["test"], "scan.pdf");
  vi.stubGlobal("FileReader", class { readAsDataURL() { (this as any).result = "data:application/pdf;base64," + content; (this as any).onload(); } });
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "blob:invalid", file: browserFile, name: "scan.pdf" }] });
  await expect(pickCredentialFile("COMP", new AbortController().signal)).rejects.toThrow("10 MB");
  expect(mocks.upload).not.toHaveBeenCalled();
});
