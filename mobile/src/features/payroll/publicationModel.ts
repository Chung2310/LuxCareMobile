import type { UserProfile } from "../../../../src/types/common";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { hasPermission } from "../../auth/access";
import { canReadPayrollRuns, effectiveRunLines } from "./runModel";
export function canPublishPayslips(user: UserProfile | null, run: PayrollRun) {
  return (
    canReadPayrollRuns(user) && hasPermission(user, "payroll-payment:manage") && ["closed", "paid"].includes(run.status)
  );
}
export function publicationEmployees(run: PayrollRun, selected: string[]) {
  const eligible = new Set(effectiveRunLines(run).map((line) => line.employeeId));
  const ids = [...new Set(selected)];
  if (!ids.length || ids.some((id) => !id || !eligible.has(id)))
    throw new Error("Chọn ít nhất một nhân viên thuộc bảng lương hiện tại.");
  return ids;
}
export function validatePublicationResponse(value: unknown, runId: string, ids: string[]) {
  if (!Array.isArray(value) || value.length !== ids.length) throw new Error("Kết quả phát hành chưa đầy đủ.");
  const received = new Set<string>();
  for (const doc of value) {
    if (
      !doc ||
      doc.runId !== runId ||
      doc.status !== "published" ||
      !ids.includes(doc.employeeId) ||
      received.has(doc.employeeId)
    )
      throw new Error("Kết quả phát hành không khớp yêu cầu.");
    received.add(doc.employeeId);
  }
}
