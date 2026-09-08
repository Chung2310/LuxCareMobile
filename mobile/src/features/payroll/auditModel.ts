import type { PayrollAudit } from "../../../../src/types/payrollAudit";
export const auditActions: Record<string, string> = {
  snapshot: "Chụp dữ liệu kỳ",
  lock: "Khóa kỳ",
  calculate: "Tính lương",
  approve: "Duyệt kỳ",
  close: "Chốt kỳ",
  adjustment: "Duyệt điều chỉnh",
  adjustment_rejected: "Từ chối điều chỉnh",
  reset: "Đặt lại kỳ",
  create_run: "Tạo bảng lương",
  sync_attendance: "Đồng bộ công",
  lock_attendance: "Khóa công",
  review: "Chuyển kiểm tra",
  reject: "Từ chối",
  reopen: "Mở lại kỳ",
  mark_paid: "Đánh dấu đã trả",
  payment: "Thanh toán",
  effective_snapshot_repaired: "Sửa bản dữ liệu kỳ",
};
export function filterPayrollAudit(items: PayrollAudit[], action: string, search: string) {
  const query = search.trim().toLocaleLowerCase("vi-VN");
  return items.filter(
    (item) =>
      (!action || item.action === action) &&
      `${item.actorId} ${item.action} ${auditActions[item.action] || ""}`.toLocaleLowerCase("vi-VN").includes(query),
  );
}
export function auditTime(value?: string) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "—";
  return new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}
