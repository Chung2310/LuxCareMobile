import type { UserProfile } from "../../../../src/types/common";
import type { PayrollExportType } from "../../../../src/services/payrollService";
import { hasPermission } from "../../auth/access";
import { canReadRunPayments } from "./paymentModel";
export const exportLabels: Record<PayrollExportType, string> = {
  detailed: "Chi tiết lương",
  insurance: "Bảo hiểm",
  pit: "Thuế TNCN",
  bank_transfer: "Chuyển khoản",
};
export function canExportPayroll(user: UserProfile | null, status: string, type: PayrollExportType) {
  return (
    canReadRunPayments(user) &&
    ["closed", "paid"].includes(status) &&
    (type !== "bank_transfer" || hasPermission(user, "payroll-payment:manage"))
  );
}
