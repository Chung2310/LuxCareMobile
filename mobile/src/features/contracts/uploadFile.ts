import { readPickedFileAsBase64 } from "../../files/readBase64";
import type { UploadProgressHandler } from "../../components/UploadProgress";
import { captureDocumentPhoto } from "../../files/captureDocumentPhoto";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import type { ContractScope, ContractUploadKind } from "../../../../src/services/hrContractService";
import { contracts } from "../../api/services";
import { CONTRACT_MIMES, contractFileMime, type ContractUpload } from "./uploadModel";
export async function pickContractFile(scope: ContractScope, kind: ContractUploadKind, source: "file" | "camera" = "file", onProgress?: UploadProgressHandler, signal?: AbortSignal): Promise<ContractUpload | null> {
  if (signal?.aborted) return null;
  const upload = (value: Parameters<typeof contracts.upload>[1]) => signal
    ? contracts.upload(scope, value, signal)
    : contracts.upload(scope, value);
  if (source === "camera") {
    const photo = await captureDocumentPhoto(signal);
    if (!photo || signal?.aborted) return null;
    onProgress?.({ stage: "uploading", name: photo.name });
    const result = await upload({ ...photo, kind });
    if (signal?.aborted) return null;
    if (!result?.url || !result?.uploadToken) throw new Error("Chưa xác nhận được ảnh tải lên. Vui lòng chụp lại.");
    return { ...result, name: photo.name, mimeType: photo.mimeType, size: photo.size };
  }
  const signed = kind === "signed";
  const picked = await DocumentPicker.getDocumentAsync({
    type: Object.values(CONTRACT_MIMES).filter((type) => !signed || type.startsWith("image/")),
    multiple: false,
    copyToCacheDirectory: true,
    base64: false,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset) throw new Error("Không đọc được tệp đã chọn. Vui lòng chọn lại.");
  const file = asset.file ? null : new File(asset.uri);
  try {
    if (signal?.aborted) return null;
    onProgress?.({ stage: "preparing", name: asset.name });
    const size = asset.file ? asset.file.size : file!.size,
      mimeType = contractFileMime(asset.name, size, kind);
    const content = asset.file ? await readBrowserFile(asset.file) : await readPickedFileAsBase64(asset.uri, asset.name);
    if (signal?.aborted) return null;
    onProgress?.({ stage: "uploading", name: asset.name });
    const result = await upload({
      file: `data:${mimeType};base64,${content}`,
      name: asset.name,
      mimeType,
      size,
      kind,
    });
    if (!result?.url || !result?.uploadToken) throw new Error("Chưa xác nhận được tệp tải lên. Vui lòng chọn lại.");
    if (signal?.aborted) return null;
    return { ...result, name: asset.name, mimeType, size };
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
