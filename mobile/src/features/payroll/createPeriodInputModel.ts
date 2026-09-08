import type { UserProfile } from "../../../../src/types/common";
import type { PeriodInput } from "./periodInputModel";
import { validPayrollPeriod } from "./runModel";
export function periodInputCandidates(
  employees: UserProfile[],
  existing: PeriodInput[],
  companyCode: string,
  branchId: string,
) {
  const seen = new Set(existing.map((item) => item.employeeId));
  return employees.filter((employee) => {
    if (
      !employee.uid ||
      employee.branchId !== branchId ||
      (employee.companyCode && employee.companyCode !== companyCode) ||
      seen.has(employee.uid)
    )
      return false;
    seen.add(employee.uid);
    return true;
  });
}
export function newPeriodInput(employeeId: string, period: string, candidates: UserProfile[]): PeriodInput {
  if (!validPayrollPeriod(period) || !candidates.some((employee) => employee.uid === employeeId))
    throw new Error("Chọn nhân viên chưa có đối soát trong chi nhánh và kỳ hợp lệ.");
  return { employeeId, periodKey: period, version: 0 };
}
