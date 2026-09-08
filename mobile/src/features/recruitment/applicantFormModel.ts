import type { RecruitmentApplicant } from "../../../../src/types/recruitment";
import { publicLinkPatch } from "./publicLink";
import { customDashboardRange } from "../dashboard/range";
export function applicantDraft(item?: RecruitmentApplicant) {
  return {
    fullName: item?.fullName || "",
    cvUrl: item?.cvUrl || "",
    email: item?.email || "",
    phone: item?.phone || "",
    address: item?.address || "",
    experience: item?.experience || "",
    education: item?.education || "",
    skills: item?.skills?.join(", ") || "",
    expectedSalary: item?.expectedSalary == null ? "" : String(item.expectedSalary),
    source: item?.source || "",
    notes: item?.notes || "",
    birthDate: item?.birthDate?.slice(0, 10) || "",
    availableDate: item?.availableDate?.slice(0, 10) || "",
  };
}
export function applicantPayload(draft: ReturnType<typeof applicantDraft>, original?: RecruitmentApplicant) {
  if (!draft.fullName.trim()) throw new Error("Nhập họ tên ứng viên.");
  const email = draft.email.trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Email không hợp lệ.");
  const expectedSalary = draft.expectedSalary.trim() ? Number(draft.expectedSalary) : null;
  if (expectedSalary !== null && (!Number.isFinite(expectedSalary) || expectedSalary < 0))
    throw new Error("Lương mong muốn phải là số không âm.");
  const date = (value: string, previous?: string | null) => {
    const text = value.trim();
    if (!text) return null;
    customDashboardRange(text, text);
    return text === previous?.slice(0, 10) ? previous : `${text}T00:00:00.000Z`;
  };
  return {
    fullName: draft.fullName.trim(),
    ...publicLinkPatch("applicant", draft.cvUrl, original?.cvUrl),
    email,
    phone: draft.phone.trim(),
    address: draft.address.trim(),
    experience: draft.experience.trim(),
    education: draft.education.trim(),
    skills: draft.skills
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    expectedSalary,
    source: draft.source.trim(),
    notes: draft.notes.trim(),
    birthDate: date(draft.birthDate, original?.birthDate),
    availableDate: date(draft.availableDate, original?.availableDate),
  };
}
