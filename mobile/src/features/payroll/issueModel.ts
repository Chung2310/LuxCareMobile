import type { PayrollIssue } from "../../../../src/types/payrollIssue";
import type { PayrollRunLine } from "../../../../src/types/payrollRun";
export const issueSeverities: Record<string, string> = { blocking: "Lỗi chặn xử lý", warning: "Cảnh báo" };
export function filterPayrollIssues(
  items: PayrollIssue[],
  severity: string,
  search: string,
  employees: PayrollRunLine[],
) {
  const names = new Map(employees.map((item) => [item.employeeId, item.employeeName || ""]));
  const query = search.trim().toLocaleLowerCase("vi-VN");
  return items.filter(
    (item) =>
      (!severity || item.severity === severity) &&
      [item.code, item.message, item.employeeId, names.get(item.employeeId || ""), item.field, item.remediation]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("vi-VN")
        .includes(query),
  );
}
