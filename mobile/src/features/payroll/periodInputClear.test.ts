import { expect, it, vi } from "vitest";
import { periodInputEditPayload, validateEditedPeriodInput } from "./periodInputEditModel";
import { createPayrollService } from "../../../../src/services/payrollService";
const item = { employeeId: "a", periodKey: "2026-09", version: 1, bonus: 0, allowance: 100, customValues: { OLD: 4 } };
it("clears explicit zero and deduplicates without sending a replacement value", () => {
  expect(periodInputEditPayload(item, { bonus: "50" }, "reason", ["bonus", "bonus"])).toEqual({
    expectedVersion: 1,
    reason: "reason",
    clearFields: ["bonus"],
  });
});
it("mixes clear and edits while keeping blank semantics and requiring reason", () => {
  expect(periodInputEditPayload(item, { allowance: "200" }, " reason ", ["bonus"])).toEqual({
    allowance: 200,
    expectedVersion: 1,
    reason: "reason",
    clearFields: ["bonus"],
  });
  expect(() => periodInputEditPayload(item, {}, "", ["bonus"])).toThrow();
  expect(() => periodInputEditPayload(item, { bonus: "" }, "reason")).toThrow();
});
it("rejects unknown, custom and absent fields", () => {
  for (const field of ["companyCode", "custom.OLD", "agreedSalary", "__proto__", "version"])
    expect(() => periodInputEditPayload(item, {}, "reason", [field])).toThrow();
});
it("requires cleared field absent, version incremented and other values preserved", () => {
  const payload = periodInputEditPayload(item, {}, "reason", ["bonus"]);
  const saved = { ...item, bonus: undefined, reason: "reason", version: 2 };
  expect(() => validateEditedPeriodInput(saved, item, payload)).not.toThrow();
  for (const change of [{ bonus: 0 }, { bonus: null }, { allowance: undefined }, { customValues: {} }, { version: 1 }])
    expect(() => validateEditedPeriodInput({ ...saved, ...change }, item, payload)).toThrow();
});
it("sends clearFields and version through shared PUT service", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} })));
  const payload = periodInputEditPayload(item, {}, "reason", ["bonus"]);
  await createPayrollService({ fetch, getAccessToken: () => "t" }).savePeriodInput(
    item.periodKey,
    item.employeeId,
    payload,
  );
  expect(fetch.mock.calls[0][1].body).toBe(JSON.stringify(payload));
  expect(fetch.mock.calls[0][1].method).toBe("PUT");
});
