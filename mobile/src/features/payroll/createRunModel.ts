import type { UserProfile } from "../../../../src/types/common";
import type { CreatePayrollRunInput, PayrollRun } from "../../../../src/types/payrollRun";
import { hasPermission } from "../../auth/access";
import { canReadPayrollRuns, validPayrollPeriod } from "./runModel";
export function canCreatePayrollRun(user: UserProfile | null, branchId: string | undefined) {
  return canReadPayrollRuns(user) && hasPermission(user, "payroll-period:manage") && !!branchId;
}
export function monthlyRunInput(period: string): CreatePayrollRunInput {
  if (!validPayrollPeriod(period)) throw new Error("Kỳ lương không hợp lệ. Nhập YYYY-MM.");
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { periodKey: period, startDate: `${period}-01`, endDate: `${period}-${days}`, type: "regular" };
}
export function validateCreatedRun(run: PayrollRun, period: string) {
  if (
    !run ||
    typeof run._id !== "string" ||
    !run._id ||
    run.periodKey !== period ||
    run.type !== "regular" ||
    run.status !== "draft"
  )
    throw new Error("Chưa xác nhận được kỳ nháp vừa tạo. Hãy tải lại trạng thái.");
}
