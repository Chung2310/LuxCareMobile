import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  pick: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  size: 20,
  download: vi.fn(),
  share: vi.fn(),
  write: vi.fn(),
}));
vi.mock("expo-document-picker", () => ({ getDocumentAsync: mocks.pick }));
vi.mock("expo-file-system", () => ({
  Paths: { cache: { uri: "file:///cache/" } },
  File: class {
    uri = "file:///cache/download.pdf";
    exists = true;
    get size() {
      return mocks.size;
    }
    delete = mocks.remove;
    write = mocks.write;
  },
}));
vi.mock("expo-sharing", () => ({ isAvailableAsync: async () => true, shareAsync: mocks.share }));
vi.mock("expo-crypto", () => ({ randomUUID: () => "uuid" }));
vi.mock("../../api/services", () => ({
  api: { transport: { fetch: mocks.upload } },
  recruitment: { downloadAttachment: mocks.download },
}));
import { uploadRecruitmentFile, shareRecruitmentFile, uploadPublicRecruitmentFile } from "./files";
import { recruitmentFileType } from "./fileModel";
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mocks.size = 20;
});
it("validates supported types and actual byte size", () => {
  expect(recruitmentFileType("CV.DOCX", 10)).toContain("wordprocessingml");
  for (const [name, size] of [
    ["x.exe", 10],
    ["x.pdf", 0],
    ["x.pdf", 10485761],
  ] as const)
    expect(() => recruitmentFileType(name, size)).toThrow();
});
it("does nothing when picker is cancelled", async () => {
  mocks.pick.mockResolvedValue({ canceled: true });
  expect(await uploadRecruitmentFile("job", "j")).toBe(false);
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("uploads multipart with attachment version and cleans only cache copies", async () => {
  const append = vi.fn();
  vi.stubGlobal(
    "FormData",
    class {
      append = append;
    },
  );
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/cv.pdf", name: "cv.pdf" }] });
  mocks.upload.mockResolvedValue({});
  await uploadRecruitmentFile("applicant", "a/b", 3);
  expect(mocks.upload.mock.calls[0][0]).toBe("/api/v1/recruitment/applicants/a%2Fb/attachment");
  expect(mocks.upload.mock.calls[0][1].headers).toBeUndefined();
  expect(append).toHaveBeenCalledWith("version", "3");
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("downloads signed files without sending LuxCare credentials", async () => {
  mocks.download.mockResolvedValue({ signedUrl: "https://files.example/cv.pdf?signature=abc", originalName: "cv.pdf" });
  const fetch = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal("fetch", fetch);
  await shareRecruitmentFile("f1");
  expect(fetch.mock.calls[0][1]).not.toHaveProperty("headers");
  expect(mocks.write).toHaveBeenCalled();
  expect(mocks.share).toHaveBeenCalled();
});
it("uploads a public document and returns the server ownership metadata", async () => {
  const append = vi.fn();
  vi.stubGlobal(
    "FormData",
    class {
      append = append;
    },
  );
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/cv.pdf", name: "cv.pdf" }] });
  const file = { url: "https://files.example/cv.pdf", publicId: "new-file", originalName: "cv.pdf", size: 20 };
  mocks.upload.mockResolvedValue(new Response(JSON.stringify({ data: file })));
  expect(await uploadPublicRecruitmentFile()).toEqual(file);
  expect(mocks.upload.mock.calls[0][0]).toBe("/api/v1/recruitment/files/public");
  expect(append).toHaveBeenCalledWith("file", { uri: "file:///cache/cv.pdf", name: "cv.pdf", type: "application/pdf" });
  expect(mocks.remove).toHaveBeenCalledOnce();
});
it("public picker cancellation does not upload", async () => {
  mocks.pick.mockResolvedValue({ canceled: true });
  expect(await uploadPublicRecruitmentFile()).toBeNull();
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("cleans picker copies even when public upload fails", async () => {
  vi.stubGlobal(
    "FormData",
    class {
      append = vi.fn();
    },
  );
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///cache/cv.pdf", name: "cv.pdf" }] });
  mocks.upload.mockRejectedValue(new Error("offline"));
  await expect(uploadPublicRecruitmentFile()).rejects.toThrow("offline");
  expect(mocks.remove).toHaveBeenCalledOnce();
});
