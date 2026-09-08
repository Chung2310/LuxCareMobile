import type { RecruitmentJob } from "../../../../src/types/recruitment";
import { publicLinkPatch } from "./publicLink";
import { customDashboardRange } from "../dashboard/range";
export function deadlineText(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  return new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16).replace("T", " ");
}
export function jobDraft(job?: RecruitmentJob) {
  return {
    code: job?.code || "",
    jdFileUrl: job?.jdFileUrl || "",
    title: job?.title || "",
    department: job?.department || "",
    headcount: String(job?.headcount ?? 1),
    description: job?.description || "",
    requirements: job?.requirements || "",
    benefits: job?.benefits || "",
    salaryMin: job?.salaryMin == null ? "" : String(job.salaryMin),
    salaryMax: job?.salaryMax == null ? "" : String(job.salaryMax),
    showSalary: job?.showSalary || false,
    employmentType: job?.employmentType || "full_time",
    workplaceType: job?.workplaceType || "onsite",
    location: job?.location || "",
    deadline: deadlineText(job?.applicationDeadline),
  };
}
export function jobPayload(
  draft: ReturnType<typeof jobDraft>,
  job?: RecruitmentJob,
  now = Date.now(),
): Partial<RecruitmentJob> {
  const code = draft.code.trim().toUpperCase();
  if (!code) throw new Error("Nhập mã tin tuyển dụng.");
  const headcount = Number(draft.headcount);
  if (!Number.isInteger(headcount) || headcount < 1) throw new Error("Số lượng tuyển phải là số nguyên dương.");
  const salary = (value: string) => {
    if (!value.trim()) return null;
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) throw new Error("Lương phải là số không âm.");
    return amount;
  };
  const salaryMin = salary(draft.salaryMin),
    salaryMax = salary(draft.salaryMax);
  if (salaryMin !== null && salaryMax !== null && salaryMin > salaryMax)
    throw new Error("Lương tối đa không được nhỏ hơn tối thiểu.");
  const deadline = draft.deadline.trim();
  let applicationDeadline: string | null = null;
  if (deadline) {
    if (!/^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d$/.test(deadline))
      throw new Error("Hạn nộp phải có dạng YYYY-MM-DD HH:mm (giờ Việt Nam).");
    customDashboardRange(deadline.slice(0, 10), deadline.slice(0, 10));
    applicationDeadline =
      deadline === deadlineText(job?.applicationDeadline)
        ? job!.applicationDeadline!
        : new Date(`${deadline.replace(" ", "T")}:00+07:00`).toISOString();
  }
  const result = {
    ...publicLinkPatch("job", draft.jdFileUrl, job?.jdFileUrl),
    code,
    title: draft.title.trim(),
    department: draft.department.trim(),
    headcount,
    description: draft.description.trim(),
    requirements: draft.requirements.trim(),
    benefits: draft.benefits.trim(),
    salaryMin,
    salaryMax,
    showSalary: draft.showSalary,
    employmentType: draft.employmentType.trim(),
    workplaceType: draft.workplaceType,
    location: draft.location.trim(),
    applicationDeadline,
    status: job?.status || ("draft" as const),
  };
  if (!result.employmentType) throw new Error("Nhập loại hợp đồng tuyển dụng.");
  if (
    result.status === "open" &&
    (!result.title ||
      !result.description ||
      !result.requirements ||
      !result.location ||
      !applicationDeadline ||
      Date.parse(applicationDeadline) <= now)
  )
    throw new Error(
      "Tin đang tuyển cần tiêu đề, mô tả, yêu cầu, địa điểm và hạn nộp trong tương lai. Có thể tạm dừng tin trước khi sửa.",
    );
  return result;
}
