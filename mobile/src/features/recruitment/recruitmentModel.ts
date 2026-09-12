import type {
  ApplicantOutcome,
  RecruitmentInterview,
  RecruitmentJob,
  RecruitmentJobStatus,
} from "../../../../src/types/recruitment";

export const WORKPLACE_LABELS: Record<string, string> = {
  onsite: "Tại chỗ",
  hybrid: "Kết hợp",
  remote: "Từ xa",
};

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Toàn thời gian",
  part_time: "Bán thời gian",
  contract: "Hợp đồng",
  intern: "Thực tập",
  temporary: "Thời vụ",
};

export function formatMoney(val?: number | null): string {
  if (val == null || val === 0) return "Thỏa thuận";
  if (val >= 1000000) {
    const millions = val / 1000000;
    return Number.isInteger(millions) ? `${millions} Tr` : `${millions.toFixed(1)} Tr`;
  }
  return val.toLocaleString("vi-VN") + " đ";
}

export function formatSalaryRange(job: RecruitmentJob): string {
  if (!job.showSalary) return "Lương thỏa thuận (kín)";
  if (!job.salaryMin && !job.salaryMax) return "Thỏa thuận";
  if (job.salaryMin && !job.salaryMax) return `Từ ${formatMoney(job.salaryMin)}`;
  if (!job.salaryMin && job.salaryMax) return `Đến ${formatMoney(job.salaryMax)}`;
  return `${formatMoney(job.salaryMin)} - ${formatMoney(job.salaryMax)}`;
}

export function formatDeadline(deadlineStr?: string | null): {
  text: string;
  isExpired: boolean;
  isNear: boolean;
} {
  if (!deadlineStr) return { text: "Không giới hạn", isExpired: false, isNear: false };
  const date = new Date(deadlineStr);
  const now = new Date();
  const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const dateStr = date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  if (diffDays < 0) return { text: `Hết hạn (${dateStr})`, isExpired: true, isNear: false };
  if (diffDays <= 5) return { text: `${diffDays} ngày nữa (${dateStr})`, isExpired: false, isNear: true };
  return { text: dateStr, isExpired: false, isNear: false };
}

export function getJobStatusBadgeInfo(
  jobStatus: string,
  isDeleted?: boolean,
): { label: string; bg: string; border: string; color: string } {
  if (isDeleted) {
    return { label: "Đã xóa", bg: "#fee2e2", border: "#fca5a5", color: "#b91c1c" };
  }
  switch (jobStatus) {
    case "open":
      return { label: "Đang tuyển", bg: "#ecfdf5", border: "#a7f3d0", color: "#047857" };
    case "draft":
      return { label: "Bản nháp", bg: "#fef3c7", border: "#fde68a", color: "#b45309" };
    case "paused":
      return { label: "Tạm dừng", bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" };
    case "closed":
      return { label: "Đã đóng", bg: "#f1f5f9", border: "#cbd5e1", color: "#475569" };
    default:
      return { label: jobStatus, bg: "#f8fafc", border: "#e2e8f0", color: "#64748b" };
  }
}

export const JOB_STATUS_CHOICES: { value: RecruitmentJobStatus; label: string }[] = [
  { value: "draft", label: "Bản nháp" },
  { value: "open", label: "Đang tuyển" },
  { value: "paused", label: "Tạm dừng" },
  { value: "closed", label: "Đã đóng" },
];

export const INTERVIEW_STATUS_CHOICES: { value: RecruitmentInterview["status"]; label: string }[] = [
  { value: "scheduled", label: "Đã lên lịch" },
  { value: "completed", label: "Đã hoàn thành" },
  { value: "cancelled", label: "Đã hủy" },
];

export const OUTCOME_CHOICES: { value: ApplicantOutcome; label: string }[] = [
  { value: "active", label: "Đang xử lý" },
  { value: "hired", label: "Đã tuyển" },
  { value: "rejected", label: "Từ chối" },
  { value: "withdrawn", label: "Đã rút hồ sơ" },
];

export const formatStatus = (value: RecruitmentJobStatus) =>
  JOB_STATUS_CHOICES.find((item) => item.value === value)?.label || value;

export const formatOutcome = (value: ApplicantOutcome) =>
  OUTCOME_CHOICES.find((item) => item.value === value)?.label || value;

export const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("vi-VN") : "—";

export const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export function dateOnly(value: string) {
  if (!value.trim()) return null;
  const date = new Date(`${value.trim()}T12:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Ngày không hợp lệ.");
  return date.toISOString();
}

export function dateTime(value: string) {
  if (!value.trim()) throw new Error("Vui lòng nhập thời gian.");
  const normalized = value.trim().replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error("Thời gian phải có dạng YYYY-MM-DD HH:mm.");
  return date.toISOString();
}

export function dateInput(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

export function dateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function numericOrNull(value: string, label: string) {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`${label} phải là số không âm.`);
  return number;
}
