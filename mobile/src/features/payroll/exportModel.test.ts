import { expect, it } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { canExportPayroll } from "./exportModel";
const user = {
  uid: "u",
  companyCode: "A",
  enabledModules: ["hr"],
  permissions: ["payroll-period:read", "payroll-payment:read"],
  role: "admin",
} as UserProfile;
it("exports closed and paid runs only", () => {
  for (const status of ["draft", "calculated", "reviewed", "unknown"])
    expect(canExportPayroll(user, status, "detailed")).toBe(false);
  for (const status of ["closed", "paid"])
    for (const type of ["detailed", "insurance", "pit"] as const)
      expect(canExportPayroll(user, status, type)).toBe(true);
});
it("requires explicit read permissions and HR company scope", () => {
  expect(canExportPayroll(null, "closed", "pit")).toBe(false);
  for (const permissions of [[], ["payroll-payment:manage"], ["payroll-payment:read"], ["payroll-period:read"]])
    expect(canExportPayroll({ ...user, permissions }, "closed", "pit")).toBe(false);
  expect(canExportPayroll({ ...user, enabledModules: ["crm"] }, "closed", "pit")).toBe(false);
  expect(canExportPayroll({ ...user, companyCode: "" }, "closed", "pit")).toBe(false);
});
it("requires payment manage in addition to read for bank transfer", () => {
  expect(canExportPayroll(user, "closed", "bank_transfer")).toBe(false);
  expect(
    canExportPayroll(
      { ...user, permissions: [...user.permissions!, "payroll-payment:manage"] },
      "closed",
      "bank_transfer",
    ),
  ).toBe(true);
  expect(canExportPayroll({ ...user, permissions: ["*"] }, "paid", "bank_transfer")).toBe(true);
});
