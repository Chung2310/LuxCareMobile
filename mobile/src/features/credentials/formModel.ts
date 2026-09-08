import type { Credential } from "../../../../src/types/hrCredential";
import type { CredentialInput, CredentialList } from "../../../../src/services/hrCredentialService";
import { HR_CREDENTIAL_TYPES } from "../../../../shared/hr-credential";
export function credentialDraft(item?: Credential) {
  return {
    employeeId: item?.employeeId || "",
    name: item?.name || "",
    type: item?.type || "practice_certificate",
    credentialNumber: item?.credentialNumber || "",
    issuingOrganization: item?.issuingOrganization || "",
    issueDate: item?.issueDate?.slice(0, 10) || "",
    expiryDate: item?.expiryDate?.slice(0, 10) || "",
    professionalScope: item?.professionalScope || "",
    note: item?.note || "",
    reminderDays: String(item?.reminderDays ?? 30),
  };
}
export function credentialPayload(
  draft: ReturnType<typeof credentialDraft>,
  employees: CredentialList["employees"],
  original?: Credential,
): CredentialInput {
  if (
    !/^[a-f\d]{24}$/i.test(draft.employeeId) ||
    (draft.employeeId !== original?.employeeId && !employees.some((item) => item._id === draft.employeeId))
  )
    throw new Error("Chọn nhân viên trong danh sách.");
  const text = (value: string, min: number, max: number, label: string) => {
    const clean = value.trim();
    if (clean.length < min || clean.length > max) throw new Error(`${label}: từ ${min} đến ${max} ký tự.`);
    return clean;
  };
  const date = (value: string, old?: string | null) => {
    const clean = value.trim(),
      parsed = new Date(`${clean}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(clean) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== clean
    )
      throw new Error("Ngày phải tồn tại và có dạng YYYY-MM-DD.");
    return old && old.slice(0, 10) === clean ? old : parsed.toISOString();
  };
  const issueDate = date(draft.issueDate, original?.issueDate),
    expiryDate = draft.expiryDate.trim() ? date(draft.expiryDate, original?.expiryDate) : null;
  if (expiryDate && new Date(expiryDate) < new Date(issueDate))
    throw new Error("Ngày hết hạn không được trước ngày cấp.");
  const reminderDays = Number(draft.reminderDays);
  if (!Number.isInteger(reminderDays) || reminderDays < 1 || reminderDays > 365)
    throw new Error("Số ngày nhắc phải là số nguyên từ 1 đến 365.");
  if (!HR_CREDENTIAL_TYPES.includes(draft.type)) throw new Error("Loại chứng chỉ không hợp lệ.");
  return {
    employeeId: draft.employeeId,
    name: text(draft.name, 2, 300, "Tên chứng chỉ"),
    type: draft.type,
    credentialNumber: text(draft.credentialNumber, 0, 200, "Số hiệu"),
    issuingOrganization: text(draft.issuingOrganization, 2, 300, "Nơi cấp"),
    issueDate,
    expiryDate,
    professionalScope: text(draft.professionalScope, 0, 2000, "Phạm vi chuyên môn"),
    note: text(draft.note, 0, 2000, "Ghi chú"),
    reminderDays,
  };
}
export function credentialChanges(value: CredentialInput, original: Credential): Partial<CredentialInput> {
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key, item]) => item !== (original[key as keyof Credential] ?? (key === "expiryDate" ? null : "")),
    ),
  );
}
