import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { createPayrollService } from "../../../../src/services/payrollService";
import { canReadPayrollRuns, effectiveRunLines, validPayrollPeriod } from "./runModel";
it("requires explicit period read permission and HR company scope", () => {
  const user = { uid: "u", companyCode: "A", enabledModules: ["hr"], permissions: [], role: "admin" } as UserProfile;
  expect(canReadPayrollRuns(user)).toBe(false);
  expect(canReadPayrollRuns({ ...user, permissions: ["payroll-period:manage"] })).toBe(false);
  expect(canReadPayrollRuns({ ...user, permissions: ["payroll-period:read"] })).toBe(true);
  expect(canReadPayrollRuns({ ...user, permissions: ["*"], companyCode: "" })).toBe(false);
});
it("validates month before sending requests", () => {
  expect(validPayrollPeriod("2026-09")).toBe(true);
  for (const value of ["2026-00", "2026-13", "26-09", "2026-9", "2026-09/../../", "0000-01"])
    expect(validPayrollPeriod(value)).toBe(false);
});
it("never falls back to source lines when effective data is unavailable", () => {
  const run = {
    _id: "r",
    periodKey: "2026-09",
    status: "review",
    lines: [{ employeeId: "e", calculation: { net: 100 } }],
  };
  expect(() => effectiveRunLines(run)).toThrow();
  expect(() => effectiveRunLines({ ...run, effectiveLines: [], effectiveError: { message: "Mismatch" } })).toThrow(
    "Mismatch",
  );
  expect(effectiveRunLines({ ...run, effectiveLines: [] })).toEqual([]);
});
it("uses the authenticated run endpoint and preserves missing-run code", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ code: "PAYROLL_RUN_NOT_FOUND" }), { status: 404 }));
  const service = createPayrollService({ fetch, getAccessToken: () => "token" });
  await expect(service.getRun("2026/09")).rejects.toMatchObject({ status: 404, code: "PAYROLL_RUN_NOT_FOUND" });
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/payroll/periods/2026%2F09/run");
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
});
