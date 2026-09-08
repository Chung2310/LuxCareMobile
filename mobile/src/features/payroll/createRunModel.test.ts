import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { createPayrollService } from "../../../../src/services/payrollService";
import { canCreatePayrollRun, monthlyRunInput, validateCreatedRun } from "./createRunModel";
const user = {
  uid: "u",
  companyCode: "A",
  enabledModules: ["hr"],
  permissions: ["payroll-period:read", "payroll-period:manage"],
} as UserProfile;
it("requires read and manage, company, HR and branch scope", () => {
  expect(canCreatePayrollRun(user, "b")).toBe(true);
  expect(canCreatePayrollRun({ ...user, permissions: ["*"] }, "b")).toBe(true);
  for (const permissions of [[], ["payroll-period:read"], ["payroll-period:manage"]])
    expect(canCreatePayrollRun({ ...user, permissions }, "b")).toBe(false);
  expect(canCreatePayrollRun(user, undefined)).toBe(false);
  expect(canCreatePayrollRun(null, "b")).toBe(false);
  expect(canCreatePayrollRun({ ...user, companyCode: "" }, "b")).toBe(false);
  expect(canCreatePayrollRun({ ...user, enabledModules: ["crm"] }, "b")).toBe(false);
});
it.each([
  ["2026-02", 28],
  ["2028-02", 29],
  ["2026-09", 30],
  ["2026-12", 31],
])("builds the calendar range for %s", (period, days) => {
  expect(monthlyRunInput(String(period))).toEqual({
    periodKey: period,
    startDate: `${period}-01`,
    endDate: `${period}-${days}`,
    type: "regular",
  });
});
it("rejects invalid periods before creating anything", () => {
  for (const period of ["2026-00", "2026-13", "26-02", "2026-2", "2026-02/other", "0000-01"])
    expect(() => monthlyRunInput(period)).toThrow();
});
it("requires the created regular draft to match the requested period", () => {
  const run: PayrollRun = { _id: "r", periodKey: "2026-09", type: "regular", status: "draft" };
  expect(() => validateCreatedRun(run, "2026-09")).not.toThrow();
  for (const value of [
    { ...run, _id: "" },
    { ...run, periodKey: "2026-08" },
    { ...run, type: "supplemental" as const },
    { ...run, status: "closed" },
  ])
    expect(() => validateCreatedRun(value, "2026-09")).toThrow();
});
it("uses the operational endpoint with explicit dates and no tenant overrides", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { _id: "r" } }), { status: 201 }));
  const payload = monthlyRunInput("2026-09");
  await createPayrollService({ fetch, getAccessToken: () => "token" }).createOperationalRun(payload);
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/runs",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
    }),
  );
});
it.each([403, 409, 500])("preserves creation error %s without retrying", async (status) => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "PAYROLL_PERIOD_OVERLAP" }), { status }));
  await expect(
    createPayrollService({ fetch, getAccessToken: () => "t" }).createOperationalRun(monthlyRunInput("2026-09")),
  ).rejects.toMatchObject({ status, code: "PAYROLL_PERIOD_OVERLAP" });
  expect(fetch).toHaveBeenCalledOnce();
});
