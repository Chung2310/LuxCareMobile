import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { randomUUID } from "expo-crypto";
import { api, recruitment } from "../../api/services";
import { RECRUITMENT_MIMES, recruitmentFileType } from "./fileModel";
import type { RecruitmentPublicFile } from "../../../../src/types/recruitment";
export async function uploadPublicRecruitmentFile(): Promise<RecruitmentPublicFile | null> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: Object.values(RECRUITMENT_MIMES),
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return null;
  const asset = picked.assets[0],
    file = new File(asset.uri);
  try {
    const type = recruitmentFileType(asset.name, file.size);
    const form = new FormData();
    form.append("file", { uri: asset.uri, name: asset.name, type } as unknown as Blob);
    const response = await api.transport.fetch("/api/v1/recruitment/files/public", { method: "POST", body: form });
    const body = await response.json();
    const result = body.data ?? body;
    if (!result?.url || !result?.publicId) throw new Error("Chưa xác nhận được tệp đã tải lên. Vui lòng thử lại.");
    return result;
  } finally {
    try {
      if (asset.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
    } catch {}
  }
}
export async function uploadRecruitmentFile(kind: "job" | "applicant", id: string, version?: number) {
  const picked = await DocumentPicker.getDocumentAsync({
    type: Object.values(RECRUITMENT_MIMES),
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (picked.canceled) return false;
  const asset = picked.assets[0],
    file = new File(asset.uri);
  try {
    const type = recruitmentFileType(asset.name, file.size);
    const form = new FormData();
    form.append("file", { uri: asset.uri, name: asset.name, type } as unknown as Blob);
    if (version !== undefined) form.append("version", String(version));
    await api.transport.fetch(
      `/api/v1/recruitment/${kind === "job" ? "jobs" : "applicants"}/${encodeURIComponent(id)}/attachment`,
      { method: "POST", body: form },
    );
    return true;
  } finally {
    try {
      if (asset.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
    } catch {}
  }
}
export async function shareRecruitmentFile(id: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error("Thiết bị chưa hỗ trợ chia sẻ tệp.");
  const metadata = await recruitment.downloadAttachment(id);
  const url = new URL(metadata.signedUrl);
  if (url.protocol !== "https:") throw new Error("Liên kết tải tệp phải dùng HTTPS.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) throw new Error("Không tải được tệp. Vui lòng tải lại để lấy liên kết mới.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    recruitmentFileType(metadata.originalName, bytes.length);
    const name = metadata.originalName.replace(/[^\p{L}\p{N}._-]/gu, "_").slice(-120);
    const file = new File(Paths.cache, `${randomUUID()}-${name}`);
    file.write(bytes);
    await Sharing.shareAsync(file.uri, { dialogTitle: metadata.originalName });
  } finally {
    clearTimeout(timer);
  }
}
