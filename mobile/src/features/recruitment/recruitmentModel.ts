import type {
  ApplicantOutcome,
  RecruitmentInterview,
  RecruitmentJobStatus,
} from "../../../../src/types/recruitment";

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
