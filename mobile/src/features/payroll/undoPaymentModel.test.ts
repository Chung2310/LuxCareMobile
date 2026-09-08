import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import type { PayrollPayment } from "../../../../src/types/payrollPayment";
import { createPayrollService } from "../../../../src/services/payrollService";
import { canUndoPayment, validateUndonePayment } from "./undoPaymentModel";
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
  amount: 100,
  lines: [{ employeeId: "a", amount: 100 }],
};
it("cancels drafts even after reopening without requiring allocations", () => {
  for (const runStatus of ["draft", "review", "closed", "paid"])
    expect(canUndoPayment(user, "b", "r", runStatus, { ...payment, lines: undefined }, "cancel")).toBe(true);
  for (const status of ["confirmed", "cancelled", "reversed"] as const)
    expect(canUndoPayment(user, "b", "r", "closed", { ...payment, status }, "cancel")).toBe(false);
});
it("reverses only confirmed allocations in closed or paid runs", () => {
  const confirmed = { ...payment, status: "confirmed" as const };
  for (const status of ["closed", "paid"])
    expect(canUndoPayment(user, "b", "r", status, confirmed, "reverse")).toBe(true);
  for (const status of ["draft", "review"])
    expect(canUndoPayment(user, "b", "r", status, confirmed, "reverse")).toBe(false);
  for (const status of ["draft", "cancelled", "reversed"] as const)
    expect(canUndoPayment(user, "b", "r", "paid", { ...payment, status }, "reverse")).toBe(false);
  expect(canUndoPayment(user, "b", "r", "paid", { ...confirmed, lines: [] }, "reverse")).toBe(false);
});
it.each(["cancel", "reverse"] as const)(
  "requires HR, company, branch, matching run and all permissions for %s",
  (action) => {
    const original = { ...payment, status: action === "cancel" ? ("draft" as const) : ("confirmed" as const) };
    for (const candidate of [
      null,
      { ...user, companyCode: undefined },
      { ...user, enabledModules: ["crm"] },
      ...user.permissions!.map((permission) => ({
        ...user,
        permissions: user.permissions!.filter((value) => value !== permission),
      })),
    ])
      expect(canUndoPayment(candidate, "b", "r", "closed", original, action)).toBe(false);
    expect(canUndoPayment(user, undefined, "r", "closed", original, action)).toBe(false);
    expect(canUndoPayment(user, "b", "other", "closed", original, action)).toBe(false);
  },
);
it.each(["cancel", "reverse"] as const)("validates %s identity, state, amount and allocations", (action) => {
  const result = { ...payment, status: action === "cancel" ? "cancelled" : "reversed" };
  expect(() => validateUndonePayment(result, payment, action)).not.toThrow();
  for (const change of [
    { _id: "other" },
    { runId: "other" },
    { status: "draft" },
    { amount: 200 },
    { lines: [] },
    { lines: [{ employeeId: "other", amount: 100 }] },
  ])
    expect(() => validateUndonePayment({ ...result, ...change }, payment, action)).toThrow();
  expect(() => validateUndonePayment(null, payment, action)).toThrow();
});
it("accepts cancellation of a legacy draft without allocations", () => {
  expect(() =>
    validateUndonePayment({ ...payment, status: "cancelled", lines: [] }, { ...payment, lines: undefined }, "cancel"),
  ).not.toThrow();
});
it.each(["cancel", "reverse"] as const)(
  "posts authenticated encoded %s endpoint and preserves metadata",
  async (action) => {
    const result = { ...payment, status: action === "cancel" ? "cancelled" : "reversed" };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: result, runStatus: "closed" })));
    const service = createPayrollService({ fetch, getAccessToken: () => "t" });
    expect(await (action === "cancel" ? service.cancelPayment("p/1") : service.reversePayment("p/1"))).toEqual(result);
    expect(fetch).toHaveBeenCalledWith(
      `/api/v1/payroll/payments/p%2F1/${action}`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
      }),
    );
    expect(fetch.mock.calls[0][1].body).toBeUndefined();
  },
);
it.each([403, 404, 409, 500])("does not retry either transition on %s", async (status) => {
  for (const method of ["cancelPayment", "reversePayment"] as const) {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ code: "PAYROLL_PAYMENT_INVALID_TRANSITION" }), { status }));
    await expect(createPayrollService({ fetch, getAccessToken: () => "t" })[method]("p")).rejects.toMatchObject({
      status,
      code: "PAYROLL_PAYMENT_INVALID_TRANSITION",
    });
    expect(fetch).toHaveBeenCalledOnce();
  }
});
