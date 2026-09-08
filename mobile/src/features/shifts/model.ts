import type { ShiftInput, WorkShift } from "../../../../src/services/attendanceService";
import { customDashboardRange } from "../dashboard/range";
export const DAYS = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 0, label: "CN" },
];
export function shiftDraft(shift?: WorkShift): ShiftInput {
  return {
    code: shift?.code || "",
    name: shift?.name || "",
    color: shift?.color || "#0891b2",
    startTime: shift?.startTime || "08:00",
    endTime: shift?.endTime || "17:00",
    crossesMidnight: shift?.crossesMidnight || false,
    checkInFrom: shift?.checkInFrom || "",
    checkInUntil: shift?.checkInUntil || "",
    checkOutFrom: shift?.checkOutFrom || "",
    checkOutUntil: shift?.checkOutUntil || "",
    standardMinutes: shift?.standardMinutes,
    workingDays: shift?.workingDays || [1, 2, 3, 4, 5],
    allowedLateMinutes: shift?.allowedLateMinutes || 0,
    allowedEarlyLeaveMinutes: shift?.allowedEarlyLeaveMinutes || 0,
    isDefault: shift?.isDefault || false,
    isActive: shift?.isActive ?? true,
    breakPeriods: shift?.breakPeriods || [],
  };
}
export function shiftPayload(draft: ShiftInput): ShiftInput {
  const code = draft.code.trim().toUpperCase();
  const name = draft.name.trim();
  if (!/^[A-Z0-9_-]{1,30}$/.test(code) || !name || name.length > 100)
    throw new Error("Nhập mã ca hợp lệ (A-Z, số, _ hoặc -) và tên tối đa 100 ký tự.");
  const minutes = (value: string) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Error("Giờ phải đúng định dạng HH:mm.");
    const [h, m] = value.split(":").map(Number);
    return h * 60 + m;
  };
  const start = minutes(draft.startTime);
  const end = minutes(draft.endTime);
  const windows = {
    checkInFrom: draft.checkInFrom?.trim() || "",
    checkInUntil: draft.checkInUntil?.trim() || "",
    checkOutFrom: draft.checkOutFrom?.trim() || "",
    checkOutUntil: draft.checkOutUntil?.trim() || "",
  };
  for (const value of Object.values(windows)) if (value) minutes(value);
  if (
    draft.standardMinutes !== undefined &&
    (!Number.isInteger(draft.standardMinutes) || draft.standardMinutes < 1 || draft.standardMinutes > 1440)
  )
    throw new Error("Công chuẩn phải là số nguyên từ 1 đến 1440 phút.");
  const length = (end - start + 1440) % 1440;
  if (!length) throw new Error("Giờ bắt đầu và kết thúc không được trùng nhau.");
  if (!draft.workingDays.length) throw new Error("Chọn ít nhất một ngày làm việc.");
  for (const value of [draft.allowedLateMinutes, draft.allowedEarlyLeaveMinutes])
    if (!Number.isInteger(value) || value < 0 || value > 240) throw new Error("Độ trễ cho phép từ 0 đến 240 phút.");
  if (!/^#[0-9A-Fa-f]{6}$/.test(draft.color)) throw new Error("Màu phải có dạng #RRGGBB.");
  const intervals = (draft.breakPeriods || [])
    .map((item) => {
      if (!item.name.trim() || item.name.length > 80) throw new Error("Nhập tên giờ nghỉ tối đa 80 ký tự.");
      const from = (minutes(item.startTime) - start + 1440) % 1440;
      const to = (minutes(item.endTime) - start + 1440) % 1440;
      if (to <= from || to > length) throw new Error("Giờ nghỉ phải nằm trong ca và có kết thúc sau bắt đầu.");
      return { from, to, paid: item.paid };
    })
    .sort((a, b) => a.from - b.from);
  if (intervals.some((item, index) => index > 0 && item.from < intervals[index - 1].to))
    throw new Error("Các khoảng nghỉ không được chồng nhau.");
  if (intervals.reduce((sum, item) => sum + (item.paid ? 0 : item.to - item.from), 0) >= length)
    throw new Error("Ca cần có thời gian làm việc ngoài giờ nghỉ không lương.");
  const standardMinutes =
    draft.standardMinutes ?? length - intervals.reduce((sum, item) => sum + (item.paid ? 0 : item.to - item.from), 0);
  return { ...draft, ...windows, standardMinutes, code, name, crossesMidnight: end < start };
}
export function assignmentDates(start: string, end: string) {
  customDashboardRange(start, end || start);
  return { effectiveFrom: start, ...(end ? { effectiveTo: end } : {}) };
}
