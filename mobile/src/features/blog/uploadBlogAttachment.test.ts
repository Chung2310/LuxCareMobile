import { describe, expect, it, vi } from "vitest";
import { BLOG_UPLOAD_LIMIT, uploadBlogAttachment } from "./uploadBlogAttachment";
import { ApiClientError } from "../../../../src/services/apiClientError";
const attachment = { id: "f", name: "Bao cao.xlsx", type: "file" as const, localUri: "file:///cache/report.xlsx" };
const setup = () => ({
  read: vi.fn().mockResolvedValue("UEsDBA=="),
  upload: vi.fn().mockResolvedValue({ url: "/api/v1/blogs/files/" + "a".repeat(24), size: 4 }),
});
describe("Blog attachment upload", () => {
  it.each([
    ["report.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    ["report.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    ["report.pdf", "application/pdf"],
    ["photo.png", "image/png"],
  ])("sends the correct MIME type for %s", async (name, mime) => {
    const { read, upload } = setup();
    await uploadBlogAttachment({ ...attachment, name }, read, upload);
    expect(read).toHaveBeenCalledWith(attachment.localUri, name);
    expect(upload).toHaveBeenCalledWith({ file: "data:" + mime + ";base64,UEsDBA==", fileName: name });
  });
  it("reads web picker data URIs without calling native file APIs", async () => {
    const { read, upload } = setup();
    await uploadBlogAttachment({ ...attachment, localUri: "data:application/octet-stream;base64,UEsDBA==" }, read, upload);
    expect(read).not.toHaveBeenCalled();
    expect(upload.mock.calls[0][0].file).toContain("spreadsheetml.sheet;base64,UEsDBA==");
  });
  it("uses the shared reader for content and blob URIs", async () => {
    for (const uri of ["content://provider/report.xlsx", "blob:https://app.test/file"]) {
      const { read, upload } = setup();
      await uploadBlogAttachment({ ...attachment, localUri: uri }, read, upload);
      expect(read).toHaveBeenCalledWith(uri, attachment.name);
    }
  });
  it("rejects known oversized files before reading or uploading", async () => {
    const { read, upload } = setup();
    await expect(uploadBlogAttachment({ ...attachment, sizeBytes: BLOG_UPLOAD_LIMIT + 1 }, read, upload)).rejects.toThrow("20 MB");
    expect(read).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });
  it("checks actual size when the picker size is unknown", async () => {
    const { read, upload } = setup();
    read.mockResolvedValue("A".repeat(4 * Math.ceil((BLOG_UPLOAD_LIMIT + 1) / 3)));
    await expect(uploadBlogAttachment(attachment, read, upload)).rejects.toThrow("20 MB");
    expect(upload).not.toHaveBeenCalled();
  });
  it.each(["", "bad", "====", "<html>login</html>"])("does not send empty or malformed data: %s", async value => {
    const { read, upload } = setup();
    read.mockResolvedValue(value);
    await expect(uploadBlogAttachment(attachment, read, upload)).rejects.toThrow("chọn lại tệp");
    expect(upload).not.toHaveBeenCalled();
  });
  it("preserves the actual read error and does not attempt upload", async () => {
    const { read, upload } = setup();
    read.mockRejectedValue(new Error("Không thể đọc nội dung tệp đính kèm"));
    await expect(uploadBlogAttachment(attachment, read, upload)).rejects.toThrow("Không thể đọc nội dung");
    expect(upload).not.toHaveBeenCalled();
  });
  it("preserves backend permission errors instead of a generic retry message", async () => {
    const { read, upload } = setup();
    upload.mockRejectedValue(new ApiClientError({ status: 403, code: "FORBIDDEN", message: "Bạn không có quyền đăng Blog." }));
    await expect(uploadBlogAttachment(attachment, read, upload)).rejects.toThrow("Bạn không có quyền đăng Blog");
  });
  it.each([[404, "Cần cập nhật máy chủ"], [413, "dung lượng"]])("explains HTTP %s failures", async (status, message) => {
    const { read, upload } = setup();
    upload.mockRejectedValue(new ApiClientError({ status: Number(status), code: "ERROR", message: "Request failed" }));
    await expect(uploadBlogAttachment(attachment, read, upload)).rejects.toThrow(String(message));
  });
});
