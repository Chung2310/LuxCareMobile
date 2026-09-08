import { expect, it, vi } from "vitest";
import { createPayrollService } from "../../../../src/services/payrollService";
import { auditTime, filterPayrollAudit } from "./auditModel";
it("filters action and actor while retaining unknown actions", () => {
  const items = [
    { _id: "1", periodKey: "2026-09", action: "close", actorId: "ADMIN" },
    { _id: "2", periodKey: "2026-09", action: "new_action", actorId: "user" },
  ];
  expect(filterPayrollAudit(items, "close", " admin ")).toEqual([items[0]]);
  expect(filterPayrollAudit(items, "", "chốt")).toEqual([items[0]]);
  expect(filterPayrollAudit(items, "new_action", "")).toEqual([items[1]]);
});
it("handles missing dates and displays Vietnam local time", () => {
  expect(auditTime("invalid")).toBe("—");
  expect(auditTime()).toBe("—");
  expect(auditTime("2026-09-08T00:00:00Z")).toContain("07:00:00");
});
it("requests the encoded period with auth and rejects wrong-period data", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ periodKey: "2026-08" }] })));
  await expect(createPayrollService({ fetch, getAccessToken: () => "token" }).getAudit("2026/09")).rejects.toThrow(
    "khớp kỳ",
  );
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/payroll/periods/2026%2F09/audit");
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
});
