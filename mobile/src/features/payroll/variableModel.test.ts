import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { createPayrollService } from "../../../../src/services/payrollService";
import { canManageVariables, parseVariables, variableInput, validateVariableDraft } from "./variableModel";
const item = { _id: "v", companyCode: "C", code: "BONUS", name: "Bonus", unit: "money", status: "draft", version: 0 };
it("requires HR/company/read/manage for creation", () => {
  const user = {
    uid: "u",
    companyCode: "C",
    enabledModules: ["hr"],
    permissions: ["payroll-period:read", "payroll-period:manage"],
  } as UserProfile;
  expect(canManageVariables(user)).toBe(true);
  for (const value of [
    null,
    { ...user, companyCode: undefined },
    { ...user, enabledModules: ["crm"] },
    { ...user, permissions: ["payroll-period:read"] },
  ])
    expect(canManageVariables(value)).toBe(false);
});
it("validates company, duplicates and numeric defaults while preserving unknown states", () => {
  expect(parseVariables([{ ...item, status: "new-status" }], "C")).lengthOf(1);
  for (const value of [
    null,
    [item, item],
    [{ ...item, companyCode: "other" }],
    [{ ...item, defaultValue: "0" }],
    [{ ...item, version: -1 }],
  ])
    expect(() => parseVariables(value, "C")).toThrow();
});
it("trims text and distinguishes blank default from zero", () => {
  expect(variableInput(" A ", " Name ", "number", "", "", [])).toEqual({ code: "A", name: "Name", unit: "number" });
  expect(variableInput("A", "Name", "number", "0", " info ", [])).toEqual({
    code: "A",
    name: "Name",
    unit: "number",
    defaultValue: 0,
    description: "info",
  });
});
it("rejects duplicate or unsafe codes and invalid units/defaults", () => {
  expect(() => variableInput("BONUS", "Name", "money", "", "", [item])).toThrow();
  for (const code of ["a.b", "1A", "constructor", "a".repeat(65)])
    expect(() => variableInput(code, "Name", "number", "", "", [])).toThrow();
  for (const value of ["-1", "1,000", "1e3", "Infinity", "101"])
    expect(() => variableInput("A", "Name", "percent", value, "", [])).toThrow();
  expect(() => variableInput("A", "Name", "other", "", "", [])).toThrow();
});
it("verifies created draft content and initial version", () => {
  const payload = variableInput("BONUS", "Bonus", "money", "", "", []);
  expect(() => validateVariableDraft(item, "C", payload)).not.toThrow();
  for (const change of [{ status: "active" }, { version: 1 }, { name: "other" }, { defaultValue: 0 }])
    expect(() => validateVariableDraft({ ...item, ...change }, "C", payload)).toThrow();
});
it("reuses authenticated list and create endpoints", async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: item })));
  const service = createPayrollService({ fetch, getAccessToken: () => "t" });
  await service.getPeriodInputVariables();
  const payload = variableInput("BONUS", "Bonus", "money", "", "", []);
  await service.createPeriodInputVariable(payload);
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/payroll/period-input-variables");
  expect(fetch.mock.calls[1][1]).toMatchObject({
    method: "POST",
    body: JSON.stringify(payload),
    headers: { Authorization: "Bearer t" },
  });
});
it.each([403, 409, 500])("preserves creation error %s without retrying", async (status) => {
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ code: "PAYROLL_PERIOD_INPUT_ERROR" }), { status }));
  await expect(
    createPayrollService({ fetch, getAccessToken: () => "t" }).createPeriodInputVariable({}),
  ).rejects.toMatchObject({ status });
  expect(fetch).toHaveBeenCalledOnce();
});
