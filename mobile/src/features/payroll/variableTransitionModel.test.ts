import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { createPayrollService } from "../../../../src/services/payrollService";
import { canTransitionVariable, validateVariableTransition } from "./variableTransitionModel";
const user = {
  uid: "u",
  companyCode: "C",
  enabledModules: ["hr"],
  permissions: ["payroll-period:read", "payroll-period:manage"],
} as UserProfile;
const item = { _id: "v", companyCode: "C", code: "A", name: "A", unit: "number", status: "draft", version: 2 };
it("enforces supported transitions and company scope", () => {
  expect(canTransitionVariable(user, item, "activate")).toBe(true);
  expect(canTransitionVariable(user, { ...item, status: "retired" }, "activate")).toBe(true);
  expect(canTransitionVariable(user, { ...item, status: "active" }, "retire")).toBe(true);
  expect(canTransitionVariable(user, item, "retire")).toBe(false);
  expect(canTransitionVariable(user, { ...item, status: "active" }, "activate")).toBe(false);
  expect(canTransitionVariable(user, { ...item, companyCode: "X" }, "activate")).toBe(false);
  expect(canTransitionVariable(null, item, "activate")).toBe(false);
  expect(canTransitionVariable({ ...user, permissions: ["payroll-period:read"] }, item, "activate")).toBe(false);
});
it.each(["activate", "retire"] as const)("validates %s response with unchanged content/version", (action) => {
  const result = { ...item, status: action === "activate" ? "active" : "retired" };
  expect(() => validateVariableTransition(result, item, action)).not.toThrow();
  for (const change of [
    { _id: "other" },
    { status: "draft" },
    { companyCode: "X" },
    { code: "B" },
    { name: "changed" },
    { defaultValue: 0 },
    { version: 3 },
  ])
    expect(() => validateVariableTransition({ ...result, ...change }, item, action)).toThrow();
});
it.each(["activate", "retire"] as const)("reuses encoded authenticated %s endpoint", async (action) => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: item })));
  const service = createPayrollService({ fetch, getAccessToken: () => "t" });
  await (action === "activate" ? service.activatePeriodInputVariable("a/b") : service.retirePeriodInputVariable("a/b"));
  expect(fetch).toHaveBeenCalledWith(
    `/api/v1/payroll/period-input-variables/a%2Fb/${action}`,
    expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
    }),
  );
});
it.each([403, 409, 500])("does not retry either transition on %s", async (status) => {
  for (const method of ["activatePeriodInputVariable", "retirePeriodInputVariable"] as const) {
    const fetch = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ code: "PAYROLL_CUSTOM_VARIABLE_INVALID_STATE" }), { status }));
    await expect(createPayrollService({ fetch, getAccessToken: () => "t" })[method]("v")).rejects.toMatchObject({
      status,
    });
    expect(fetch).toHaveBeenCalledOnce();
  }
});
