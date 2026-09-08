import type { PayrollRun } from "../../../../src/types/payrollRun";
export function validateReviewedRun(value: unknown, original: PayrollRun) {
  const run = value as PayrollRun | null;
  if (
    !run ||
    run._id !== original._id ||
    run.periodKey !== original.periodKey ||
    run.status !== "review" ||
    run.version !== original.version! + 1
  )
    throw new Error("Chưa xác nhận được kỳ đã chuyển sang kiểm tra. Hãy tải lại trạng thái.");
}
