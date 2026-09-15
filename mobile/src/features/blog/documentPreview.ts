import type { BlogAttachment } from "../../../../src/services/blogService";
import { bytesToBase64, resolveFileFormat } from "../../files/fileFormat";
export type PreviewDocument = { name: string; extension: string; base64: string };
export function previewRequestPath(url: string, origin: string, name: string): string {
  const parsed = new URL(url, origin);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error("Đường dẫn tài liệu không hợp lệ.");
  if (parsed.origin === new URL(origin).origin && /^\/api\/v1\/blogs\/files\/[a-f0-9]{24}(?:\/preview)?$/.test(parsed.pathname)) {
    return parsed.pathname.replace(/\/preview$/, "") + "/preview";
  }
  return "/api/v1/media/download?url=" + encodeURIComponent(parsed.href) + "&filename=" + encodeURIComponent(name);
}
export async function loadBlogDocument(attachment: BlogAttachment, origin: string, fetch: typeof globalThis.fetch, signal: AbortSignal): Promise<PreviewDocument> {
  if (!attachment.url) throw new Error("Tệp chưa có đường dẫn xem trước.");
  const response = await fetch(previewRequestPath(attachment.url, origin, attachment.name), { signal });
  if (!response.ok) throw new Error("Không thể xem tài liệu (HTTP " + response.status + "). Vui lòng tải lại bài viết.");
  if (Number(response.headers.get("content-length")) > 20 * 1024 * 1024) throw new Error("Tệp vượt quá 20 MB.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (signal.aborted) throw new Error("Đã đóng xem trước.");
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error("Tệp rỗng hoặc vượt quá 20 MB.");
  const format = resolveFileFormat({ name: attachment.name, url: attachment.url, bytes, contentType: response.headers.get("content-type") || "", contentDisposition: response.headers.get("content-disposition") || "" });
  if (!["pdf", "docx", "xls", "xlsx"].includes(format.extension)) throw new Error(format.extension === "doc" ? "Word .doc chưa hỗ trợ xem trước. Vui lòng lưu lại thành .docx." : "Chỉ hỗ trợ xem trước PDF, Word .docx và Excel .xls/.xlsx.");
  return { name: format.name, extension: format.extension, base64: bytesToBase64(bytes) };
}
