import type { UserProfile } from "../../../../src/types/common";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { hasPermission } from "../../auth/access";
import { canReadPayslips } from "./model";
export function canReadPayrollRuns(user: UserProfile | null) {
  return canReadPayslips(user) && hasPermission(user, "payroll-period:read");
}
export function validPayrollPeriod(value: string) {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value) && Number(value.slice(0, 4)) >= 1900;
}
export function effectiveRunLines(run: PayrollRun) {
  if (run.effectiveError || !Array.isArray(run.effectiveLines))
    throw new Error(
      run.effectiveError?.message ||
        "Chưa xác nhận được số liệu kỳ lương. Vui lòng tải lại hoặc kiểm tra trên LuxCare web.",
    );
  return run.effectiveLines;
}
export const runStatuses: Record<string, string> = {
  draft: "Nháp",
  calculated: "Đã tính",
  review: "Kiểm tra",
  closed: "Đã chốt",
  paid: "Đã thanh toán",
};
