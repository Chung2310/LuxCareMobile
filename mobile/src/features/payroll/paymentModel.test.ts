import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import type { PayrollPayment } from "../../../../src/types/payrollPayment";
import { createPayrollService } from "../../../../src/services/payrollService";
import { canReadRunPayments, confirmedPaymentTotal } from "./paymentModel";
it("requires both period and payment read permission for the embedded history", () => {
  const user = {
    uid: "u",
    companyCode: "A",
    enabledModules: ["hr"],
    permissions: ["payroll-period:read"],
    role: "admin",
  } as UserProfile;
  expect(canReadRunPayments(user)).toBe(false);
  expect(canReadRunPayments({ ...user, permissions: ["payroll-period:read", "payroll-payment:manage"] })).toBe(false);
  expect(canReadRunPayments({ ...user, permissions: ["payroll-period:read", "payroll-payment:read"] })).toBe(true);
  expect(canReadRunPayments({ ...user, permissions: ["*"], enabledModules: ["chat"] })).toBe(false);
});
it("excludes drafts, cancelled and reversed payments without double counting allocations", () => {
  const items = ["confirmed", "draft", "cancelled", "reversed"].map((status) => ({
    _id: status,
    runId: "r",
    amount: 100,
    status,
    lines: [{ employeeId: "e", amount: 100 }],
  })) as PayrollPayment[];
  expect(confirmedPaymentTotal(items)).toBe(100);
  expect(confirmedPaymentTotal([])).toBe(0);
  expect(confirmedPaymentTotal([{ ...items[0], amount: NaN }])).toBeNaN();
});
it("loads only the requested run with authentication and preserves response metadata", async () => {
  const data = [{ _id: "p", runId: "r", status: "confirmed", amount: 100, lines: [{ employeeId: "e", amount: 100 }] }];
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data })));
  expect(await createPayrollService({ fetch, getAccessToken: () => "token" }).getPayments("r/1")).toEqual(data);
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/payroll/runs/r%2F1/payments");
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
});
it("does not turn forbidden or malformed responses into a zero payment total", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 }))
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} })));
  const service = createPayrollService({ fetch, getAccessToken: () => "token" });
  await expect(service.getPayments("r")).rejects.toMatchObject({ status: 403 });
  await expect(service.getPayments("r")).rejects.toThrow("không hợp lệ");
});
