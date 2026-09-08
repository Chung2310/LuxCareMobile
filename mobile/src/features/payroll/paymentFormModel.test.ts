import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { createPayrollService } from "../../../../src/services/payrollService";
import { canCreatePayrollPayment, paymentDraftInput, validatePaymentDraft } from "./paymentFormModel";
const run = {
  _id: "r",
  periodKey: "2026-09",
  status: "closed",
  effectiveLines: [
    { employeeId: "a", calculation: {} },
    { employeeId: "b", calculation: {} },
  ],
};
const user = {
  uid: "u",
  companyCode: "A",
  enabledModules: ["hr"],
  permissions: ["payroll-period:read", "payroll-payment:read", "payroll-payment:manage"],
} as UserProfile;
it("requires closed run, read/manage permissions and branch", () => {
  expect(canCreatePayrollPayment(user, "b", run)).toBe(true);
  for (const status of ["draft", "review", "paid"])
    expect(canCreatePayrollPayment(user, "b", { ...run, status })).toBe(false);
  expect(canCreatePayrollPayment(null, "b", run)).toBe(false);
  expect(canCreatePayrollPayment(user, undefined, run)).toBe(false);
  expect(
    canCreatePayrollPayment({ ...user, permissions: ["payroll-period:read", "payroll-payment:read"] }, "b", run),
  ).toBe(false);
});
it("sums explicit allocations and trims note while skipping blanks", () => {
  expect(paymentDraftInput(run, { a: " 100 ", b: "200" }, " note ")).toEqual({
    amount: 300,
    lines: [
      { employeeId: "a", amount: 100 },
      { employeeId: "b", amount: 200 },
    ],
    note: "note",
  });
  expect(paymentDraftInput(run, { a: "100", b: " " }, "").lines).lengthOf(1);
});
it("rejects invalid amounts, employees, empty allocations and overflow", () => {
  for (const amount of ["0", "-1", "1.2", "1e3", "1,000", "9007199254740992"])
    expect(() => paymentDraftInput(run, { a: amount }, "")).toThrow();
  expect(() => paymentDraftInput(run, {}, "")).toThrow();
  expect(() => paymentDraftInput(run, { other: "1" }, "")).toThrow();
  expect(() => paymentDraftInput(run, { a: "9007199254740991", b: "1" }, "")).toThrow();
  expect(() => paymentDraftInput(run, { a: "1" }, "x".repeat(1001))).toThrow();
});
it("validates the saved draft and all allocations", () => {
  const payload = paymentDraftInput(run, { a: "100", b: "200" }, "");
  const payment = { ...payload, _id: "p", runId: "r", status: "draft" };
  expect(() => validatePaymentDraft(payment, "r", payload)).not.toThrow();
  for (const change of [
    { runId: "other" },
    { status: "confirmed" },
    { amount: 301 },
    {
      lines: [
        { employeeId: "a", amount: 100 },
        { employeeId: "a", amount: 200 },
      ],
    },
    { lines: [] },
  ])
    expect(() => validatePaymentDraft({ ...payment, ...change }, "r", payload)).toThrow();
});
it("posts explicit allocation and idempotency key with authenticated encoded run", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} })));
  const payload = { ...paymentDraftInput(run, { a: "100" }, ""), idempotencyKey: "key" };
  await createPayrollService({ fetch, getAccessToken: () => "t" }).createPayment("r/1", payload);
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/runs/r%2F1/payments",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
    }),
  );
});
it.each([403, 409, 500])("preserves creation refusal %s without retrying", async (status) => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ code: "PAYROLL_PAYMENT_INVALID" }), { status }));
  await expect(createPayrollService({ fetch, getAccessToken: () => "t" }).createPayment("r", {})).rejects.toMatchObject(
    { status, code: "PAYROLL_PAYMENT_INVALID" },
  );
  expect(fetch).toHaveBeenCalledOnce();
});
