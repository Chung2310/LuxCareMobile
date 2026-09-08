import type { CalendarItem } from "../../../../src/services/hrCalendarService";
import { validateKpiPeriod } from "../../../../src/services/monthlyKpiService";
export const EVENT_TYPES = [
  { value: "all", label: "Tất cả loại" },
  { value: "event", label: "Sự kiện" },
  { value: "leave", label: "Nghỉ phép" },
  { value: "wfh", label: "Làm tại nhà" },
  { value: "exception", label: "Ngoại lệ" },
  { value: "reminder", label: "Nhắc việc" },
];
export function calendarEvents(items: CalendarItem[], period: string, type: string, query: string, uid?: string) {
  validateKpiPeriod(period);
  const [year, month] = period.split("-").map(Number);
  const from = Date.parse(`${period}-01T00:00:00+07:00`);
  const until = Date.UTC(year, month, 1) - 7 * 60 * 60 * 1000;
  const search = query.trim().toLocaleLowerCase("vi");
  return items
    .filter((item) => {
      if (item.status === "pending" || (type !== "all" && item.type !== type)) return false;
      const start = Date.parse(item.startDate);
      const end = Date.parse(item.endDate);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || start >= until || end < from) return false;
      if (uid && ![item.employeeId, item.assigneeId, item.creatorId].includes(uid)) return false;
      return `${item.title} ${item.description || ""} ${item.employeeName || ""}`
        .toLocaleLowerCase("vi")
        .includes(search);
    })
    .sort((a, b) => Date.parse(a.startDate) - Date.parse(b.startDate));
}
