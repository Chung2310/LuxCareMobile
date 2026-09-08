import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import type { TaskAttachment } from "../../../../src/types/hr";
import { kanbanMedia } from "../../api/services";
export async function pickWorkAttachment(): Promise<TaskAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({ multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    const size = file.size;
    if (!Number.isFinite(size) || size <= 0 || size > 20 * 1024 * 1024)
      throw new Error("Tệp phải có nội dung và không vượt quá 20 MB.");
    const mimeType = asset.mimeType || "application/octet-stream";
    const fileData = `data:${mimeType};base64,${await file.base64()}`;
    const uploaded = await kanbanMedia.upload({ file: fileData, fileName: asset.name, mimeType, size });
    const type: TaskAttachment["type"] = mimeType.startsWith("image/")
      ? "image"
      : mimeType.startsWith("video/")
        ? "video"
        : mimeType.startsWith("audio/")
          ? "audio"
          : "file";
    return { id: randomUUID(), name: asset.name, type, mimeType, size, ...uploaded };
  } finally {
    try {
      if (asset.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
    } catch {}
  }
}
