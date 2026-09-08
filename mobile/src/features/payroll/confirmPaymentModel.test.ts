import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import type { PayrollPayment } from "../../../../src/types/payrollPayment";
import { createPayrollService } from "../../../../src/services/payrollService";
import { canConfirmPayment, validAllocation, validateConfirmedPayment } from "./confirmPaymentModel";
const user = {
  uid: "u",
  companyCode: "A",
  enabledModules: ["hr"],
  permissions: ["payroll-period:read", "payroll-payment:read", "payroll-payment:manage"],
} as UserProfile;
const payment: PayrollPayment = {
  _id: "p",
  runId: "r",
  status: "draft",
  amount: 300,
  lines: [
    { employeeId: "a", amount: 100 },
    { employeeId: "b", amount: 200 },
  ],
};
it("requires company HR, read/manage permissions and branch", () => {
  expect(canConfirmPayment(user, "b", "r", "closed", payment)).toBe(true);
  for (const candidate of [
    null,
    { ...user, companyCode: undefined },
    { ...user, enabledModules: ["crm"] },
    ...user.permissions!.map((permission) => ({
      ...user,
      permissions: user.permissions!.filter((value) => value !== permission),
    })),
  ])
    expect(canConfirmPayment(candidate, "b", "r", "closed", payment)).toBe(false);
  expect(canConfirmPayment(user, undefined, "r", "closed", payment)).toBe(false);
});
it("allows only a matching draft in a closed run", () => {
  for (const status of ["draft", "review", "paid"])
    expect(canConfirmPayment(user, "b", "r", status, payment)).toBe(false);
  for (const status of ["confirmed", "cancelled", "reversed"] as const)
    expect(canConfirmPayment(user, "b", "r", "closed", { ...payment, status })).toBe(false);
  expect(canConfirmPayment(user, "b", "other", "closed", payment)).toBe(false);
});
it("rejects missing, duplicate, negative, fractional or mismatched allocations", () => {
  for (const change of [
    { lines: undefined },
    { lines: [] },
    { amount: 301 },
    { amount: Infinity },
    {
      lines: [
        { employeeId: "a", amount: 100 },
        { employeeId: "a", amount: 200 },
      ],
    },
    { amount: -1, lines: [{ employeeId: "a", amount: -1 }] },
    { amount: 0.5, lines: [{ employeeId: "a", amount: 0.5 }] },
  ])
    expect(validAllocation({ ...payment, ...change })).toBe(false);
});
it("requires confirmed response with unchanged identity, amount and each allocation", () => {
  const confirmed = { ...payment, status: "confirmed" };
  expect(() => validateConfirmedPayment(confirmed, payment)).not.toThrow();
  for (const change of [
    { _id: "other" },
    { runId: "other" },
    { status: "draft" },
    { amount: 301 },
    {
      lines: [
        { employeeId: "a", amount: 200 },
        { employeeId: "b", amount: 100 },
      ],
    },
  ])
    expect(() => validateConfirmedPayment({ ...confirmed, ...change }, payment)).toThrow();
  expect(() => validateConfirmedPayment(null, payment)).toThrow();
});
it("uses the authenticated encoded confirm endpoint and unwraps payment", async () => {
  const confirmed = { ...payment, status: "confirmed" };
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: confirmed, runStatus: "paid" })));
  expect(await createPayrollService({ fetch, getAccessToken: () => "t" }).confirmPayment("p/1")).toEqual(confirmed);
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/payments/p%2F1/confirm",
    expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
    }),
  );
});
it.each([403, 409, 500])("preserves refusal %s without retrying", async (status) => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ code: "PAYROLL_PAYMENT_INVALID_TRANSITION" }), { status }));
  await expect(createPayrollService({ fetch, getAccessToken: () => "t" }).confirmPayment("p")).rejects.toMatchObject({
    status,
    code: "PAYROLL_PAYMENT_INVALID_TRANSITION",
  });
  expect(fetch).toHaveBeenCalledOnce();
});
