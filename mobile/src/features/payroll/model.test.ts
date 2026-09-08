import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { createPayrollService } from "../../../../src/services/payrollService";
import { buildPayrollDetails } from "../../../../src/components/hr/payrollDetails";
import { canReadPayslips, payslipMoney, payslipsForPeriod } from "./model";
import { availableModules } from "../navigation/modules";
it("allows employees to view their own payslips without payroll management permission", () => {
  const user = { uid: "u", companyCode: "COMP", enabledModules: ["hr"], permissions: [], role: "user" } as UserProfile;
  expect(canReadPayslips(user)).toBe(true);
  expect(availableModules(user).some((item) => item.href === "/(tabs)/payslips")).toBe(true);
  expect(canReadPayslips({ ...user, companyCode: "" })).toBe(false);
  expect(canReadPayslips({ ...user, enabledModules: ["chat"] })).toBe(false);
  expect(canReadPayslips(null)).toBe(false);
});
it("uses only the current employee endpoint and encodes detail identifiers", async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: [] })));
  const service = createPayrollService({ fetch, getAccessToken: () => "token" });
  expect(await service.getEmployeePayslips()).toEqual([]);
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/payroll/employee/me/payslips");
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
  await service.getLineDetail("run/part", "employee?one");
  expect(fetch.mock.calls[1][0]).toBe("/api/v1/payroll/runs/run%2Fpart/lines/employee%3Fone");
});
it("preserves permission and publication errors instead of returning empty results", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ code: "PAYSLIP_NOT_PUBLISHED", message: "Unavailable" }), { status: 404 }),
    );
  const service = createPayrollService({ fetch, getAccessToken: () => "token" });
  await expect(service.getLineDetail("run", "employee")).rejects.toMatchObject({
    status: 404,
    code: "PAYSLIP_NOT_PUBLISHED",
  });
});
it("rejects malformed lists", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} })));
  await expect(createPayrollService({ fetch, getAccessToken: () => null }).getEmployeePayslips()).rejects.toThrow(
    "không hợp lệ",
  );
});
it("filters by exact period and sorts without changing source order or paid amounts", () => {
  const base = { runId: "run", employeeId: "e", netPay: 150, paidAmount: 100, balance: 50 };
  const items = [
    { ...base, periodKey: "2026-01" },
    { ...base, periodKey: "2026-09" },
  ];
  expect(payslipsForPeriod(items, "").map((item) => item.periodKey)).toEqual(["2026-09", "2026-01"]);
  expect(payslipsForPeriod(items, "2026-01")).toEqual([items[0]]);
  expect(items[0].periodKey).toBe("2026-01");
});
it("reuses FE detail precedence and displays invalid money as unavailable", () => {
  const detail = buildPayrollDetails({ monthlySalary: 100 }, { monthlySalary: 200, gross: 180, net: 150 });
  expect(detail.monthlySalary).toBe(200);
  expect(detail.gross).toBe(180);
  expect(detail.net).toBe(150);
  expect(payslipMoney(NaN)).toBe("—");
  expect(payslipMoney(0)).toContain("0");
});
