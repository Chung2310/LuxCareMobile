import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { leave } from "../../api/services";
export { shareApiFile as shareLeaveFile } from "../../files/shareFile";
import type { LeaveAttachment } from "../../../../src/types/leave";

export const MAX_LEAVE_FILE_BYTES = 20 * 1024 * 1024;
export async function pickLeaveAttachment(): Promise<(LeaveAttachment & { uploadToken: string }) | null> {
  const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    const size = file.size;
    if (!Number.isFinite(size) || size <= 0 || size > MAX_LEAVE_FILE_BYTES)
      throw new Error("Tệp phải có nội dung và không vượt quá 20 MB.");
    const base64 = await file.base64();
    const mimeType = asset.mimeType || "application/octet-stream";
    const uploaded = await leave.upload({
      file: `data:${mimeType};base64,${base64}`,
      fileName: asset.name,
      mimeType,
      size,
    });
    return { ...uploaded, name: asset.name, mimeType, size };
  } finally {
    // Only remove the picker copy inside the app cache, never the source document.
    try {
      if (asset.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
    } catch {
      // Cache cleanup must not hide an upload result or its ownership token.
    }
  }
}
