import { describe, expect, it, vi } from "vitest";
import { prepareLocalBlogFile } from "./prepareLocalBlogFile";
describe("local Blog downloads", () => {
  it("returns only the verified readable copy, never the picker cache URI", async () => {
    const files = { copyAsync: vi.fn().mockResolvedValue(undefined), getInfoAsync: vi.fn().mockResolvedValue({ exists: true, isDirectory: false }) };
    expect(await prepareLocalBlogFile("file:///cache/DocumentPicker/source.docx", "file:///documents/result.docx", files)).toBe("file:///documents/result.docx");
    expect(files.copyAsync).toHaveBeenCalledWith({ from: "file:///cache/DocumentPicker/source.docx", to: "file:///documents/result.docx" });
  });
  it("stops at an unreadable picker file, rather than handing it to SAF", async () => {
    const files = { copyAsync: vi.fn().mockRejectedValue(new Error("isn't readable")), getInfoAsync: vi.fn() };
    await expect(prepareLocalBlogFile("file:///cache/missing.docx", "file:///documents/file.docx", files)).rejects.toThrow("chọn lại tệp gốc");
    expect(files.getInfoAsync).not.toHaveBeenCalled();
  });
  it.each([{ exists: false }, { exists: true, isDirectory: true }])("rejects an invalid destination: %j", async info => {
    const files = { copyAsync: vi.fn().mockResolvedValue(undefined), getInfoAsync: vi.fn().mockResolvedValue(info) };
    await expect(prepareLocalBlogFile("content://document/file", "file:///documents/file.docx", files)).rejects.toThrow("không còn tồn tại");
  });
});
