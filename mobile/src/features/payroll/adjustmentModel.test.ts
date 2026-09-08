import { expect, it, vi } from "vitest";
import type { PayrollAdjustment } from "../../../../src/types/payrollAdjustment";
import { createPayrollService } from "../../../../src/services/payrollService";
import { filterAdjustments } from "./adjustmentModel";
const items: PayrollAdjustment[] = [
  {
    _id: "a",
    periodKey: "2026-09",
    employeeId: "e",
    employeeName: "Nguyễn An",
    kind: "bonus",
    amount: 100,
    reason: "Hoàn thành việc",
    status: "approved",
  },
  {
    _id: "b",
    periodKey: "2026-09",
    employeeId: "f",
    kind: "deduction",
    amount: 50,
    reason: "Điều chỉnh công",
    status: "pending",
  },
];
it("combines employee/reason, kind and status filters without altering amounts", () => {
  expect(filterAdjustments(items, " NGUYỄN ", "approved", "bonus")).toEqual([items[0]]);
  expect(filterAdjustments(items, "công", "pending", "deduction")).toEqual([items[1]]);
  expect(filterAdjustments(items, "", "snapshotted", "")).toEqual([]);
  expect(filterAdjustments(items, "", "", "")).toEqual(items);
});
it("uses authenticated period endpoint and retains status from API", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: items })));
  const service = createPayrollService({ fetch, getAccessToken: () => "token" });
  expect(await service.getAdjustments("2026-09")).toEqual(items);
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/payroll/periods/2026-09/adjustments");
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
});
it("rejects wrong-period and malformed data, preserving permission errors", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: items })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 }));
  const service = createPayrollService({ fetch, getAccessToken: () => "token" });
  await expect(service.getAdjustments("2026/08")).rejects.toThrow("khớp kỳ");
  expect(fetch.mock.calls[0][0]).toContain("2026%2F08");
  await expect(service.getAdjustments("2026-09")).rejects.toThrow();
  await expect(service.getAdjustments("2026-09")).rejects.toMatchObject({ status: 403 });
});
