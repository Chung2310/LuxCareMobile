import { captureDocumentPhoto } from "../../files/captureDocumentPhoto";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import type { CredentialFileFields } from "../../../../src/services/hrCredentialService";
import { credentials } from "../../api/services";
import { contractFileMime } from "../contracts/uploadModel";

const MIMES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
export async function pickCredentialFile(
  companyCode: string,
  signal: AbortSignal,
  source: "file" | "camera" = "file",
): Promise<CredentialFileFields | null> {
  if (source === "camera") {
    const photo = await captureDocumentPhoto(signal);
    if (!photo || signal.aborted) return null;
    const result = await credentials.upload(companyCode, photo, signal);
    if (!result?.url || !result?.uploadToken) throw new Error("Chưa xác nhận được ảnh tải lên. Vui lòng chụp lại.");
    return { fileUrl: result.url, fileName: photo.name, fileMimeType: photo.mimeType, fileSize: photo.size, uploadToken: result.uploadToken };
  }
  const picked = await DocumentPicker.getDocumentAsync({ type: MIMES, multiple: false, copyToCacheDirectory: true });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  const file = new File(asset.uri);
  try {
    if (signal.aborted) throw new Error("Đã hủy tải tệp.");
    const size = file.size;
    const mimeType = contractFileMime(asset.name, size, "contract");
    if (!MIMES.includes(mimeType)) throw new Error("Chọn PDF, JPG, PNG hoặc WebP, tối đa 10 MB.");
    const content = await file.base64();
    if (signal.aborted) throw new Error("Đã hủy tải tệp.");
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
      if (asset.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
    } catch {}
  }
}
