import { expect, it, vi } from "vitest";
import { createPayrollService } from "../../../../src/services/payrollService";
import { calculationSummary } from "./calculationModel";
const run = { _id: "r", periodKey: "2026-09", status: "draft", version: 2 };
const revision = { _id: "rev", runId: "r", status: "completed", effectiveLines: [{ employeeId: "e" }] };
it("accepts completed effective lines after version activation", () => {
  expect(calculationSummary({ revision, runVersion: 3 }, run)).toEqual({ revisionId: "rev", employeeCount: 1 });
});
it("rejects failed or wrong-run revisions and does not fall back to source lines", () => {
  for (const change of [
    { runId: "other" },
    { status: "failed" },
    { status: "running" },
    { _id: "" },
    { effectiveLines: undefined, lines: [] },
    { effectiveLines: [null] },
  ])
    expect(() => calculationSummary({ revision: { ...revision, ...change }, runVersion: 3 }, run)).toThrow();
  expect(() => calculationSummary(null, run)).toThrow();
  expect(() => calculationSummary({ revision, runVersion: 2 }, run)).toThrow();
});
it("posts exact expectedVersion with bearer and idempotency key", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} })));
  await createPayrollService({ fetch, getAccessToken: () => "t" }).calculateOperationalRun("r/1", 2, "key");
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/runs/r%2F1/calculate",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ expectedVersion: 2 }),
      headers: { "Content-Type": "application/json", Authorization: "Bearer t", "Idempotency-Key": "key" },
    }),
  );
});
it.each([403, 409, 500])("preserves refusal %s without retrying calculation", async (status) => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ code: "PAYROLL_CALCULATION_FAILED" }), { status }));
  await expect(
    createPayrollService({ fetch, getAccessToken: () => "t" }).calculateOperationalRun("r", 2, "key"),
  ).rejects.toMatchObject({ status, code: "PAYROLL_CALCULATION_FAILED" });
  expect(fetch).toHaveBeenCalledOnce();
});
