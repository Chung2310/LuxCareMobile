import type { PayrollRun } from "../../../../src/types/payrollRun";
import type { UserProfile } from "../../../../src/types/common";
import { canCreatePayrollRun } from "./createRunModel";
export function canClosePayrollRun(
  user: UserProfile | null,
  branchId: string | undefined,
  run: PayrollRun,
) {
  return (
    canCreatePayrollRun(user, branchId) &&
    run.status === "review" &&
    Number.isSafeInteger(run.version) &&
    run.version! >= 0
  );
}
export function validateClosedRun(value: unknown, original: PayrollRun) {
  const run = value as PayrollRun | null;
  if (
    !run ||
    run._id !== original._id ||
    run.periodKey !== original.periodKey ||
    run.status !== "closed" ||
    run.version !== original.version! + (original.activeRevisionId ? 1 : 0)
  )
    throw new Error("Chưa xác nhận được kỳ đã chốt. Hãy tải lại trạng thái.");
}
export function validateReviewedRun(value: unknown, original: PayrollRun) {
  const run = value as PayrollRun | null;
  if (
    !run ||
    run._id !== original._id ||
    run.periodKey !== original.periodKey ||
    run.status !== "review" ||
    run.version !== original.version! + 1
  )
    throw new Error(
      "Chưa xác nhận được kỳ đã chuyển sang kiểm tra. Hãy tải lại trạng thái.",
    );
}

export function hasPayrollCalculation(run: PayrollRun) {
  if (run.effectiveError) return false;
  if (!run.activeRevisionId)
    return Array.isArray(run.effectiveLines) && run.effectiveLines.length > 0;
  return (
    typeof run.activeRevisionId === "string" &&
    !!run.activeRevisionId.trim() &&
    typeof run.activeRevisionChecksum === "string" &&
    !!run.activeRevisionChecksum.trim()
  );
}
