import { File, FileMode } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { randomUUID } from "expo-crypto";
import { resolveFileFormat } from "./fileFormat";

// Keep videos on disk and inspect only their prefix.
export async function downloadRemoteFile(url: string, name?: string, mimeType?: string) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error("Liên kết tải tệp không hợp lệ.");
  if (!FileSystem.cacheDirectory) throw new Error("Bộ nhớ tạm chưa sẵn sàng.");
  const prefix = FileSystem.cacheDirectory + randomUUID() + "-";
  let uri = prefix + "download";
  try {
    const result = await FileSystem.downloadAsync(url, uri);
    if (result.status < 200 || result.status >= 300) throw new Error("Không tải được tệp (HTTP " + result.status + ").");
    const file = new File(uri);
    if (!file.size) throw new Error("Tệp tải về trống.");
    const handle = file.open(FileMode.ReadOnly);
    let bytes: Uint8Array;
    try { bytes = handle.readBytes(Math.min(512, file.size)); } finally { handle.close(); }
    const headers = new Headers(result.headers);
    const format = resolveFileFormat({ url, name, mimeType, bytes,
      contentType: headers.get("content-type") || "",
      contentDisposition: headers.get("content-disposition") || "" });
    const destination = prefix + format.name;
    await FileSystem.moveAsync({ from: uri, to: destination });
    uri = destination;
    return { uri, ...format };
  } catch (error) {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    throw error;
  }
}
