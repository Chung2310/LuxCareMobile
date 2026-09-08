import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { randomUUID } from "expo-crypto";
import { api } from "../api/services";

export const MAX_SHARED_FILE_BYTES = 20 * 1024 * 1024;
export async function shareApiFile(url: string, name: string, signal?: AbortSignal) {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error("Liên kết tài liệu không hợp lệ.");
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (signal?.aborted) cancel();
  signal?.addEventListener("abort", cancel);
  const timer = setTimeout(cancel, 120000);
  const checkActive = () => {
    if (controller.signal.aborted) throw new Error("Đã dừng tải tài liệu. Vui lòng thử lại nếu kết nối quá chậm.");
  };
  let file: File | undefined;
  let handedOff = false;
  try {
    checkActive();
    if (!(await Sharing.isAvailableAsync())) throw new Error("Thiết bị chưa hỗ trợ chia sẻ tệp.");
    checkActive();
    const response = await api.transport.fetch(
      `/api/v1/media/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(name)}`,
      { signal: controller.signal },
    );
    checkActive();
    const declaredSize = Number(response.headers.get("content-length"));
    if (declaredSize > MAX_SHARED_FILE_BYTES) throw new Error("Tệp vượt quá 20 MB.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    checkActive();
    if (!bytes.length || bytes.length > MAX_SHARED_FILE_BYTES) throw new Error("Tệp tải về trống hoặc vượt quá 20 MB.");
    const fileName = name.replace(/[^\p{L}\p{N}._-]/gu, "_").slice(-120) || "tai-lieu";
    file = new File(Paths.cache, `${randomUUID()}-${fileName}`);
    file.write(bytes);
    checkActive();
    clearTimeout(timer);
    // The receiving app may still be reading after the share sheet closes.
    handedOff = true;
    await Sharing.shareAsync(file.uri, { dialogTitle: name });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", cancel);
    if (file && !handedOff) {
      try {
        if (file.exists) file.delete();
      } catch {}
    }
  }
}
