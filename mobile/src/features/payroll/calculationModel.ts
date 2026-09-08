import type { PayrollRun } from "../../../../src/types/payrollRun";
export function calculationSummary(value: unknown, run: PayrollRun) {
  const result = value as {
    runVersion?: number;
    revision?: {
      _id?: string;
      id?: string;
      runId?: string;
      status?: string;
      effectiveLines?: { employeeId?: string }[];
    };
  } | null;
  const revision = result?.revision;
  const id = revision?._id || revision?.id;
  if (
    !revision ||
    revision.runId !== run._id ||
    revision.status !== "completed" ||
    typeof id !== "string" ||
    !id ||
    result?.runVersion !== run.version! + 1 ||
    !Array.isArray(revision.effectiveLines) ||
    revision.effectiveLines.some((line) => !line || typeof line.employeeId !== "string")
  )
    throw new Error("Chưa xác nhận được bản tính lương hoàn tất. Tải lại kỳ để kiểm tra kết quả.");
  return { revisionId: id, employeeCount: revision.effectiveLines.length };
}
