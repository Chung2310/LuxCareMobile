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
    revision.effectiveLines.some(
      (line) => !line || typeof line.employeeId !== "string",
    )
  )
    throw new Error(
      "Chưa xác nhận được bản tính lương hoàn tất. Tải lại kỳ để kiểm tra kết quả.",
    );
  return { revisionId: id, employeeCount: revision.effectiveLines.length };
}

// Match the web: existing revisions use calculate; other runs use process,
// which synchronizes attendance, locks it, then calculates on the server.
export async function calculateLikeWeb(
  api: {
    calculateOperationalRun: (
      id: string,
      version: number,
      key: string,
    ) => Promise<any>;
    processPeriod: (period: string) => Promise<any>;
    getRun: (period: string) => Promise<PayrollRun>;
  },
  run: PayrollRun,
  key: string,
) {
  if (run.status !== "draft")
    throw new Error("Cần mở lại kỳ về nháp trước khi tính lương.");
  if (run.activeRevisionId) {
    const saved = await api.calculateOperationalRun(run._id, run.version!, key);
    return {
      ...calculationSummary(saved, run),
      runVersion: saved.runVersion as number,
    };
  }
  await api.processPeriod(run.periodKey);
  const saved = await api.getRun(run.periodKey);
  if (
    saved._id !== run._id ||
    saved.periodKey !== run.periodKey ||
    saved.status !== "draft" ||
    !Number.isSafeInteger(saved.version) ||
    saved.version! < run.version! ||
    saved.effectiveError ||
    !Array.isArray(saved.effectiveLines)
  ) {
    throw new Error(
      "Chưa xác nhận được bảng lương mới. Hãy tải lại kỳ để kiểm tra.",
    );
  }
  return {
    revisionId: "",
    employeeCount: saved.effectiveLines.length,
    runVersion: saved.version!,
  };
}
