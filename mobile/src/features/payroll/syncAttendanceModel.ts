import type { UserProfile } from "../../../../src/types/common";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { canCreatePayrollRun } from "./createRunModel";
export function canSyncRunAttendance(user: UserProfile | null, branchId: string | undefined, run: PayrollRun) {
  return (
    canCreatePayrollRun(user, branchId) &&
    run.status === "draft" &&
    Number.isSafeInteger(run.version) &&
    run.version! >= 0
  );
}
export function syncAttendanceSummary(value: unknown, run: PayrollRun, key: string) {
  const response = value as {
    runVersion?: number;
    job?: {
      runId?: string;
      operation?: string;
      idempotencyKey?: string;
      status?: string;
      payload?: { expectedVersion?: number };
      result?: { employeeCount?: number; blockingIssueCount?: number };
    };
  } | null;
  const job = response?.job;
  const result = job?.result;
  if (
    !job ||
    job.runId !== run._id ||
    job.operation !== "sync-attendance" ||
    job.idempotencyKey !== key ||
    job.status !== "succeeded" ||
    job.payload?.expectedVersion !== run.version ||
    response?.runVersion !== run.version! + 1 ||
    !Number.isSafeInteger(result?.employeeCount) ||
    result!.employeeCount! < 0 ||
    !Number.isSafeInteger(result?.blockingIssueCount) ||
    result!.blockingIssueCount! < 0
  )
    throw new Error("Chưa xác nhận được kết quả đồng bộ công. Hãy tải lại kỳ lương.");
  return { employeeCount: result!.employeeCount!, blockingIssueCount: result!.blockingIssueCount! };
}
