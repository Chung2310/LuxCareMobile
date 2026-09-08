import { expect, it, vi } from "vitest";
import { createPayrollService } from "../../../../src/services/payrollService";
import { parsePeriodInputs, inputValue } from "./periodInputModel";
const item = {
  employeeId: "a",
  periodKey: "2026-09",
  version: 1,
  agreedSalary: 0,
  reconciledDays: 1.5,
  customValues: { OLD: 5 },
  reason: "note",
};
const data = {
  items: [item],
  variables: [{ code: "ACTIVE", name: "Active", unit: "number", defaultValue: 10 }],
  editable: true,
  needsRefresh: true,
};
it("preserves explicit zero, fractional days, unknown custom codes and refresh flags", () => {
  expect(parsePeriodInputs(data, "2026-09")).toEqual(data);
});
it("distinguishes missing input from zero", () => {
  expect(inputValue(0)).toBe("0");
  expect(inputValue(undefined)).not.toBe(inputValue(0));
  expect(inputValue(1.5)).toBe("1,5");
});
it("rejects mismatched periods, duplicates, invalid versions and malformed values", () => {
  for (const change of [
    { periodKey: "2026-08" },
    { employeeId: "" },
    { version: -1 },
    { version: 1.5 },
    { agreedSalary: null },
    { bonus: -1 },
    { deduction: Infinity },
    { customValues: [] },
    { customValues: { BAD: "10" } },
    { reason: {} },
  ])
    expect(() => parsePeriodInputs({ ...data, items: [{ ...item, ...change }] }, "2026-09")).toThrow();
  expect(() => parsePeriodInputs({ ...data, items: [item, item] }, "2026-09")).toThrow();
});
it("rejects malformed containers, flags and variable definitions", () => {
  for (const value of [
    null,
    [],
    { ...data, editable: "true" },
    { ...data, needsRefresh: undefined },
    { ...data, variables: null },
    { ...data, variables: [{ code: "A", name: "a", unit: "number", defaultValue: NaN }] },
    { ...data, variables: [data.variables[0], data.variables[0]] },
  ])
    expect(() => parsePeriodInputs(value, "2026-09")).toThrow();
  expect(
    parsePeriodInputs({ items: [], variables: [], editable: false, needsRefresh: false }, "2026-09").items,
  ).toEqual([]);
});
it("reuses authenticated period input GET and encodes period", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data })));
  expect(await createPayrollService({ fetch, getAccessToken: () => "t" }).getPeriodInputs("2026/09")).toEqual(data);
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/periods/2026%2F09/inputs",
    expect.objectContaining({ headers: { "Content-Type": "application/json", Authorization: "Bearer t" } }),
  );
});
it.each([403, 500])("preserves API failure %s instead of returning empty data", async (status) => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "failed" }), { status }));
  await expect(
    createPayrollService({ fetch, getAccessToken: () => "t" }).getPeriodInputs("2026-09"),
  ).rejects.toMatchObject({ status });
  expect(fetch).toHaveBeenCalledOnce();
});
