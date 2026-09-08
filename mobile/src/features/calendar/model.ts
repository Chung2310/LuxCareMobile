import type { UserProfile } from "../../../../src/types/common";
import type { WorkCalendarDay, WorkCalendarDayType } from "../../../../src/services/companyWorkCalendarService";
import { canUseModule, hasPermission } from "../../auth/access";
import { customDashboardRange } from "../dashboard/range";
export function calendarAccess(user: UserProfile | null) {
  const read = canUseModule(user, "hr") && !!user?.companyCode && ["admin", "superadmin"].includes(user.role);
  return { read, write: read && hasPermission(user, "timekeeping:manage") };
}
export const DAY_TYPES = [
  { value: "holiday", label: "Nghỉ lễ" },
  { value: "substitute_holiday", label: "Nghỉ bù" },
  { value: "working_override", label: "Làm bù" },
];
export function calendarInput(date: string, name: string, dayType: WorkCalendarDayType) {
  customDashboardRange(date, date);
  if (!name.trim() || name.trim().length > 200) throw new Error("Tên ngày cần từ 1 đến 200 ký tự.");
  if (!DAY_TYPES.some((item) => item.value === dayType)) throw new Error("Loại ngày không hợp lệ.");
  return { date, name: name.trim(), dayType };
}
export function calendarToggle(day: WorkCalendarDay, reason: string) {
  if (day.isApplied && !reason.trim()) throw new Error("Nhập lý do tắt áp dụng.");
  return day.isApplied ? { isApplied: false, adminReason: reason.trim() } : { isApplied: true };
}
