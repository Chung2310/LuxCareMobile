import { expect, it, vi } from "vitest";
import { createPayrollService } from "../../../../src/services/payrollService";
import { validateReviewedRun } from "./reviewModel";
const run = { _id: "r", periodKey: "2026-09", status: "draft", version: 3 };
it("requires the same period and run in review with the next version", () => {
  const saved = { ...run, status: "review", version: 4 };
  expect(() => validateReviewedRun(saved, run)).not.toThrow();
  for (const value of [
    null,
    {},
    { ...saved, _id: "other" },
    { ...saved, periodKey: "2026-08" },
    { ...saved, status: "closed" },
    { ...saved, version: 3 },
  ])
    expect(() => validateReviewedRun(value, run)).toThrow();
});
it("sends version to encoded review endpoint with authentication", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} })));
  await createPayrollService({ fetch, getAccessToken: () => "t" }).reviewRun("r/1", 3);
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/runs/r%2F1/review",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ expectedVersion: 3 }),
      headers: { "Content-Type": "application/json", Authorization: "Bearer t" },
    }),
  );
});
it.each([403, 409, 500])("preserves review refusal %s without retrying", async (status) => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ code: "PAYROLL_BLOCKING_ISSUES" }), { status }));
  await expect(createPayrollService({ fetch, getAccessToken: () => "t" }).reviewRun("r", 3)).rejects.toMatchObject({
    status,
    code: "PAYROLL_BLOCKING_ISSUES",
  });
  expect(fetch).toHaveBeenCalledOnce();
});
