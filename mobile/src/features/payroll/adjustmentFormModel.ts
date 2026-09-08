import type { PayrollAdjustmentInput } from "../../../../src/types/payrollAdjustment";
export function adjustmentInput(
  employeeId: string,
  employeeIds: string[],
  kind: string,
  amount: string,
  reason: string,
): PayrollAdjustmentInput {
  if (!/^[a-f\d]{24}$/i.test(employeeId) || !employeeIds.includes(employeeId))
    throw new Error("Chọn nhân viên trong danh sách chi nhánh.");
  if (!["allowance", "bonus", "deduction", "correction"].includes(kind))
    throw new Error("Loại điều chỉnh không hợp lệ.");
  const cleanAmount = amount.trim();
  if (!/^\d+$/.test(cleanAmount) || !Number.isSafeInteger(Number(cleanAmount)))
    throw new Error("Nhập số tiền VND nguyên không âm, không có dấu phân cách.");
  const cleanReason = reason.trim();
  if (!cleanReason || cleanReason.length > 2000) throw new Error("Lý do cần từ 1 đến 2000 ký tự.");
  return { employeeId, kind: kind as PayrollAdjustmentInput["kind"], amount: Number(cleanAmount), reason: cleanReason };
}
