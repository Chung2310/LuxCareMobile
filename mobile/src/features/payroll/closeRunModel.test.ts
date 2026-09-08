import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { createPayrollService } from "../../../../src/services/payrollService";
import { canClosePayrollRun, validateClosedRun } from "./reviewModel";
const run = { _id: "r", periodKey: "2026-09", status: "review", version: 4 };
const user = {
  uid: "u",
  companyCode: "A",
  enabledModules: ["hr"],
  permissions: ["payroll-period:read", "payroll-period:manage"],
} as UserProfile;
it("requires review status, version and management scope", () => {
  expect(canClosePayrollRun(user, "b", run)).toBe(true);
  for (const status of ["draft", "closed", "paid"])
    expect(canClosePayrollRun(user, "b", { ...run, status })).toBe(false);
  for (const version of [-1, NaN, 0.5]) expect(canClosePayrollRun(user, "b", { ...run, version })).toBe(false);
  expect(canClosePayrollRun(null, "b", run)).toBe(false);
  expect(canClosePayrollRun(user, undefined, run)).toBe(false);
  expect(canClosePayrollRun({ ...user, permissions: ["payroll-period:read"] }, "b", run)).toBe(false);
});
it("requires the same run in closed status with the next version", () => {
  const saved = { ...run, status: "closed", version: 5 };
  expect(() => validateClosedRun(saved, run)).not.toThrow();
  for (const value of [
    null,
    {},
    { ...saved, _id: "other" },
    { ...saved, periodKey: "2026-08" },
    { ...saved, status: "paid" },
    { ...saved, version: 4 },
  ])
    expect(() => validateClosedRun(value, run)).toThrow();
});
it("posts expectedVersion to encoded close endpoint", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} })));
  await createPayrollService({ fetch, getAccessToken: () => "t" }).closeRun("r/1", 4);
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/runs/r%2F1/close",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ expectedVersion: 4 }),
      headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
    }),
  );
});
it.each(["PAYROLL_CHECKSUM_MISMATCH", "PAYROLL_REVISION_MISSING", "PAYROLL_VERSION_CONFLICT"])(
  "preserves %s without retrying close",
  async (code) => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code }), { status: 409 }));
    await expect(createPayrollService({ fetch, getAccessToken: () => "t" }).closeRun("r", 4)).rejects.toMatchObject({
      status: 409,
      code,
    });
    expect(fetch).toHaveBeenCalledOnce();
  },
);
