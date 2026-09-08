import type { UserProfile } from "../../../../src/types/common";
import type { PayrollPayment } from "../../../../src/types/payrollPayment";
import { hasPermission } from "../../auth/access";
import { canReadRunPayments } from "./paymentModel";
import { validAllocation } from "./confirmPaymentModel";

export type UndoPaymentAction = "cancel" | "reverse";
export function canUndoPayment(
  user: UserProfile | null,
  branchId: string | undefined,
  runId: string,
  runStatus: string,
  payment: PayrollPayment,
  action: UndoPaymentAction,
) {
  if (
    !canReadRunPayments(user) ||
    !hasPermission(user, "payroll-payment:manage") ||
    !branchId ||
    !payment._id ||
    payment.runId !== runId
  )
    return false;
  return action === "cancel"
    ? payment.status === "draft"
    : payment.status === "confirmed" && ["closed", "paid"].includes(runStatus) && validAllocation(payment);
}
export function validateUndonePayment(value: unknown, original: PayrollPayment, action: UndoPaymentAction) {
  const payment = value as PayrollPayment | null;
  const lines = original.lines ?? [];
  if (
    !payment ||
    payment._id !== original._id ||
    payment.runId !== original.runId ||
    payment.amount !== original.amount ||
    payment.status !== (action === "cancel" ? "cancelled" : "reversed") ||
    !Array.isArray(payment.lines ?? []) ||
    (payment.lines ?? []).length !== lines.length ||
    lines.some(
      (line, index) =>
        !line ||
        payment.lines?.[index]?.employeeId !== line.employeeId ||
        payment.lines?.[index]?.amount !== line.amount,
    )
  )
    throw new Error("Kết quả hủy/đảo thanh toán chưa khớp khoản đã chọn. Tải lại để kiểm tra.");
}
