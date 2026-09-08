import { expect, it, vi } from "vitest";
import type { PayrollIssue } from "../../../../src/types/payrollIssue";
import { createPayrollService } from "../../../../src/services/payrollService";
import { filterPayrollIssues } from "./issueModel";
const items: PayrollIssue[] = [
  {
    code: "MISSING",
    message: "Thiếu công",
    severity: "blocking",
    employeeId: "a",
    field: "hours",
    remediation: "Đồng bộ công",
  },
  { code: "BANK", message: "Thiếu tài khoản", severity: "warning", employeeId: "b" },
  { code: "NEW", message: "Toàn kỳ", severity: "future" },
];
it("combines severity with names, IDs, messages and remediation without mutating input", () => {
  const employees = [{ employeeId: "a", employeeName: "Nguyễn An", calculation: {} }];
  for (const search of [" NGUYỄN AN ", "hours", "ĐỒNG BỘ", "missing"])
    expect(filterPayrollIssues(items, "blocking", search, employees)).toEqual([items[0]]);
  expect(filterPayrollIssues(items, "warning", "Nguyễn An", employees)).toEqual([]);
  expect(filterPayrollIssues(items, "", "b", [])).lengthOf(2);
  expect(filterPayrollIssues(items, "future", "", [])).toEqual([items[2]]);
  expect(items).lengthOf(3);
});
it("accepts stored issues with optional run ID and unknown severities", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ data: [...items, { ...items[0], runId: "r/1" }] })));
  const result = await createPayrollService({ fetch, getAccessToken: () => "t" }).getRunIssues("r/1");
  expect(result).lengthOf(4);
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/runs/r%2F1/issues",
    expect.objectContaining({ headers: { "Content-Type": "application/json", Authorization: "Bearer t" } }),
  );
});
it.each([{}, [null], [{ code: "x" }], [{ ...items[0], runId: "other" }], [{ ...items[0], remediation: {} }]])(
  "rejects malformed or cross-run issues",
  async (data) => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data })));
    await expect(createPayrollService({ fetch, getAccessToken: () => "t" }).getRunIssues("r")).rejects.toThrow();
  },
);
it.each([403, 404, 500])("preserves API error %s instead of showing an empty list", async (status) => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "PAYROLL_RUN_NOT_FOUND" }), { status }));
  await expect(createPayrollService({ fetch, getAccessToken: () => "t" }).getRunIssues("r")).rejects.toMatchObject({
    status,
    code: "PAYROLL_RUN_NOT_FOUND",
  });
});
