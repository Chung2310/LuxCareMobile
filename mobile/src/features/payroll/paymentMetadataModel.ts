import type { PayrollPayment, PayrollPaymentMetadata } from "../../../../src/types/payrollPayment";

export function paymentMetadataInput(date: string, evidence: string, note: string): PayrollPaymentMetadata {
  const result: PayrollPaymentMetadata = {};
  if (date.trim()) {
    const day = date.trim();
    const parsed = new Date(`${day}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      !Number.isFinite(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== day
    )
      throw new Error("Ngày thanh toán phải hợp lệ, định dạng YYYY-MM-DD.");
    result.paymentDate = new Date(`${day}T00:00:00+07:00`).toISOString();
  }
  if (evidence.trim()) {
    const url = evidence.trim();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("Liên kết chứng từ phải là URL HTTP hoặc HTTPS hợp lệ.");
    }
    if (
      !/^https?:\/\//i.test(url) ||
      !["http:", "https:"].includes(parsed.protocol) ||
      !parsed.hostname ||
      /\s/.test(url) ||
      url.includes("\\") ||
      url.length > 2000
    )
      throw new Error("Liên kết chứng từ phải là HTTP/HTTPS, tối đa 2000 ký tự và không có khoảng trắng.");
    result.evidenceUrl = url;
  }
  if (note.trim().length > 1000) throw new Error("Ghi chú tối đa 1000 ký tự.");
  if (note.trim()) result.note = note.trim();
  return result;
}
export function validatePaymentMetadata(value: unknown, expected: PayrollPaymentMetadata) {
  const payment = value as PayrollPayment | null;
  if (
    !payment ||
    (expected.note !== undefined && payment.note !== expected.note) ||
    (expected.evidenceUrl !== undefined && payment.evidenceUrl !== expected.evidenceUrl) ||
    (expected.paymentDate !== undefined &&
      new Date(payment.paymentDate || "").getTime() !== new Date(expected.paymentDate).getTime())
  )
    throw new Error("Ngày, chứng từ hoặc ghi chú trả về chưa khớp. Tải lại để kiểm tra.");
}
