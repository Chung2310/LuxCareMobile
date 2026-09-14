import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";
import {
  policyDefinitionToForm,
  validatePayrollPolicyForm,
  type PayrollPolicyDefinition,
} from "./payrollPolicyForm";
export type PayrollPolicyVersion = PayrollPolicyDefinition & {
  _id: string;
  companyCode: string;
  status: "draft" | "active" | "retired";
  version: number;
};
export const formulaStatuses = {
  draft: "Nháp",
  active: "Đang áp dụng",
  retired: "Ngưng áp dụng",
};
export const fundLabels = {
  social: "BHXH",
  health: "BHYT",
  unemployment: "BHTN",
  accident: "Tai nạn lao động",
  union: "Công đoàn",
};
export const canReadFormulas = (user: UserProfile | null) =>
  !!user?.companyCode &&
  canUseModule(user, "hr") &&
  hasPermission(user, "payroll-policy:read");
export const canManageFormulas = (user: UserProfile | null) =>
  canReadFormulas(user) && hasPermission(user, "payroll-policy:manage");
export const canDeletePolicy = (item: PayrollPolicyVersion) =>
  ["draft", "retired"].includes(item.status);
export function parsePolicies(
  value: unknown,
  company: string,
): PayrollPolicyVersion[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (item) =>
        !item ||
        typeof item._id !== "string" ||
        !item._id ||
        item.companyCode !== company ||
        !Object.hasOwn(formulaStatuses, item.status) ||
        !Number.isSafeInteger(item.version) ||
        item.version < 0 ||
        !Array.isArray(item.funds) ||
        !Array.isArray(item.taxBrackets) ||
        !item.overtime,
    )
  )
    throw Error(
      "Danh sách phiên bản công thức không hợp lệ hoặc không thuộc công ty hiện tại.",
    );
  if (new Set(value.map((item) => item._id)).size !== value.length)
    throw Error("Danh sách phiên bản bị trùng mã định danh.");
  for (const item of value) {
    if (
      typeof item.code !== "string" ||
      typeof item.name !== "string" ||
      item.funds.some(
        (fund: any) =>
          !fund ||
          !Object.hasOwn(fundLabels, fund.code) ||
          !Number.isFinite(fund.employeeRate) ||
          !Number.isFinite(fund.employerRate),
      )
    )
      throw Error("Cấu hình phiên bản công thức không hợp lệ.");
    const errors = validatePayrollPolicyForm(policyDefinitionToForm(item));
    if (Object.keys(errors).length)
      throw Error(
        "Cấu hình phiên bản công thức không hợp lệ: " +
          Object.values(errors)[0],
      );
  }
  return value;
}
export function policyForDate(items: PayrollPolicyVersion[], date: string) {
  return items
    .filter(
      (item) =>
        item.status === "active" &&
        item.effectiveFrom.slice(0, 10) <= date &&
        (!item.effectiveTo || item.effectiveTo.slice(0, 10) >= date),
    )
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
}
export function overlappingPolicies(
  items: PayrollPolicyVersion[],
  target: PayrollPolicyVersion,
) {
  // Activation removes the target's end date on the existing backend.
  return items.filter(
    (item) =>
      item._id !== target._id &&
      item.status === "active" &&
      (!item.effectiveTo ||
        item.effectiveTo.slice(0, 10) >= target.effectiveFrom.slice(0, 10)),
  );
}
export function percentLabel(rate: number) {
  return (
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 4 }).format(
      rate * 100,
    ) + "%"
  );
}
