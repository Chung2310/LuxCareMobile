import type { UserProfile } from "../../../../src/types/common";
import { hasPermission } from "../../auth/access";
import { canReadPayrollRuns } from "./runModel";
export const variableUnits = {
  money: "Tiền (VND)",
  number: "Số",
  days: "Ngày",
  hours: "Giờ",
  minutes: "Phút",
  percent: "Phần trăm",
};
export const variableStatuses = { draft: "Nháp", active: "Đang áp dụng", retired: "Ngưng áp dụng" };
export type PayrollVariable = {
  _id: string;
  companyCode: string;
  code: string;
  name: string;
  unit: string;
  status: string;
  version: number;
  description?: string;
  defaultValue?: number;
};
export function canManageVariables(user: UserProfile | null) {
  return canReadPayrollRuns(user) && hasPermission(user, "payroll-period:manage");
}
export function parseVariables(value: unknown, company: string): PayrollVariable[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (item) =>
        !item ||
        typeof item._id !== "string" ||
        !item._id ||
        item.companyCode !== company ||
        typeof item.code !== "string" ||
        !item.code ||
        typeof item.name !== "string" ||
        typeof item.unit !== "string" ||
        typeof item.status !== "string" ||
        !Number.isSafeInteger(item.version) ||
        item.version < 0 ||
        (item.description !== undefined && typeof item.description !== "string") ||
        (item.defaultValue !== undefined &&
          (typeof item.defaultValue !== "number" || !Number.isFinite(item.defaultValue))),
    ) ||
    new Set(value.map((item) => item._id)).size !== value.length
  )
    throw new Error("Danh mục biến không hợp lệ hoặc không thuộc công ty hiện tại.");
  return value;
}
export function variableInput(
  code: string,
  name: string,
  unit: string,
  value: string,
  description: string,
  existing: PayrollVariable[],
) {
  code = code.trim();
  name = name.trim();
  description = description.trim();
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(code) || ["constructor", "prototype"].includes(code))
    throw new Error("Mã biến bắt đầu bằng chữ, tối đa 64 ký tự chữ/số/gạch dưới.");
  if (existing.some((item) => item.code === code)) throw new Error("Mã biến đã có trong công ty.");
  if (!name || name.length > 200 || description.length > 1000)
    throw new Error("Tên từ 1–200 ký tự; mô tả tối đa 1000 ký tự.");
  if (!Object.hasOwn(variableUnits, unit)) throw new Error("Chọn đơn vị hợp lệ.");
  const raw = value.trim(),
    defaultValue = Number(raw);
  if (
    raw &&
    (!/^\d+(\.\d+)?$/.test(raw) ||
      !Number.isFinite(defaultValue) ||
      defaultValue > Number.MAX_SAFE_INTEGER ||
      (unit === "percent" && defaultValue > 100))
  )
    throw new Error("Mặc định phải là số không âm; phần trăm tối đa 100. Dùng dấu chấm cho thập phân.");
  return { code, name, unit, ...(raw ? { defaultValue } : {}), ...(description ? { description } : {}) };
}
export function validateVariableDraft(value: unknown, company: string, payload: ReturnType<typeof variableInput>) {
  const saved = parseVariables([value], company)[0];
  if (
    saved.status !== "draft" ||
    saved.version !== 0 ||
    saved.code !== payload.code ||
    saved.name !== payload.name ||
    saved.unit !== payload.unit ||
    saved.defaultValue !== payload.defaultValue ||
    (saved.description || "") !== (payload.description || "")
  )
    throw new Error("Chưa xác nhận được biến nháp đúng nội dung. Tải lại danh mục để kiểm tra.");
}
