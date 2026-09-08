import type { UserProfile } from "../../../../src/types/common";
import type { PayrollPayment } from "../../../../src/types/payrollPayment";
import { hasPermission } from "../../auth/access";
import { canReadPayrollRuns } from "./runModel";
export function canReadRunPayments(user: UserProfile | null) {
  return canReadPayrollRuns(user) && hasPermission(user, "payroll-payment:read");
}
export const paymentStatuses = {
  draft: "Nháp",
  confirmed: "Đã xác nhận",
  cancelled: "Đã hủy",
  reversed: "Đã đảo thanh toán",
};
export function confirmedPaymentTotal(items: PayrollPayment[]) {
  return items
    .filter((item) => item.status === "confirmed")
    .reduce((sum, item) => sum + (Number.isFinite(item.amount) ? item.amount : NaN), 0);
}
