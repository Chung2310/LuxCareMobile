import { expect, it, vi } from "vitest";
import type { PayrollAdjustment } from "../../../../src/types/payrollAdjustment";
import type { UserProfile } from "../../../../src/types/common";
import { createPayrollService } from "../../../../src/services/payrollService";
import { canDecideAdjustment, validateAdjustmentDecision } from "./adjustmentModel";
const item: PayrollAdjustment = {
  _id: "a",
  periodKey: "2026-09",
  employeeId: "e",
  amount: 100,
  reason: "Bonus",
  kind: "bonus",
  status: "pending",
};
it("requires read/manage permissions and pending status", () => {
  const user = {
    uid: "u",
    companyCode: "A",
    enabledModules: ["hr"],
    permissions: ["payroll-period:read", "payroll-period:manage"],
    role: "user",
  } as UserProfile;
  expect(canDecideAdjustment(user, item)).toBe(true);
  expect(canDecideAdjustment({ ...user, permissions: ["payroll-period:read"] }, item)).toBe(false);
  for (const status of ["approved", "rejected", "draft", "snapshotted"] as const)
    expect(canDecideAdjustment(user, { ...item, status })).toBe(false);
});
it.each([true, false])("posts decision %s once with encoded scope and id", async (approve) => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ data: { ...item, status: approve ? "approved" : "rejected" } })));
  const service = createPayrollService({ fetch, getAccessToken: () => "token" });
  const saved = await (approve ? service.approveAdjustment : service.rejectAdjustment)("2026/09", "a?b");
  expect(() => validateAdjustmentDecision(saved, item, approve)).not.toThrow();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe(
    `/api/v1/payroll/periods/2026%2F09/adjustments/a%3Fb/${approve ? "approve" : "reject"}`,
  );
  expect(fetch.mock.calls[0][1].method).toBe("POST");
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
});
it("rejects stale or unconfirmed outcomes", () => {
  expect(() => validateAdjustmentDecision(item, item, true)).toThrow();
  expect(() => validateAdjustmentDecision({ ...item, status: "approved", _id: "other" }, item, true)).toThrow();
  expect(() => validateAdjustmentDecision({ ...item, status: "approved", periodKey: "2026-08" }, item, true)).toThrow();
});
it("preserves conflict responses without automatic retry", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ message: "Already processed" }), { status: 409 }));
  await expect(
    createPayrollService({ fetch, getAccessToken: () => "token" }).approveAdjustment("2026-09", "a"),
  ).rejects.toMatchObject({ status: 409 });
  expect(fetch).toHaveBeenCalledTimes(1);
});
