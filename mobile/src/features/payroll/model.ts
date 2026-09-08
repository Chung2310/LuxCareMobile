import type { UserProfile } from "../../../../src/types/common";
import type { Payslip } from "../../../../src/types/payslip";
import { canUseModule } from "../../auth/access";
export function canReadPayslips(user: UserProfile | null) {
  return !!user?.companyCode && canUseModule(user, "hr");
}
export function payslipsForPeriod(items: Payslip[], period: string) {
  return items
    .filter((item) => !period || item.periodKey === period)
    .slice()
    .sort((a, b) => (b.periodKey || "").localeCompare(a.periodKey || ""));
}
export function payslipMoney(value: number) {
  return Number.isFinite(value)
    ? new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value)
    : "—";
}
