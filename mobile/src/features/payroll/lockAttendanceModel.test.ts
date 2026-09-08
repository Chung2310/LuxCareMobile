import { expect, it, vi } from "vitest";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { createPayrollService } from "../../../../src/services/payrollService";
import { lockedAttendanceSummary } from "./lockAttendanceModel";
const run: PayrollRun = { _id: "r", periodKey: "2026-09", status: "draft", version: 0 };
const snapshot = {
  _id: "s",
  runId: "r",
  periodKey: "2026-09",
  lockedAt: "2026-09-08T10:00:00.000Z",
  employees: [{ employeeId: "e" }],
};
it("accepts the locked snapshot and next version while the payroll run remains draft", () => {
  expect(lockedAttendanceSummary({ run: { ...run, version: 2 }, snapshot }, run, 1)).toEqual({
    snapshotId: "s",
    employeeCount: 1,
  });
});
it("rejects a different, malformed or unconfirmed snapshot", () => {
  for (const change of [
    { _id: "" },
    { runId: "other" },
    { periodKey: "2026-08" },
    { lockedAt: "bad" },
    { employees: null },
  ])
    expect(() =>
      lockedAttendanceSummary({ run: { ...run, version: 2 }, snapshot: { ...snapshot, ...change } }, run, 1),
    ).toThrow();
  expect(() => lockedAttendanceSummary(null, run, 1)).toThrow();
});
it("rejects wrong run, period, status or version even with a valid snapshot", () => {
  for (const change of [{ _id: "other" }, { periodKey: "2026-08" }, { status: "closed" }, { version: 1 }])
    expect(() => lockedAttendanceSummary({ run: { ...run, version: 2, ...change }, snapshot }, run, 1)).toThrow();
});
it("locks the encoded run with the version returned by synchronization", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} })));
  await createPayrollService({ fetch, getAccessToken: () => "token" }).lockRunAttendance("r/1", 1);
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/runs/r%2F1/lock-attendance",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ expectedVersion: 1 }),
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
    }),
  );
});
it.each(["PAYROLL_BLOCKING_ISSUES", "PAYROLL_ATTENDANCE_NOT_SYNCED", "PAYROLL_VERSION_CONFLICT"])(
  "preserves %s without retrying lock",
  async (code) => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code }), { status: 409 }));
    await expect(
      createPayrollService({ fetch, getAccessToken: () => "t" }).lockRunAttendance("r", 1),
    ).rejects.toMatchObject({ status: 409, code });
    expect(fetch).toHaveBeenCalledOnce();
  },
);
