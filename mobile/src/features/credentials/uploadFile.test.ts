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
vi.mock("../../api/services", () => ({ credentials: { upload: mocks.upload } }));
import { pickCredentialFile } from "./uploadFile";
import { createHrCredentialService } from "../../../../src/services/hrCredentialService";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.size = 10;
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
    fileSize: 10,
    uploadToken: "token",
  });
  expect(mocks.upload).toHaveBeenCalledWith(
    "COMP",
    { file: "data:application/pdf;base64,dGVzdA==", name: "doc.pdf", mimeType: "application/pdf", size: 10 },
    signal,
  );
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("does not upload when picker is canceled", async () => {
  mocks.pick.mockResolvedValue({ canceled: true });
  expect(await pickCredentialFile("A", new AbortController().signal)).toBeNull();
  expect(mocks.upload).not.toHaveBeenCalled();
});
it.each([0, 10485761])("rejects actual file size %s before reading base64", async (size) => {
  mocks.size = size;
  await expect(pickCredentialFile("A", new AbortController().signal)).rejects.toThrow("10 MB");
  expect(mocks.base64).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it.each(["doc.docx", "scan.gif"])("rejects %s even though contracts allow it", async (name) => {
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
