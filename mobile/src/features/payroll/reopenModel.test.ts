import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { createPayrollService } from "../../../../src/services/payrollService";
import { canReopenPayrollRun, reopenPayload, validateReopenedRun } from "./reopenModel";
const run = { _id: "r", periodKey: "2026-09", status: "closed", version: 4 };
const user = {
  uid: "u",
  companyCode: "A",
  enabledModules: ["hr"],
  permissions: ["payroll-period:read", "payroll-period:manage"],
} as UserProfile;
it("allows review/closed only with version and management scope", () => {
  expect(canReopenPayrollRun(user, "b", run)).toBe(true);
  expect(canReopenPayrollRun(user, "b", { ...run, status: "review" })).toBe(true);
  for (const status of ["draft", "paid", "unknown"])
    expect(canReopenPayrollRun(user, "b", { ...run, status })).toBe(false);
  expect(canReopenPayrollRun(user, "b", { ...run, version: NaN })).toBe(false);
  expect(canReopenPayrollRun(null, "b", run)).toBe(false);
  expect(canReopenPayrollRun(user, undefined, run)).toBe(false);
  expect(canReopenPayrollRun({ ...user, permissions: ["payroll-period:read"] }, "b", run)).toBe(false);
});
it("trims mandatory reason and limits its length before mutation", () => {
  expect(reopenPayload(run, "  Sửa dữ liệu  ")).toEqual({ expectedVersion: 4, reason: "Sửa dữ liệu" });
  expect(reopenPayload(run, "x".repeat(1000)).reason).lengthOf(1000);
  for (const reason of ["", "   ", "x".repeat(1001)]) expect(() => reopenPayload(run, reason)).toThrow();
  expect(() => reopenPayload({ ...run, status: "paid" }, "reason")).toThrow();
});
it("requires matching draft and next version before reporting success", () => {
  const saved = { ...run, status: "draft", version: 5 };
  expect(() => validateReopenedRun(saved, run)).not.toThrow();
  for (const value of [
    null,
    {},
    { ...saved, _id: "other" },
    { ...saved, periodKey: "2026-08" },
    { ...saved, status: "closed" },
    { ...saved, version: 4 },
  ])
    expect(() => validateReopenedRun(value, run)).toThrow();
});
it("posts exact version and reason through the encoded authenticated route", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} })));
  const payload = reopenPayload(run, "  Correct input  ");
  await createPayrollService({ fetch, getAccessToken: () => "t" }).reopen("r/1", payload);
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/runs/r%2F1/reopen",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
    }),
  );
});
it.each(["PAYROLL_CONFIRMED_PAYMENTS_EXIST", "PAYROLL_PAID_RUN_IMMUTABLE", "PAYROLL_VERSION_CONFLICT"])(
  "preserves %s and never retries reopen",
  async (code) => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code }), { status: 409 }));
    await expect(
      createPayrollService({ fetch, getAccessToken: () => "t" }).reopen("r", reopenPayload(run, "reason")),
    ).rejects.toMatchObject({ status: 409, code });
    expect(fetch).toHaveBeenCalledOnce();
  },
);
