import { expect, it } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { newPeriodInput, periodInputCandidates } from "./createPeriodInputModel";
import { periodInputEditPayload, validateEditedPeriodInput } from "./periodInputEditModel";
const employee = { uid: "a", displayName: "A", companyCode: "C", branchId: "B" } as UserProfile;
it("filters branch/company, existing inputs and duplicate employee IDs", () => {
  const employees = [
    employee,
    employee,
    { ...employee, uid: "b" },
    { ...employee, uid: "c", branchId: "other" },
    { ...employee, uid: "d", companyCode: "other" },
    { ...employee, uid: "" },
  ];
  expect(periodInputCandidates(employees, [{ employeeId: "b", periodKey: "2026-09", version: 1 }], "C", "B")).toEqual([
    employee,
  ]);
});
it("requires a valid period and employee from the filtered roster", () => {
  expect(newPeriodInput("a", "2026-09", [employee])).toEqual({ employeeId: "a", periodKey: "2026-09", version: 0 });
  expect(() => newPeriodInput("other", "2026-09", [employee])).toThrow();
  expect(() => newPeriodInput("a", "2026-13", [employee])).toThrow();
});
it("requires a value and reason while accepting explicit zero on creation", () => {
  const item = newPeriodInput("a", "2026-09", [employee]);
  expect(() => periodInputEditPayload(item, {}, "reason")).toThrow();
  expect(() => periodInputEditPayload(item, { bonus: "0" }, "")).toThrow();
  expect(periodInputEditPayload(item, { bonus: "0" }, "reason")).toEqual({
    bonus: 0,
    reason: "reason",
    expectedVersion: 0,
  });
});
it("creates custom inputs without filling default or absent basic values", () => {
  const item = newPeriodInput("a", "2026-09", [employee]);
  expect(
    periodInputEditPayload(item, {}, "reason", [], { A: "5" }, [
      { code: "A", name: "A", unit: "number", defaultValue: 10 },
    ]),
  ).toEqual({ reason: "reason", expectedVersion: 0, customValues: { A: 5 } });
});
it("validates version one and rejects an unexpected pre-existing record", () => {
  const item = newPeriodInput("a", "2026-09", [employee]);
  const payload = periodInputEditPayload(item, { bonus: "0" }, "reason");
  expect(() =>
    validateEditedPeriodInput({ ...item, bonus: 0, reason: "reason", version: 1 }, item, payload),
  ).not.toThrow();
  expect(() =>
    validateEditedPeriodInput({ ...item, bonus: 0, allowance: 50, reason: "reason", version: 1 }, item, payload),
  ).toThrow();
  expect(() => validateEditedPeriodInput({ ...item, bonus: 0, reason: "reason", version: 2 }, item, payload)).toThrow();
});
