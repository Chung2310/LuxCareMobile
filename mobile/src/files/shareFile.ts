import { resolveFileFormat, bytesToBase64 } from "./fileFormat";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { randomUUID } from "expo-crypto";
import { api } from "../api/services";

export const MAX_SHARED_FILE_BYTES = 20 * 1024 * 1024;

/**
 * Chuẩn hóa URL tệp (hỗ trợ cả absolute URL và relative path từ backend)
 */
export function resolveFileUrl(url: string): string {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  // Nếu đã có scheme (ví dụ http:, https:, file:, javascript:...), giữ nguyên để bộ parser URL kiểm tra tính hợp lệ
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return trimmed;
  }
  const rawOrigin = api.getOrigin?.() || process.env.EXPO_PUBLIC_API_URL || "";
  let origin = rawOrigin.trim();
  if (!origin || (!origin.startsWith("http://") && !origin.startsWith("https://"))) {
    origin = "https://app.luxcare";
  }
  return `${origin.replace(/\/+$/, "")}/${trimmed.replace(/^\/+/, "")}`;
}

export async function shareApiFile(url: string, name: string, signal?: AbortSignal): Promise<void> {
  await transferApiFile(url, name, "share", signal);
}

export async function downloadApiFile(url: string, name: string, signal?: AbortSignal) {
  return transferApiFile(url, name, "download", signal);
}

async function transferApiFile(url: string, name: string, action: "share" | "download", signal?: AbortSignal) {
  const resolvedUrl = resolveFileUrl(url);
  const parsed = new URL(resolvedUrl);
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

  const webDownload = typeof document !== "undefined" && typeof URL.createObjectURL === "function";
  let file: File | undefined;
  let handedOff = false;

  try {
    checkActive();
    if (action === "share" && !webDownload && !(await Sharing.isAvailableAsync())) throw new Error("Thiết bị chưa hỗ trợ chia sẻ tệp.");

    checkActive();
    let response: Response;
    try {
      response = await api.transport.fetch(
        `/api/v1/media/download?url=${encodeURIComponent(resolvedUrl)}&filename=${encodeURIComponent(name)}`,
        { signal: controller.signal },
      );
      if ((typeof response?.status === "number" && response.status >= 400) || response?.ok === false) {
        throw Object.assign(new Error("Không tải được tệp (HTTP " + response.status + ")."), { status: response.status });
      }
    } catch (proxyError) {
      const status = (proxyError as { status?: number })?.status;
      if (controller.signal.aborted || status === 401 || status === 403) throw proxyError;
      try {
        const directResp = await fetch(resolvedUrl, { signal: controller.signal });
        if ((typeof directResp?.status === "number" && directResp.status >= 400) || directResp?.ok === false) {
          throw proxyError;
        }
        response = directResp;
      } catch {
        throw proxyError;
      }
    }

    checkActive();
    const declaredSize = Number(response.headers.get("content-length"));
    if (declaredSize > MAX_SHARED_FILE_BYTES) throw new Error("Tệp vượt quá 20 MB.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    checkActive();
    if (!bytes.length || bytes.length > MAX_SHARED_FILE_BYTES) throw new Error("Tệp tải về trống hoặc vượt quá 20 MB.");
    const format = resolveFileFormat({ name, url: resolvedUrl, bytes,
      contentType: response.headers.get("content-type") || "",
      contentDisposition: response.headers.get("content-disposition") || "" });
    const fileName = format.name;
    if (webDownload) {
      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: format.mimeType }));
      const anchor = document.createElement("a");
      try {
        anchor.href = objectUrl;
        anchor.download = format.name;
        document.body.appendChild(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
      }
      return;
    }
    if (action === "download") {
      // User interaction must not consume the network timeout.
      clearTimeout(timer);
      let directory: Directory;
      try {
        directory = await Directory.pickDirectoryAsync();
      } catch (error) {
        const code = (error as { code?: string })?.code || "";
        if (/PICK(?:ER|ING).*CANCEL/i.test(code) || /pick(?:er|ing).*cancel/i.test(String(error))) return;
        throw error;
      }
      checkActive();
      const existingNames = new Set(directory.list().map(entry => entry.name.toLowerCase()));
      const extension = format.extension ? "." + format.extension : "";
      const baseName = extension ? fileName.slice(0, -extension.length) : fileName;
      let saveName = fileName;
      for (let suffix = 1; existingNames.has(saveName.toLowerCase()); suffix++) {
        saveName = baseName + " (" + suffix + ")" + extension;
      }
      file = directory.createFile(saveName, format.mimeType);
      await writeBinaryFile(file, bytes);
      checkActive();
      handedOff = true;
      return { name: saveName, uri: file.uri };
    }
    file = new File(Paths.cache, `${randomUUID()}-${fileName}`);

    await writeBinaryFile(file, bytes);

    checkActive();
    clearTimeout(timer);
    // The receiving app may still be reading after the share sheet closes.
    handedOff = true;
    try {
      await Sharing.shareAsync(file.uri, { dialogTitle: format.name, mimeType: format.mimeType });
    } catch (error) {
      // Dismissing the native share sheet is not a download/share failure.
      // Keep this check here: cancellation while downloading must still surface.
      if (!isNativeShareCancelled(error)) throw error;
    }
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

async function writeBinaryFile(file: File, bytes: Uint8Array) {
  try { file.write(bytes); }
  catch {
    try {
      const legacyFs = await import("expo-file-system/legacy");
      await legacyFs.writeAsStringAsync(file.uri, bytesToBase64(bytes), { encoding: "base64" as any });
    } catch {
      throw new Error("Không thể lưu tệp vào thư mục đã chọn. Vui lòng kiểm tra quyền truy cập và dung lượng.");
    }
  }
}

function isNativeShareCancelled(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const info = error as { code?: string | number; name?: string; message?: string; domain?: string };
  if (info.name === "AbortError") return true;
  if (["ERR_SHARING_CANCELED", "ERR_SHARING_CANCELLED", "ERR_CANCELED", "ERR_CANCELLED"].includes(String(info.code))) return true;
  if (info.domain === "NSCocoaErrorDomain" && Number(info.code) === 3072) return true;
  return /\buser (?:did )?cancel(?:led|ed)\b|\bshar(?:e|ing) (?:was )?cancel(?:led|ed)\b/i.test(info.message || "");
}
