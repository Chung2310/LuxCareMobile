import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import type { ContractScope, ContractUploadKind } from "../../../../src/services/hrContractService";
import { contracts } from "../../api/services";
import { CONTRACT_MIMES, contractFileMime, type ContractUpload } from "./uploadModel";
export async function pickContractFile(scope: ContractScope, kind: ContractUploadKind): Promise<ContractUpload | null> {
  const signed = kind === "signed" || kind === "extensionSigned";
  const picked = await DocumentPicker.getDocumentAsync({
    type: Object.values(CONTRACT_MIMES).filter((type) => !signed || type.startsWith("image/")),
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0],
    file = new File(asset.uri);
  try {
    const size = file.size,
      mimeType = contractFileMime(asset.name, size, kind);
    const content = await file.base64();
    const result = await contracts.upload(scope, {
      file: `data:${mimeType};base64,${content}`,
      name: asset.name,
      mimeType,
      size,
      kind,
    });
    if (!result?.url || !result?.uploadToken) throw new Error("Chưa xác nhận được tệp tải lên. Vui lòng chọn lại.");
    return { ...result, name: asset.name, mimeType, size };
  } finally {
    try {
      if (asset.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
    } catch {}
  }
}
