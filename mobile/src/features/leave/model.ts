import type { LeaveApplication, RequestKind } from "../../../../src/types/leave";
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function leaveDateRange(start: string, end: string) {
  const valid = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) && localDay(new Date(`${value}T12:00:00`)) === value;
  if (!valid(start) || !valid(end)) throw new Error("Ngày phải có định dạng YYYY-MM-DD và là ngày hợp lệ.");
  if (end < start) throw new Error("Ngày kết thúc phải lớn hơn hoặc bằng ngày bắt đầu.");
  // Preserve the web form's local start/end-of-day contract.
  return { startDate: new Date(`${start}T00:00:00`).toISOString(), endDate: new Date(`${end}T23:59:59`).toISOString() };
}
export function filterLeavePage(items: LeaveApplication[], search: string, kind: RequestKind | "", status: string) {
  const query = search.trim().toLocaleLowerCase("vi-VN");
  return items.filter(
    (item) =>
      (!kind || item.requestKind === kind) &&
      (!status || item.status === status) &&
      (!query ||
        [item.employeeName, item.type, item.reason, item.rejectReason, item.note].some((value) =>
          value?.toLocaleLowerCase("vi-VN").includes(query),
        )),
  );
}
export function canDeleteLeave(item: LeaveApplication, user: { uid: string; role: string } | null) {
  return (
    item.status === "pending" && !!user && (item.employeeId === user.uid || ["admin", "superadmin"].includes(user.role))
  );
}
