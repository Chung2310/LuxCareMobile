import type { PayrollAdjustment } from "../../../../src/types/payrollAdjustment";
import type { UserProfile } from "../../../../src/types/common";
import { hasPermission } from "../../auth/access";
import { canReadPayrollRuns } from "./runModel";
export function canDecideAdjustment(user: UserProfile | null, item: PayrollAdjustment) {
  return canReadPayrollRuns(user) && hasPermission(user, "payroll-period:manage") && item.status === "pending";
}
export function validateAdjustmentDecision(saved: PayrollAdjustment, item: PayrollAdjustment, approve: boolean) {
  if (
    !saved ||
    saved._id !== item._id ||
    saved.periodKey !== item.periodKey ||
    saved.status !== (approve ? "approved" : "rejected")
  )
    throw new Error("Chưa xác nhận được kết quả xử lý điều chỉnh.");
}
export const adjustmentKinds = {
  allowance: "Phụ cấp",
  bonus: "Thưởng",
  deduction: "Khấu trừ",
  correction: "Điều chỉnh khác",
};
export const adjustmentStatuses = {
  draft: "Nháp",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  snapshotted: "Đã đưa vào bản tính lương",
};
export function filterAdjustments(items: PayrollAdjustment[], search: string, status: string, kind: string) {
  const query = search.trim().toLocaleLowerCase("vi-VN");
  return items.filter(
    (item) =>
      (!status || item.status === status) &&
      (!kind || item.kind === kind) &&
      `${item.employeeName || ""} ${item.employeeId} ${item.reason}`.toLocaleLowerCase("vi-VN").includes(query),
  );
}
