import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { createPayrollService } from "../../../../src/services/payrollService";
import {
  canReadFormulas,
  canManageFormulas,
  canDeletePolicy,
  parsePolicies,
  policyForDate,
  policyDisplayStatus,
  overlappingPolicies,
} from "./formulaModel";
import {
  createDefaultPayrollPolicyForm,
  payrollPolicyFormToDefinition,
  policyDefinitionToForm,
  validatePayrollPolicyForm,
} from "./payrollPolicyForm";
const form = {
  ...createDefaultPayrollPolicyForm(),
  code: "v1",
  name: "Version 1",
  effectiveFrom: "2026-01-01",
};
const definition = payrollPolicyFormToDefinition(form);
const item = {
  ...definition,
  _id: "p/1",
  companyCode: "C",
  version: 2,
  status: "draft" as const,
};
it("requires policy read/manage permissions", () => {
  const user = {
    uid: "u",
    companyCode: "C",
    enabledModules: ["hr"],
    permissions: ["payroll-policy:read", "payroll-policy:manage"],
  } as UserProfile;
  expect(canManageFormulas(user)).toBe(true);
  expect(
    canReadFormulas({ ...user, permissions: ["payroll-policy:read"] }),
  ).toBe(true);
  expect(
    canManageFormulas({ ...user, permissions: ["payroll-period:manage"] }),
  ).toBe(false);
});
it("converts percentages to API fractions and round-trips without changing rates", () => {
  form.funds.health.employeeRate = 1.5;
  const payload = payrollPolicyFormToDefinition(form);
  expect(
    payload.funds.find((fund) => fund.code === "health")?.employeeRate,
  ).toBe(0.015);
  expect(payload.taxBrackets[0].rate).toBe(0.05);
  expect(payload.shortTermWithholdingRate).toBe(0.1);
  const edited = policyDefinitionToForm({
    ...payload,
    _id: "private",
    status: "active",
  });
  expect(edited.funds.health.employeeRate).toBe(1.5);
  expect(payrollPolicyFormToDefinition(edited)).toEqual(payload);
  expect(payrollPolicyFormToDefinition(edited)).not.toHaveProperty("_id");
  expect(payrollPolicyFormToDefinition(edited)).not.toHaveProperty("status");
});
it("does not introduce a contribution when an existing policy omits a fund", () => {
  const edited = policyDefinitionToForm({
    ...definition,
    funds: definition.funds.filter((fund) => fund.code !== "social"),
  });
  expect(edited.funds.social.employeeRate).toBe(0);
  expect(edited.funds.social.employerRate).toBe(0);
});
it("rejects out-of-range rates, bad tax brackets, dates and fractional monetary values", () => {
  for (const changed of [
    { effectiveFrom: "2026-02-30" },
    { personalDeduction: 1.5 },
    { nonResidentRate: 101 },
    {
      taxBrackets: [
        { upTo: "100", rate: 5 },
        { upTo: "50", rate: 10 },
        { upTo: "", rate: 20 },
      ],
    },
    { taxBrackets: [{ upTo: "100", rate: 5 }] },
    {
      taxBrackets: [
        { upTo: "1.5", rate: 5 },
        { upTo: "", rate: 10 },
      ],
    },
    {
      funds: {
        ...form.funds,
        health: { ...form.funds.health, employeeRate: NaN },
      },
    },
  ])
    expect(
      Object.keys(validatePayrollPolicyForm({ ...form, ...changed })),
    ).not.toHaveLength(0);
});
it("validates tenant and version and selects only the effective policy at period end", () => {
  const old = { ...item, status: "active" as const, effectiveTo: "2026-08-31" };
  const next = {
    ...item,
    _id: "p2",
    status: "active" as const,
    effectiveFrom: "2026-09-01",
  };
  expect(parsePolicies([old, next], "C")).toHaveLength(2);
  expect(policyForDate([old, next, item], "2026-09-30")).toEqual(next);
  expect(policyForDate([old, next], "2026-08-31")).toEqual(old);
  for (const data of [
    null,
    [{ ...item, companyCode: "OTHER" }],
    [{ ...item, version: -1 }],
    [item, item],
  ])
    expect(() => parsePolicies(data, "C")).toThrow();
  expect(
    overlappingPolicies([old, next], {
      ...item,
      _id: "new",
      effectiveFrom: "2026-09-01",
    }),
  ).toEqual([next]);
});
it("shows deletion only for draft and retired versions", () => {
  expect(canDeletePolicy(item)).toBe(true);
  expect(canDeletePolicy({ ...item, status: "retired" })).toBe(true);
  expect(canDeletePolicy({ ...item, status: "active" })).toBe(false);
});
it("uses policies endpoints for creating, updating and deleting versions", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify({ data: item })),
    );
  const service = createPayrollService({ fetch, getAccessToken: () => "t" });
  await service.createPolicy(definition);
  await service.updatePolicy(item._id, { ...definition, expectedVersion: 2 });
  await service.deletePolicy(item._id);
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/payroll/policies");
  expect(fetch.mock.calls[1][0]).toBe("/api/v1/payroll/policies/p%2F1");
  expect(JSON.parse(fetch.mock.calls[1][1].body).expectedVersion).toBe(2);
  expect(fetch.mock.calls[2][1]).toMatchObject({
    method: "DELETE",
    headers: { Authorization: "Bearer t" },
  });
});
it("only replaces overlapping policies when explicitly requested", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify({ data: item })),
    );
  const service = createPayrollService({ fetch, getAccessToken: () => "t" });
  await service.activatePolicy(item._id);
  await service.activatePolicy(item._id, { replaceOverlaps: true });
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({});
  expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({
    replaceOverlaps: true,
  });
});
it.each([403, 409, 500])(
  "surfaces deletion refusals %s without retrying",
  async (status) => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: "In use", code: "PAYROLL_POLICY_IN_USE" }),
          { status },
        ),
      );
    await expect(
      createPayrollService({ fetch, getAccessToken: () => "t" }).deletePolicy(
        item._id,
      ),
    ).rejects.toMatchObject({ status });
    expect(fetch).toHaveBeenCalledOnce();
  },
);

it("marks only the effective version as currently applied after replacement", () => {
  const old = { ...item, status: "active" as const, effectiveTo: "2026-08-31" };
  const next = { ...item, _id: "next", status: "active" as const, effectiveFrom: "2026-09-01" };
  const items = [old, next];
  expect(policyDisplayStatus(old, items, "2026-09-14")).toBe("expired");
  expect(policyDisplayStatus(next, items, "2026-09-14")).toBe("active");
  expect(policyDisplayStatus(old, items, "2026-08-31")).toBe("active");
  expect(policyDisplayStatus(next, items, "2026-08-31")).toBe("scheduled");
});

it("uses one effective version even when active date ranges overlap", () => {
  const old = { ...item, status: "active" as const };
  const next = { ...old, _id: "next", effectiveFrom: "2026-09-01" };
  expect(policyDisplayStatus(old, [old, next], "2026-09-14")).toBe("superseded");
  expect(policyDisplayStatus(next, [old, next], "2026-09-14")).toBe("active");
  expect(policyDisplayStatus(item, [item, next], "2026-09-14")).toBe("draft");
  expect(policyDisplayStatus({ ...old, status: "retired" }, [next], "2026-09-14")).toBe("retired");
});
