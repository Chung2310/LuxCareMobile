import type { PayrollRun } from "../../../../src/types/payrollRun";
import type { UserProfile } from "../../../../src/types/common";
import { canCreatePayrollRun } from "./createRunModel";
export function canReopenPayrollRun(user: UserProfile | null, branchId: string | undefined, run: PayrollRun) {
  return (
    canCreatePayrollRun(user, branchId) &&
    ["review", "closed"].includes(run.status) &&
    Number.isSafeInteger(run.version) &&
    run.version! >= 0
  );
}
export function reopenPayload(run: PayrollRun, reason: string) {
  const value = reason.trim();
  if (!value || value.length > 1000) throw new Error("Nhập lý do mở lại từ 1 đến 1000 ký tự.");
  if (!["review", "closed"].includes(run.status) || !Number.isSafeInteger(run.version) || run.version! < 0)
    throw new Error("Kỳ hoặc phiên bản không hợp lệ để mở lại.");
  return { expectedVersion: run.version!, reason: value };
}
export function validateReopenedRun(value: unknown, original: PayrollRun) {
  const run = value as PayrollRun | null;
  if (
    !run ||
    run._id !== original._id ||
    run.periodKey !== original.periodKey ||
    run.status !== "draft" ||
    run.version !== original.version! + 1
  )
    throw new Error("Chưa xác nhận được kỳ đã mở lại. Hãy tải lại trạng thái.");
}
