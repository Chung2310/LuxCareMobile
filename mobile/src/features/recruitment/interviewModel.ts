import type { RecruitmentInterview } from "../../../../src/types/recruitment";
import { customDashboardRange } from "../dashboard/range";
import { deadlineText } from "./jobModel";
export const INTERVIEW_STATUSES = [
  { value: "scheduled", label: "Đã lên lịch" },
  { value: "completed", label: "Hoàn tất" },
  { value: "cancelled", label: "Đã hủy" },
];
export function interviewDraft(item?: RecruitmentInterview) {
  return {
    start: deadlineText(item?.scheduledStart),
    end: deadlineText(item?.scheduledEnd),
    format: item?.format || "onsite",
    location: item?.location || "",
    meetingLink: item?.meetingLink || "",
    status: item?.status || "scheduled",
    result: item?.result || "",
    notes: item?.notes || "",
  };
}
export function interviewPayload(draft: ReturnType<typeof interviewDraft>, original?: RecruitmentInterview) {
  const date = (value: string, previous?: string) => {
    const text = value.trim();
    if (!/^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d$/.test(text))
      throw new Error("Nhập thời gian YYYY-MM-DD HH:mm theo giờ Việt Nam.");
    customDashboardRange(text.slice(0, 10), text.slice(0, 10));
    return previous && text === deadlineText(previous)
      ? previous
      : new Date(`${text.replace(" ", "T")}:00+07:00`).toISOString();
  };
  const scheduledStart = date(draft.start, original?.scheduledStart),
    scheduledEnd = date(draft.end, original?.scheduledEnd);
  if (Date.parse(scheduledEnd) <= Date.parse(scheduledStart)) throw new Error("Giờ kết thúc phải sau giờ bắt đầu.");
  const meetingLink = draft.meetingLink.trim();
  if (meetingLink) {
    let valid = false;
    try {
      valid = ["https:", "http:"].includes(new URL(meetingLink).protocol);
    } catch {}
    if (!valid) throw new Error("Liên kết cuộc họp phải là địa chỉ HTTP/HTTPS hợp lệ.");
  }
  return {
    scheduledStart,
    scheduledEnd,
    format: draft.format,
    location: draft.location.trim(),
    meetingLink,
    status: draft.status,
    result: draft.result.trim(),
    notes: draft.notes.trim(),
  };
}
