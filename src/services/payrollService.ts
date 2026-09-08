import { browserTransport, type ServiceTransport } from "./serviceTransport";
import type { Payslip, PayslipDetail } from "../types/payslip";
import type { PayrollRun, CreatePayrollRunInput } from "../types/payrollRun";
import type { PayrollIssue } from "../types/payrollIssue";
import type { PayrollAudit } from "../types/payrollAudit";
import type { PayrollPayment } from "../types/payrollPayment";
import type { PayrollAdjustment, PayrollAdjustmentInput } from "../types/payrollAdjustment";

export type PayrollExportType = "detailed" | "insurance" | "pit" | "bank_transfer";
export const payrollWorkbookMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export function createPayrollService({ fetch, getAccessToken }: ServiceTransport) {
  async function workbookResponse(runId: string, type: PayrollExportType, signal?: AbortSignal) {
    const response = await fetch(`/api/v1/payroll/runs/${encodeURIComponent(runId)}/exports`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAccessToken()}` },
      body: JSON.stringify({ type }),
      signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw Object.assign(new Error(body.message || "Không xuất được báo cáo lương."), {
        status: response.status,
        code: body.code,
      });
    }
    return response;
  }
  async function payslipResponse(runId: string, employeeId: string, signal?: AbortSignal) {
    const response = await fetch(
      `/api/v1/payroll/runs/${encodeURIComponent(runId)}/payslips/${encodeURIComponent(employeeId)}/print`,
      {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
        signal,
      },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw Object.assign(
        new Error(body.message || "Không tải được phiếu lương. Phiếu có thể đã bị thu hồi; hãy tải lại danh sách."),
        { status: response.status, code: body.code },
      );
    }
    return response;
  }
  async function request(path: string, init?: RequestInit) {
    const response = await fetch(`/api/v1/payroll${path}`, {
      cache: "no-store",
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getAccessToken()}`,
        ...(init?.headers || {}),
      },
    });
    const body = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(body.message || "Payroll request failed"), {
        status: response.status,
        code: body.code,
        details: body.details,
      });
    return body.data ?? body;
  }

  return {
    getAudit: async (periodKey: string): Promise<PayrollAudit[]> => {
      const result = await request(`/periods/${encodeURIComponent(periodKey)}/audit`);
      if (!Array.isArray(result) || result.some((item) => item.periodKey !== periodKey))
        throw new Error("Nhật ký không khớp kỳ lương.");
      return result;
    },
    getFormulas: () => request("/formulas"),
    createFormula: (payload: unknown) => request("/formulas", { method: "POST", body: JSON.stringify(payload) }),
    updateFormula: (id: string, payload: unknown) =>
      request(`/formulas/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    cloneFormula: (id: string, code: string) =>
      request(`/formulas/${id}/clone`, { method: "POST", body: JSON.stringify({ code }) }),
    activateFormula: (id: string) => request(`/formulas/${id}/activate`, { method: "POST" }),
    retireFormula: (id: string) => request(`/formulas/${id}/retire`, { method: "POST" }),
    getPeriodInputs: (periodKey: string) => request(`/periods/${periodKey}/inputs`),
    savePeriodInput: (periodKey: string, employeeId: string, payload: unknown) =>
      request(`/periods/${periodKey}/inputs/${employeeId}`, { method: "PUT", body: JSON.stringify(payload) }),
    bulkSavePeriodInputs: (periodKey: string, rows: unknown[]) =>
      request(`/periods/${periodKey}/inputs`, { method: "PUT", body: JSON.stringify({ rows }) }),
    getLineOverrides: (periodKey: string) => request(`/periods/${periodKey}/line-overrides`),
    bulkSaveLineOverrides: (periodKey: string, rows: unknown[]) =>
      request(`/periods/${periodKey}/line-overrides`, { method: "PUT", body: JSON.stringify({ rows }) }),
    getPeriodInputVariables: () => request("/period-input-variables"),
    createPeriodInputVariable: (payload: unknown) =>
      request("/period-input-variables", { method: "POST", body: JSON.stringify(payload) }),
    activatePeriodInputVariable: (id: string) => request(`/period-input-variables/${id}/activate`, { method: "POST" }),
    retirePeriodInputVariable: (id: string) => request(`/period-input-variables/${id}/retire`, { method: "POST" }),
    getPolicies: () => request("/policies"),
    createPolicy: (payload: unknown) => request("/policies", { method: "POST", body: JSON.stringify(payload) }),
    updatePolicy: (id: string, payload: unknown) =>
      request(`/policies/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    clonePolicy: (id: string, payload: { code: string; name?: string; definition?: unknown }) =>
      request(`/policies/${id}/clone`, { method: "POST", body: JSON.stringify(payload) }),
    activatePolicy: (id: string, payload: { replaceOverlaps?: boolean } = {}) =>
      request(`/policies/${id}/activate`, { method: "POST", body: JSON.stringify(payload) }),
    retirePolicy: (id: string) => request(`/policies/${id}/retire`, { method: "POST" }),
    deletePolicy: (id: string) => request(`/policies/${id}`, { method: "DELETE" }),
    getRun: (periodKey: string): Promise<PayrollRun> => request(`/periods/${encodeURIComponent(periodKey)}/run`),
    getRunIssues: async (runId: string): Promise<PayrollIssue[]> => {
      const result = await request(`/runs/${encodeURIComponent(runId)}/issues`);
      if (
        !Array.isArray(result) ||
        result.some(
          (item) =>
            !item ||
            typeof item.code !== "string" ||
            typeof item.message !== "string" ||
            typeof item.severity !== "string" ||
            (item.runId !== undefined && item.runId !== runId) ||
            ["employeeId", "field", "remediation"].some(
              (key) => item[key] !== undefined && typeof item[key] !== "string",
            ),
        )
      )
        throw new Error("Danh sách lỗi kỳ lương không hợp lệ hoặc không khớp kỳ.");
      return result;
    },
    getLineDetail: (runId: string, employeeId: string): Promise<PayslipDetail> =>
      request(`/runs/${encodeURIComponent(runId)}/lines/${encodeURIComponent(employeeId)}`),
    getResults: (periodKey: string) => request(`/periods/${periodKey}/results`),
    snapshot: (periodKey: string) => request(`/periods/${periodKey}/snapshot`, { method: "POST" }),
    lock: (periodKey: string) => request(`/periods/${periodKey}/lock`, { method: "POST" }),
    createRun: (periodKey: string) => request(`/periods/${periodKey}/run`, { method: "POST" }),
    createOperationalRun: (payload: CreatePayrollRunInput): Promise<PayrollRun> =>
      request("/runs", { method: "POST", body: JSON.stringify(payload) }),
    syncRunAttendance: (runId: string, expectedVersion: number, idempotencyKey: string) =>
      request(`/runs/${encodeURIComponent(runId)}/sync-attendance`, {
        method: "POST",
        body: JSON.stringify({ expectedVersion }),
        headers: { "Idempotency-Key": idempotencyKey },
      }),
    processPeriod: (periodKey: string) => request(`/periods/${periodKey}/process`, { method: "POST" }),
    calculateRun: (runId: string, expectedVersion: number) =>
      request(`/runs/${runId}/calculate`, { method: "POST", body: JSON.stringify({ expectedVersion }) }),
    review: (periodKey: string) => request(`/periods/${periodKey}/approve`, { method: "POST" }),
    reviewRun: (runId: string, expectedVersion: number) =>
      request(`/runs/${runId}/review`, { method: "POST", body: JSON.stringify({ expectedVersion }) }),
    close: (periodKey: string) => request(`/periods/${periodKey}/close`, { method: "POST" }),
    closeRun: (runId: string, expectedVersion: number) =>
      request(`/runs/${runId}/close`, { method: "POST", body: JSON.stringify({ expectedVersion }) }),
    reopen: (runId: string, payload: { expectedVersion: number; reason: string }) =>
      request(`/runs/${runId}/reopen`, { method: "POST", body: JSON.stringify(payload) }),
    markPaid: (runId: string, payload: { expectedVersion: number }) =>
      request(`/runs/${runId}/mark-paid`, { method: "POST", body: JSON.stringify(payload) }),
    reset: (periodKey: string) => request(`/periods/${periodKey}`, { method: "DELETE" }),
    getAdjustments: async (periodKey: string): Promise<PayrollAdjustment[]> => {
      const result = await request(`/periods/${encodeURIComponent(periodKey)}/adjustments`);
      if (!Array.isArray(result) || result.some((item) => item.periodKey !== periodKey))
        throw new Error("Dữ liệu điều chỉnh không khớp kỳ lương.");
      return result;
    },
    createAdjustment: (periodKey: string, payload: PayrollAdjustmentInput): Promise<PayrollAdjustment> =>
      request(`/periods/${encodeURIComponent(periodKey)}/adjustments`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    approveAdjustment: (periodKey: string, adjustmentId: string): Promise<PayrollAdjustment> =>
      request(`/periods/${encodeURIComponent(periodKey)}/adjustments/${encodeURIComponent(adjustmentId)}/approve`, {
        method: "POST",
      }),
    rejectAdjustment: (periodKey: string, adjustmentId: string): Promise<PayrollAdjustment> =>
      request(`/periods/${encodeURIComponent(periodKey)}/adjustments/${encodeURIComponent(adjustmentId)}/reject`, {
        method: "POST",
      }),
    getPayments: async (runId: string): Promise<PayrollPayment[]> => {
      const result = await request(`/runs/${encodeURIComponent(runId)}/payments`);
      if (!Array.isArray(result)) throw new Error("Dữ liệu thanh toán không hợp lệ.");
      return result;
    },
    createPayment: (runId: string, payload: unknown) =>
      request(`/runs/${runId}/payments`, { method: "POST", body: JSON.stringify(payload) }),
    confirmPayment: (paymentId: string) => request(`/payments/${paymentId}/confirm`, { method: "POST" }),
    cancelPayment: (paymentId: string) => request(`/payments/${paymentId}/cancel`, { method: "POST" }),
    reversePayment: (paymentId: string) => request(`/payments/${paymentId}/reverse`, { method: "POST" }),
    withdrawPayslip: (runId: string, employeeId: string) =>
      request(`/runs/${encodeURIComponent(runId)}/payslips/${encodeURIComponent(employeeId)}/withdraw`, {
        method: "POST",
      }),
    publishPayslips: (runId: string, employeeIds?: string[]) =>
      request(`/runs/${encodeURIComponent(runId)}/payslips/publish`, {
        method: "POST",
        body: JSON.stringify({ employeeIds }),
      }),
    getEmployeePayslips: async (): Promise<Payslip[]> => {
      const result = await request("/employee/me/payslips");
      if (!Array.isArray(result)) throw new Error("Dữ liệu phiếu lương không hợp lệ.");
      return result;
    },
    printPayslip: async (runId: string, employeeId: string) => (await payslipResponse(runId, employeeId)).blob(),
    downloadPayslip: async (runId: string, employeeId: string, signal?: AbortSignal) => {
      const response = await payslipResponse(runId, employeeId, signal);
      if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "text/html")
        throw new Error("Định dạng phiếu lương không hợp lệ.");
      if (Number(response.headers.get("content-length")) > 2 * 1024 * 1024)
        throw new Error("Phiếu lương vượt quá 2 MB.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error("Phiếu lương trống hoặc vượt quá 2 MB.");
      return bytes;
    },
    exportWorkbook: async (runId: string, type: PayrollExportType) => (await workbookResponse(runId, type)).blob(),
    downloadWorkbook: async (runId: string, type: PayrollExportType, signal?: AbortSignal) => {
      const response = await workbookResponse(runId, type, signal);
      if (response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== payrollWorkbookMime)
        throw new Error("Định dạng báo cáo Excel không hợp lệ.");
      if (Number(response.headers.get("content-length")) > 20 * 1024 * 1024) throw new Error("Báo cáo vượt quá 20 MB.");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error("Báo cáo trống hoặc vượt quá 20 MB.");
      return bytes;
    },
  };
}
export const payrollService = createPayrollService(browserTransport);
