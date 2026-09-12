import { readPickedFileAsBase64 } from "../../files/readBase64";
import type { UploadProgressHandler } from "../../components/UploadProgress";
import { captureDocumentPhoto } from "../../files/captureDocumentPhoto";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import type { CredentialFileFields } from "../../../../src/services/hrCredentialService";
import { credentials } from "../../api/services";

const FILE_MIMES: Record<string, string> = {
  "pdf": "application/pdf",
  "jpg": "image/jpeg",
  "jpeg": "image/jpeg",
  "png": "image/png",
  "webp": "image/webp",
  "doc": "application/msword",
  "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "xls": "application/vnd.ms-excel",
  "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
};
const MIMES = [...new Set(Object.values(FILE_MIMES))];
export async function pickCredentialFile(
  companyCode: string,
  signal: AbortSignal,
  source: "file" | "camera" = "file",
  onProgress?: UploadProgressHandler,
): Promise<CredentialFileFields | null> {
  if (signal.aborted) return null;
  if (source === "camera") {
    const photo = await captureDocumentPhoto(signal);
    if (!photo || signal.aborted) return null;
    onProgress?.({ stage: "uploading", name: photo.name });
    const result = await credentials.upload(companyCode, photo, signal);
    if (!result?.url || !result?.uploadToken) throw new Error("Chưa xác nhận được ảnh tải lên. Vui lòng chụp lại.");
    return { fileUrl: result.url, fileName: photo.name, fileMimeType: photo.mimeType, fileSize: photo.size, uploadToken: result.uploadToken };
  }
  const picked = await DocumentPicker.getDocumentAsync({ type: MIMES, multiple: false, copyToCacheDirectory: true, base64: false });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset) throw new Error("Không đọc được tệp đã chọn. Vui lòng chọn lại.");
  const file = asset.file ? null : new File(asset.uri);
  try {
    if (signal.aborted) throw new Error("Đã hủy tải tệp.");
    onProgress?.({ stage: "preparing", name: asset.name });
    // Document providers may allow content reads without exposing native metadata.
    let estimatedSize = asset.file?.size ?? asset.size;
    if (file) {
      try {
        const nativeSize = file.size;
        if (Number.isFinite(nativeSize) && nativeSize > 0) estimatedSize = nativeSize;
      } catch {
        // The shared reader can still use the legacy API.
      }
    }
    if (!asset.name.trim() || asset.name.length > 300) throw new Error("Tên tệp cần từ 1 đến 300 ký tự.");
    if (estimatedSize !== undefined && estimatedSize > 10 * 1024 * 1024)
      throw new Error("Tệp phải có nội dung và tối đa 10 MB.");
    const mimeType = FILE_MIMES[asset.name.toLowerCase().split(".").pop() || ""];
    if (!mimeType) throw new Error("Chọn PDF, Word (DOC/DOCX), Excel (XLS/XLSX), JPG, PNG hoặc WebP, tối đa 10 MB.");
    const content = asset.file ? await readBrowserFile(asset.file) : await readPickedFileAsBase64(asset.uri, asset.name);
    const size = Math.floor(content.length * 3 / 4) - (content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0);
    if (!Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024)
      throw new Error("Tệp phải có nội dung và tối đa 10 MB.");
    if (signal.aborted) throw new Error("Đã hủy tải tệp.");
    onProgress?.({ stage: "uploading", name: asset.name });
    const result = await credentials.upload(
      companyCode,
      { file: `data:${mimeType};base64,${content}`, name: asset.name, mimeType, size },
      signal,
    );
    if (!result?.url || !result?.uploadToken) throw new Error("Chưa xác nhận được tệp tải lên. Vui lòng chọn lại.");
    return {
      fileUrl: result.url,
      fileName: asset.name,
      fileMimeType: mimeType,
      fileSize: size,
      uploadToken: result.uploadToken,
    };
  } finally {
    try {
      if (asset.file && asset.uri.startsWith("blob:")) URL.revokeObjectURL(asset.uri);
      else if (file && asset.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
    } catch {}
  }
}

function readBrowserFile(file: globalThis.File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không đọc được tệp đã chọn. Vui lòng chọn lại."));
    reader.onabort = () => reject(new Error("Đã hủy đọc tệp."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string" || !result.includes(";base64,")) {
        reject(new Error("Không đọc được nội dung tệp đã chọn."));
        return;
      }
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.readAsDataURL(file);
  });
}
