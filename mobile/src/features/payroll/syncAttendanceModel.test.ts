import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { createPayrollService } from "../../../../src/services/payrollService";
import { canSyncRunAttendance, syncAttendanceSummary } from "./syncAttendanceModel";
const user = {
  uid: "u",
  companyCode: "A",
  enabledModules: ["hr"],
  permissions: ["payroll-period:read", "payroll-period:manage"],
} as UserProfile;
const run: PayrollRun = { _id: "r", periodKey: "2026-09", status: "draft", version: 0 };
const job = {
  runId: "r",
  operation: "sync-attendance",
  idempotencyKey: "key",
  status: "succeeded",
  payload: { expectedVersion: 0 },
  result: { employeeCount: 2, blockingIssueCount: 3 },
};
it("requires management scope, draft status and an explicit nonnegative integer version", () => {
  expect(canSyncRunAttendance(user, "b", run)).toBe(true);
  for (const version of [undefined, -1, 0.5, NaN])
    expect(canSyncRunAttendance(user, "b", { ...run, version })).toBe(false);
  for (const status of ["review", "closed", "paid"])
    expect(canSyncRunAttendance(user, "b", { ...run, status })).toBe(false);
  expect(canSyncRunAttendance(user, undefined, run)).toBe(false);
  expect(canSyncRunAttendance(null, "b", run)).toBe(false);
  expect(canSyncRunAttendance({ ...user, permissions: ["payroll-period:read"] }, "b", run)).toBe(false);
});
it("accepts successful synchronization with blocking issues rather than treating it as ready for payroll", () => {
  expect(syncAttendanceSummary({ job, runVersion: 1 }, run, "key")).toEqual({
    employeeCount: 2,
    blockingIssueCount: 3,
  });
});
it("rejects another run, request, version, operation or an unfinished job", () => {
  for (const change of [
    { runId: "other" },
    { idempotencyKey: "other" },
    { operation: "calculate" },
    { status: "running" },
    { payload: { expectedVersion: 1 } },
    { result: { employeeCount: -1, blockingIssueCount: 0 } },
    { result: { employeeCount: 2 } },
  ])
    expect(() => syncAttendanceSummary({ job: { ...job, ...change }, runVersion: 1 }, run, "key")).toThrow();
  expect(() => syncAttendanceSummary({ job, runVersion: 0 }, run, "key")).toThrow();
  expect(() => syncAttendanceSummary(null, run, "key")).toThrow();
});
it("sends exact version and idempotency key with encoded ID and bearer auth", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { job, runVersion: 1 } })));
  await createPayrollService({ fetch, getAccessToken: () => "token" }).syncRunAttendance("r/1", 0, "key");
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/runs/r%2F1/sync-attendance",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ expectedVersion: 0 }),
      headers: { "Content-Type": "application/json", Authorization: "Bearer token", "Idempotency-Key": "key" },
    }),
  );
});
it.each([403, 409, 500])("preserves sync error %s without starting another operation", async (status) => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ code: "PAYROLL_VERSION_CONFLICT" }), { status }));
  await expect(
    createPayrollService({ fetch, getAccessToken: () => "t" }).syncRunAttendance("r", 0, "key"),
  ).rejects.toMatchObject({ status, code: "PAYROLL_VERSION_CONFLICT" });
  expect(fetch).toHaveBeenCalledOnce();
});
