import { resolveFileFormat } from "../../files/fileFormat";

export const BLOG_UPLOAD_LIMIT = 20 * 1024 * 1024;
export type PendingBlogAttachment = {
  id: string; name: string; type: "file" | "image"; sizeBytes?: number;
  sizeLabel?: string; localUri?: string; mimeType?: string;
};
type Upload = (payload: { file: string; fileName: string }) => Promise<{ url: string; size: number }>;

export async function uploadBlogAttachment(
  attachment: PendingBlogAttachment,
  read: (uri: string, name?: string) => Promise<string>,
  upload: Upload,
) {
  try {
    if (!attachment.localUri) throw new Error("Vui lòng chọn lại tệp đính kèm.");
    if ((attachment.sizeBytes ?? 0) > BLOG_UPLOAD_LIMIT) throw new Error("Tệp vượt quá giới hạn 20 MB.");
    const uri = attachment.localUri;
    if (!/^(file:|content:|blob:|data:)/i.test(uri)) throw new Error("Tệp đính kèm phải được chọn từ thiết bị.");
    const inline = /^data:([^;,]*);base64,([\s\S]*)$/i.exec(uri);
    if (uri.startsWith("data:") && !inline) throw new Error("Dữ liệu tệp không hợp lệ. Vui lòng chọn lại tệp.");
    // Web DocumentPicker returns a data URI; do not pass it to native File APIs.
    const base64 = (inline ? inline[2] : await read(uri, attachment.name)).replace(/\s/g, "");
    const size = Math.floor(base64.length * 3 / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
    if (size > BLOG_UPLOAD_LIMIT) throw new Error("Tệp vượt quá giới hạn 20 MB.");
    if (!base64 || base64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(base64) || /=/.test(base64.slice(0, -2)) || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) {
      throw new Error("Tệp rỗng hoặc dữ liệu không hợp lệ. Vui lòng chọn lại tệp.");
    }
    const format = resolveFileFormat({ name: attachment.name, mimeType: attachment.mimeType || inline?.[1] });
    const result = await upload({ file: "data:" + format.mimeType + ";base64," + base64, fileName: format.name });
    return { name: format.name, type: attachment.type, url: result.url, size: result.size };
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
    const detail = status === 413 ? "Máy chủ từ chối vì dung lượng tệp vượt giới hạn cho phép."
      : status === 404 ? "Máy chủ chưa hỗ trợ tải tệp Blog. Cần cập nhật máy chủ để tiếp tục."
      : error instanceof Error ? error.message : "Vui lòng chọn lại tệp hoặc thử lại.";
    throw new Error('Không thể tải lên tệp "' + attachment.name + '". ' + detail + " Bài viết chưa được đăng.");
  }
}
