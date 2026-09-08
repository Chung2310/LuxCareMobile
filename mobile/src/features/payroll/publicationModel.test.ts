import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { createPayrollService } from "../../../../src/services/payrollService";
import {
  canPublishPayslips,
  canWithdrawPayslip,
  publicationEmployees,
  validatePublicationResponse,
  validateWithdrawalResponse,
} from "./publicationModel";
const user = {
  uid: "u",
  companyCode: "A",
  enabledModules: ["hr"],
  permissions: ["payroll-period:read", "payroll-payment:manage"],
} as UserProfile;
const run: PayrollRun = {
  _id: "r",
  periodKey: "2026-09",
  status: "closed",
  effectiveLines: [
    { employeeId: "a", calculation: {} },
    { employeeId: "b", calculation: {} },
  ],
};
it("withdraws only an effective published employee with management permission", () => {
  const published = { ...run, publishedEmployeeIds: ["a", "outside"] };
  expect(canWithdrawPayslip(user, published, "a")).toBe(true);
  expect(canWithdrawPayslip(user, { ...published, status: "paid" }, "a")).toBe(true);
  for (const id of ["b", "outside", ""]) expect(canWithdrawPayslip(user, published, id)).toBe(false);
  for (const value of [
    run,
    { ...published, status: "draft" },
    { ...published, effectiveLines: undefined },
    { ...published, effectiveError: { message: "stale" } },
  ])
    expect(canWithdrawPayslip(user, value, "a")).toBe(false);
  expect(canWithdrawPayslip(null, published, "a")).toBe(false);
  expect(
    canWithdrawPayslip({ ...user, permissions: ["payroll-period:read", "payroll-payment:read"] }, published, "a"),
  ).toBe(false);
});
it("validates the withdrawn employee and run rather than accepting any successful response", () => {
  const doc = { runId: "r", employeeId: "a", status: "withdrawn" };
  expect(() => validateWithdrawalResponse(doc, "r", "a")).not.toThrow();
  for (const value of [
    null,
    [],
    {},
    { ...doc, status: "published" },
    { ...doc, employeeId: "b" },
    { ...doc, runId: "other" },
  ])
    expect(() => validateWithdrawalResponse(value, "r", "a")).toThrow();
});
it("withdraws through the encoded authenticated endpoint without a publication payload", async () => {
  const doc = { runId: "r/1", employeeId: "a?2", status: "withdrawn" };
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: doc })));
  const value = await createPayrollService({ fetch, getAccessToken: () => "token" }).withdrawPayslip("r/1", "a?2");
  expect(value).toEqual(doc);
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/runs/r%2F1/payslips/a%3F2/withdraw",
    expect.objectContaining({
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
    }),
  );
  expect(fetch.mock.calls[0][1].body).toBeUndefined();
});
it.each([403, 404, 500])("does not retry a withdrawal refusal %s", async (status) => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "PAYSLIP_NOT_FOUND" }), { status }));
  await expect(
    createPayrollService({ fetch, getAccessToken: () => "t" }).withdrawPayslip("r", "a"),
  ).rejects.toMatchObject({ status, code: "PAYSLIP_NOT_FOUND" });
  expect(fetch).toHaveBeenCalledOnce();
});
it("requires period read, payment manage, HR company scope and a closed or paid run", () => {
  expect(canPublishPayslips(user, run)).toBe(true);
  expect(canPublishPayslips({ ...user, permissions: ["*"] }, { ...run, status: "paid" })).toBe(true);
  for (const status of ["draft", "calculated", "review", "unknown"])
    expect(canPublishPayslips(user, { ...run, status })).toBe(false);
  for (const permissions of [[], ["payroll-payment:manage"], ["payroll-period:read", "payroll-payment:read"]])
    expect(canPublishPayslips({ ...user, permissions }, run)).toBe(false);
  expect(canPublishPayslips(null, run)).toBe(false);
  expect(canPublishPayslips({ ...user, companyCode: "" }, run)).toBe(false);
  expect(canPublishPayslips({ ...user, enabledModules: ["crm"] }, run)).toBe(false);
});
it("deduplicates selected employees but never defaults empty selection to everyone", () => {
  expect(publicationEmployees(run, ["b", "b", "a"])).toEqual(["b", "a"]);
  for (const ids of [[], ["other"], ["a", "other"], [""]]) expect(() => publicationEmployees(run, ids)).toThrow();
  expect(() => publicationEmployees({ ...run, effectiveLines: undefined }, ["a"])).toThrow();
  expect(() => publicationEmployees({ ...run, effectiveError: { message: "stale" } }, ["a"])).toThrow("stale");
});
it("requires a complete, unique set of published records for the requested run", () => {
  const doc = { runId: "r", employeeId: "a", status: "published" };
  expect(() => validatePublicationResponse([doc], "r", ["a"])).not.toThrow();
  for (const response of [
    null,
    {},
    [],
    [null],
    [{ ...doc, status: "withdrawn" }],
    [{ ...doc, runId: "other" }],
    [{ ...doc, employeeId: "other" }],
  ])
    expect(() => validatePublicationResponse(response, "r", ["a"])).toThrow();
  expect(() => validatePublicationResponse([doc, doc], "r", ["a", "b"])).toThrow();
});
it("posts only explicit employee IDs through the encoded authenticated endpoint", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] })));
  await createPayrollService({ fetch, getAccessToken: () => "token" }).publishPayslips("r/1", ["a"]);
  expect(fetch).toHaveBeenCalledWith(
    "/api/v1/payroll/runs/r%2F1/payslips/publish",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ employeeIds: ["a"] }),
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
    }),
  );
});
it.each([403, 409, 500])("preserves refusal %s without retrying publication", async (status) => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: "PUBLICATION_FAILED" }), { status }));
  await expect(
    createPayrollService({ fetch, getAccessToken: () => "token" }).publishPayslips("r", ["a"]),
  ).rejects.toMatchObject({ status, code: "PUBLICATION_FAILED" });
  expect(fetch).toHaveBeenCalledOnce();
});
