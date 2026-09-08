import type { UserProfile } from "../../../../src/types/common";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import type { PayrollPayment } from "../../../../src/types/payrollPayment";
import { canReadRunPayments } from "./paymentModel";
import { hasPermission } from "../../auth/access";
export function canCreatePayrollPayment(user: UserProfile | null, branchId: string | undefined, run: PayrollRun) {
  return (
    canReadRunPayments(user) && hasPermission(user, "payroll-payment:manage") && !!branchId && run.status === "closed"
  );
}
export function paymentDraftInput(run: PayrollRun, amounts: Record<string, string>, note: string) {
  if (run.status !== "closed" || run.effectiveError || !Array.isArray(run.effectiveLines))
    throw new Error("Cần kỳ đã chốt với số liệu có hiệu lực.");
  const eligible = new Set(run.effectiveLines.map((line) => line.employeeId));
  const lines = Object.entries(amounts)
    .filter(([, amount]) => amount.trim())
    .map(([employeeId, raw]) => {
      const amount = Number(raw.trim());
      if (!eligible.has(employeeId) || !/^\d+$/.test(raw.trim()) || !Number.isSafeInteger(amount) || amount <= 0)
        throw new Error("Chọn nhân viên trong kỳ và nhập số tiền nguyên VND lớn hơn 0, không có dấu phân cách.");
      return { employeeId, amount };
    });
  const amount = lines.reduce((sum, line) => sum + line.amount, 0);
  if (!lines.length || !Number.isSafeInteger(amount)) throw new Error("Nhập ít nhất một khoản phân bổ hợp lệ.");
  if (note.trim().length > 1000) throw new Error("Ghi chú tối đa 1000 ký tự.");
  return { amount, lines, ...(note.trim() ? { note: note.trim() } : {}) };
}
export function validatePaymentDraft(value: unknown, runId: string, payload: ReturnType<typeof paymentDraftInput>) {
  const payment = value as PayrollPayment | null;
  if (
    !payment?._id ||
    payment.runId !== runId ||
    payment.status !== "draft" ||
    payment.amount !== payload.amount ||
    !Array.isArray(payment.lines) ||
    payment.lines.length !== payload.lines.length ||
    new Set(payment.lines.map((line) => line?.employeeId)).size !== payload.lines.length ||
    payment.lines.some(
      (line) =>
        !line ||
        !payload.lines.some((expected) => expected.employeeId === line.employeeId && expected.amount === line.amount),
    )
  )
    throw new Error("Chưa xác nhận được khoản nháp đúng phân bổ. Tải lại để kiểm tra.");
}
