import type { UserProfile } from "../../../../src/types/common";
import type { PayrollPayment } from "../../../../src/types/payrollPayment";
import { hasPermission } from "../../auth/access";
import { canReadRunPayments } from "./paymentModel";
import { validatePaymentDraft } from "./paymentFormModel";

export function canConfirmPayment(
  user: UserProfile | null,
  branchId: string | undefined,
  runId: string,
  runStatus: string,
  payment: PayrollPayment,
) {
  return (
    canReadRunPayments(user) &&
    hasPermission(user, "payroll-payment:manage") &&
    !!branchId &&
    runStatus === "closed" &&
    payment.runId === runId &&
    payment.status === "draft" &&
    validAllocation(payment)
  );
}
export function validAllocation(payment: PayrollPayment) {
  return (
    Number.isSafeInteger(payment.amount) &&
    payment.amount > 0 &&
    Array.isArray(payment.lines) &&
    payment.lines.length > 0 &&
    payment.lines.every(
      (line) =>
        !!line &&
        typeof line.employeeId === "string" &&
        !!line.employeeId &&
        Number.isSafeInteger(line.amount) &&
        line.amount > 0,
    ) &&
    new Set(payment.lines.map((line) => line.employeeId)).size === payment.lines.length &&
    payment.lines.reduce((sum, line) => sum + line.amount, 0) === payment.amount
  );
}
export function validateConfirmedPayment(value: unknown, original: PayrollPayment) {
  const payment = value as PayrollPayment | null;
  if (!payment || payment._id !== original._id || payment.status !== "confirmed" || !validAllocation(original))
    throw new Error("Chưa xác nhận được kết quả thanh toán. Tải lại để kiểm tra.");
  validatePaymentDraft({ ...payment, status: "draft" }, original.runId, {
    amount: original.amount,
    lines: original.lines!,
  });
}
