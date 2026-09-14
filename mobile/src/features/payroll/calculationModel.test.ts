import { expect, it, vi } from "vitest";
import { createPayrollService } from "../../../../src/services/payrollService";
import { calculationSummary, calculateLikeWeb } from "./calculationModel";
const run = { _id: "r", periodKey: "2026-09", status: "draft", version: 2 };
const revision = {
  _id: "rev",
  runId: "r",
  status: "completed",
  effectiveLines: [{ employeeId: "e" }],
};
it("accepts completed effective lines after version activation", () => {
  expect(calculationSummary({ revision, runVersion: 3 }, run)).toEqual({
    revisionId: "rev",
    employeeCount: 1,
  });
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
    expect(() =>
      calculationSummary(
        { revision: { ...revision, ...change }, runVersion: 3 },
        run,
      ),
    ).toThrow();
  expect(() => calculationSummary(null, run)).toThrow();
  expect(() => calculationSummary({ revision, runVersion: 2 }, run)).toThrow();
});
it("posts exact expectedVersion with bearer and idempotency key", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ data: {} })));
  await createPayrollService({
    fetch,
    getAccessToken: () => "t",
  }).calculateOperationalRun("r/1", 2, "key");
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/runs/r%2F1/calculate",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ expectedVersion: 2 }),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer t",
        "Idempotency-Key": "key",
      },
    }),
  );
});
it.each([403, 409, 500])(
  "preserves refusal %s without retrying calculation",
  async (status) => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "PAYROLL_CALCULATION_FAILED" }), {
        status,
      }),
    );
    await expect(
      createPayrollService({
        fetch,
        getAccessToken: () => "t",
      }).calculateOperationalRun("r", 2, "key"),
    ).rejects.toMatchObject({ status, code: "PAYROLL_CALCULATION_FAILED" });
    expect(fetch).toHaveBeenCalledOnce();
  },
);

it("uses the web process endpoint for runs without revisions and reads authoritative results", async () => {
  const api = {
    processPeriod: vi.fn().mockResolvedValue({}),
    getRun: vi
      .fn()
      .mockResolvedValue({
        ...run,
        effectiveLines: [{ employeeId: "e", calculation: { net: 100 } }],
      }),
    calculateOperationalRun: vi.fn(),
  };
  expect(await calculateLikeWeb(api, run, "key")).toEqual({
    revisionId: "",
    employeeCount: 1,
    runVersion: 2,
  });
  expect(api.processPeriod).toHaveBeenCalledWith(run.periodKey);
  expect(api.getRun).toHaveBeenCalledWith(run.periodKey);
  expect(api.calculateOperationalRun).not.toHaveBeenCalled();
});
it("uses revision calculation for existing revisions without processing attendance again", async () => {
  const api = {
    processPeriod: vi.fn(),
    getRun: vi.fn(),
    calculateOperationalRun: vi
      .fn()
      .mockResolvedValue({ revision, runVersion: 3 }),
  };
  expect(
    await calculateLikeWeb(api, { ...run, activeRevisionId: "rev" }, "key"),
  ).toEqual({ revisionId: "rev", employeeCount: 1, runVersion: 3 });
  expect(api.calculateOperationalRun).toHaveBeenCalledWith("r", 2, "key");
  expect(api.processPeriod).not.toHaveBeenCalled();
});
it("does not fall back to a different calculation workflow after a processing failure", async () => {
  const api = {
    processPeriod: vi.fn().mockRejectedValue(Error("Policy required")),
    getRun: vi.fn(),
    calculateOperationalRun: vi.fn(),
  };
  await expect(calculateLikeWeb(api, run, "key")).rejects.toThrow(
    "Policy required",
  );
  expect(api.processPeriod).toHaveBeenCalledOnce();
  expect(api.getRun).not.toHaveBeenCalled();
  expect(api.calculateOperationalRun).not.toHaveBeenCalled();
});
it.each([
  { _id: "other" },
  { periodKey: "2026-08" },
  { status: "review" },
  { version: 1 },
  { effectiveError: { code: "invalid" } },
])("rejects mismatched results after processing: %j", async (change) => {
  const api = {
    processPeriod: vi.fn(),
    getRun: vi
      .fn()
      .mockResolvedValue({ ...run, effectiveLines: [], ...change }),
    calculateOperationalRun: vi.fn(),
  };
  await expect(calculateLikeWeb(api, run, "key")).rejects.toThrow();
});
