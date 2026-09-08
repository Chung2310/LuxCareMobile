export const periodInputFields = {
  agreedSalary: "Lương thỏa thuận (VND)",
  reconciledDays: "Ngày đối soát",
  reconciledHours: "Giờ đối soát",
  allowance: "Phụ cấp (VND)",
  bonus: "Thưởng (VND)",
  deduction: "Khấu trừ (VND)",
};
type InputField = keyof typeof periodInputFields;
export type PeriodInput = Partial<Record<InputField, number>> & {
  employeeId: string;
  periodKey: string;
  reason?: string;
  version: number;
  customValues?: Record<string, number>;
  updatedBy?: string;
};
export type PeriodInputs = {
  items: PeriodInput[];
  variables: { code: string; name: string; unit: string; defaultValue?: number }[];
  editable: boolean;
  needsRefresh: boolean;
};
const record = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
export function parsePeriodInputs(value: unknown, period: string): PeriodInputs {
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.variables) ||
    typeof value.editable !== "boolean" ||
    typeof value.needsRefresh !== "boolean" ||
    value.items.some(
      (item) =>
        !record(item) ||
        item.periodKey !== period ||
        typeof item.employeeId !== "string" ||
        !item.employeeId ||
        !Number.isSafeInteger(item.version) ||
        item.version < 0 ||
        Object.keys(periodInputFields).some((key) => item[key] !== undefined && !number(item[key])) ||
        (item.customValues !== undefined &&
          (!record(item.customValues) || Object.values(item.customValues).some((value) => !number(value)))) ||
        ["reason", "updatedBy"].some((key) => item[key] !== undefined && typeof item[key] !== "string"),
    ) ||
    new Set(value.items.map((item) => item.employeeId)).size !== value.items.length ||
    value.variables.some(
      (variable) =>
        !record(variable) ||
        typeof variable.code !== "string" ||
        !variable.code ||
        typeof variable.name !== "string" ||
        typeof variable.unit !== "string" ||
        (variable.defaultValue !== undefined &&
          (typeof variable.defaultValue !== "number" || !Number.isFinite(variable.defaultValue))),
    ) ||
    new Set(value.variables.map((variable) => variable.code)).size !== value.variables.length
  )
    throw new Error("Dữ liệu đối soát không hợp lệ hoặc không khớp kỳ lương.");
  return value as PeriodInputs;
}
export function inputValue(value: number | undefined) {
  return value === undefined
    ? "Chưa nhập — dùng dữ liệu nguồn"
    : value.toLocaleString("vi-VN", { maximumFractionDigits: 10 });
}
