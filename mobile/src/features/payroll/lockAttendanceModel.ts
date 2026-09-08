import type { PayrollRun } from "../../../../src/types/payrollRun";
export function lockedAttendanceSummary(value: unknown, run: PayrollRun, expectedVersion: number) {
  const response = value as {
    run?: PayrollRun;
    snapshot?: { _id?: string; runId?: string; periodKey?: string; lockedAt?: string; employees?: unknown[] };
  } | null;
  const snapshot = response?.snapshot;
  if (
    response?.run?._id !== run._id ||
    response.run.periodKey !== run.periodKey ||
    response.run.status !== "draft" ||
    response.run.version !== expectedVersion + 1 ||
    !snapshot ||
    typeof snapshot._id !== "string" ||
    !snapshot._id ||
    snapshot.runId !== run._id ||
    snapshot.periodKey !== run.periodKey ||
    !Array.isArray(snapshot.employees) ||
    typeof snapshot.lockedAt !== "string" ||
    !Number.isFinite(Date.parse(snapshot.lockedAt))
  )
    throw new Error("Chưa xác nhận được bản công đã khóa. Hãy tải lại kỳ lương.");
  return { snapshotId: snapshot._id, employeeCount: snapshot.employees.length };
}
