import { bytesToBase64, resolveFileFormat } from "../../files/fileFormat";

export function blogImageLocation(url: string, origin: string) {
  if (/^data:image\/(?:png|jpeg|gif|webp|bmp);base64,/i.test(url.trim())) return { uri: url.trim(), previewPath: null };
  const parsed = new URL(url.trim(), origin);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error("Đường dẫn ảnh không hợp lệ.");
  const managed = parsed.origin === new URL(origin).origin &&
    /^\/api\/v1\/blogs\/files\/[a-f0-9]{24}(?:\/preview)?\/?$/i.test(parsed.pathname);
  return { uri: parsed.href, previewPath: managed
    ? parsed.pathname.replace(/\/$/, "").replace(/\/preview$/i, "") + "/preview" : null };
}

export async function loadBlogImageSource(url: string, origin: string, fetch: typeof globalThis.fetch, signal: AbortSignal) {
  const location = blogImageLocation(url, origin);
  if (!location.previewPath) return location.uri;
  // Use the API transport on every platform for branch headers and token refresh.
  const response = await fetch(location.previewPath, { signal });
  if (!response.ok) throw new Error("Không tải được ảnh (HTTP " + response.status + ").");
  const limit = 20 * 1024 * 1024;
  if (Number(response.headers.get("content-length")) > limit) throw new Error("Ảnh vượt quá 20 MB.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (signal.aborted) throw new Error("Đã dừng tải ảnh.");
  if (!bytes.length || bytes.length > limit) throw new Error("Ảnh rỗng hoặc vượt quá 20 MB.");
  const format = resolveFileFormat({ bytes, contentType: response.headers.get("content-type") || "",
    contentDisposition: response.headers.get("content-disposition") || "" });
  if (!format.mimeType.startsWith("image/")) throw new Error("Máy chủ không trả về dữ liệu ảnh hợp lệ.");
  return "data:" + format.mimeType + ";base64," + bytesToBase64(bytes);
}
