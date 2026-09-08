import type { PayrollAdjustment } from "../../../../src/types/payrollAdjustment";
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
