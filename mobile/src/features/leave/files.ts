import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { leave } from "../../api/services";
import { readPickedFileAsBase64 } from "../../files/readBase64";
export { shareApiFile as shareLeaveFile } from "../../files/shareFile";
import type { LeaveAttachment } from "../../../../src/types/leave";

export const MAX_LEAVE_FILE_BYTES = 20 * 1024 * 1024;
export async function pickLeaveAttachment(): Promise<(LeaveAttachment & { uploadToken: string }) | null> {
  const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    let size: number | undefined = asset.size;
    if (!Number.isFinite(size) || (size as number) <= 0) {
      try {
        if (Number.isFinite(file.size) && (file.size as number) > 0) {
          size = file.size;
        }
      } catch {}
    }
    if (size !== undefined && (size <= 0 || size > MAX_LEAVE_FILE_BYTES))
      throw new Error("Tệp phải có nội dung và không vượt quá 20 MB.");

    const base64 = await readPickedFileAsBase64(asset.uri, asset.name);
    if (!size || size <= 0) {
      size = Math.round((base64.length * 3) / 4);
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_LEAVE_FILE_BYTES)
      throw new Error("Tệp phải có nội dung và không vượt quá 20 MB.");

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
