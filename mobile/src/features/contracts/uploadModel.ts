import type { ContractFileFields, ContractUploadKind } from "../../../../src/services/hrContractService";
export interface ContractUpload {
  url: string;
  uploadToken: string;
  name: string;
  mimeType: string;
  size: number;
}
export type ContractUploads = Partial<Record<ContractUploadKind, ContractUpload>>;
export const CONTRACT_MIMES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};
export function contractFileMime(name: string, size: number, kind: ContractUploadKind) {
  if (!name.trim() || name.length > 300) throw new Error("Tên tệp cần từ 1 đến 300 ký tự.");
  if (!Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024)
    throw new Error("Tệp phải có nội dung và tối đa 10 MB.");
  const type = CONTRACT_MIMES[name.toLowerCase().split(".").pop() || ""];
  if (!type || ((kind === "signed" || kind === "extensionSigned") && !type.startsWith("image/")))
    throw new Error("Chọn PDF/DOC/DOCX hoặc ảnh; bản đã ký cần là ảnh PNG/JPG/GIF/WebP.");
  return type;
}
export function contractUploadFields(uploads: ContractUploads): ContractFileFields {
  const result: Record<string, string | number> = {};
  for (const [kind, file] of Object.entries(uploads)) {
    if (!file) continue;
    const prefix = kind === "contract" ? "contractFile" : kind === "extension" ? "extensionFile" : "signedImage";
    const token = kind === "extensionSigned" ? "extensionSignedImageUploadToken" : `${prefix}UploadToken`;
    if (!file.url || !file.uploadToken) throw new Error("Tệp thiếu token upload. Chọn lại tệp trước khi lưu.");
    Object.assign(result, {
      [`${prefix}Url`]: file.url,
      [`${prefix}Name`]: file.name,
      [`${prefix}MimeType`]: file.mimeType,
      [`${prefix}Size`]: file.size,
      [token]: file.uploadToken,
    });
  }
  return result;
}
