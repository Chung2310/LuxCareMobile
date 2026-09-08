import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { createPayrollService } from "../../../../src/services/payrollService";
import { canEditPeriodInput, periodInputEditPayload, validateEditedPeriodInput } from "./periodInputEditModel";
const item = { employeeId: "a", periodKey: "2026-09", version: 2, bonus: 100, customValues: { OLD: 10 } };
const user = {
  uid: "u",
  companyCode: "A",
  enabledModules: ["hr"],
  permissions: ["payroll-period:read", "payroll-period:manage"],
} as UserProfile;
it("requires editable scope, HR read/manage and a valid version", () => {
  expect(canEditPeriodInput(user, "b", true, item)).toBe(true);
  for (const candidate of [
    null,
    { ...user, enabledModules: ["crm"] },
    { ...user, companyCode: undefined },
    { ...user, permissions: ["payroll-period:read"] },
    { ...user, permissions: ["payroll-period:manage"] },
  ])
    expect(canEditPeriodInput(candidate, "b", true, item)).toBe(false);
  expect(canEditPeriodInput(user, undefined, true, item)).toBe(false);
  expect(canEditPeriodInput(user, "b", false, item)).toBe(false);
  expect(canEditPeriodInput(user, "b", true, { ...item, version: -1 })).toBe(false);
});
it("sends only changed fields, explicit zero and trimmed reason/version", () => {
  expect(
    periodInputEditPayload(
      item,
      { bonus: "0", reconciledDays: "1.5", allowance: " ", companyCode: "evil" },
      " reason ",
    ),
  ).toEqual({ bonus: 0, reconciledDays: 1.5, reason: "reason", expectedVersion: 2 });
});
it("rejects unchanged values, empty reason and invalid numbers", () => {
  expect(() => periodInputEditPayload(item, { bonus: "100" }, "reason")).toThrow();
  expect(() => periodInputEditPayload(item, { bonus: "0" }, " ")).toThrow();
  expect(() => periodInputEditPayload(item, { bonus: "0" }, "x".repeat(1001))).toThrow();
  for (const bonus of ["-1", "NaN", "Infinity", "1e3", "1,5", "1,000", "9007199254740992"])
    expect(() => periodInputEditPayload(item, { bonus }, "reason")).toThrow();
});
it("validates changed and preserved fields, identity and incremented version", () => {
  const payload = periodInputEditPayload(item, { bonus: "0" }, "reason");
  const saved = { ...item, bonus: 0, reason: "reason", version: 3 };
  expect(() => validateEditedPeriodInput(saved, item, payload)).not.toThrow();
  for (const change of [
    { bonus: 100 },
    { version: 2 },
    { employeeId: "b" },
    { periodKey: "2026-08" },
    { reason: "wrong" },
    { customValues: {} },
    { allowance: 1 },
  ])
    expect(() => validateEditedPeriodInput({ ...saved, ...change }, item, payload)).toThrow();
});
it("uses encoded PUT endpoint and explicit version payload", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: item })));
  const payload = periodInputEditPayload(item, { bonus: "0" }, "reason");
  await createPayrollService({ fetch, getAccessToken: () => "t" }).savePeriodInput("2026/09", "a/b", payload);
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/periods/2026%2F09/inputs/a%2Fb",
    expect.objectContaining({
      method: "PUT",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
    }),
  );
});
it.each([403, 409, 500])("preserves save failure %s without retry", async (status) => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ code: "PAYROLL_PERIOD_INPUT_VERSION_CONFLICT" }), { status }));
  await expect(
    createPayrollService({ fetch, getAccessToken: () => "t" }).savePeriodInput("2026-09", "a", {}),
  ).rejects.toMatchObject({ status, code: "PAYROLL_PERIOD_INPUT_VERSION_CONFLICT" });
  expect(fetch).toHaveBeenCalledOnce();
});
