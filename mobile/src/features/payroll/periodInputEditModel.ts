import type { UserProfile } from "../../../../src/types/common";
import { canCreatePayrollRun } from "./createRunModel";
import { validPayrollPeriod } from "./runModel";
import { parsePeriodInputs, periodInputFields, type PeriodInput, type PeriodInputs } from "./periodInputModel";
type Field = keyof typeof periodInputFields;
export function canEditPeriodInput(
  user: UserProfile | null,
  branchId: string | undefined,
  editable: boolean,
  item: PeriodInput,
) {
  return (
    canCreatePayrollRun(user, branchId) &&
    editable &&
    validPayrollPeriod(item.periodKey) &&
    !!item.employeeId &&
    Number.isSafeInteger(item.version) &&
    item.version >= 0 &&
    item.version < Number.MAX_SAFE_INTEGER
  );
}
export function periodInputEditPayload(
  item: PeriodInput,
  values: Record<string, string>,
  reason: string,
  clear: string[] = [],
  custom: Record<string, string> = {},
  variables: PeriodInputs["variables"] = [],
) {
  if (!reason.trim() || reason.trim().length > 1000) throw new Error("Nhập lý do đối soát từ 1 đến 1000 ký tự.");
  const changes: Partial<Record<Field, number>> = {};
  const safeCode = (code: string) =>
    /^[A-Za-z][A-Za-z0-9_]*$/.test(code) && !["constructor", "prototype"].includes(code);
  const customClears = clear.filter((key) => key.startsWith("custom."));
  if (
    clear.some((key) =>
      key.startsWith("custom.")
        ? !safeCode(key.slice(7)) ||
          !Object.hasOwn(item.customValues || {}, key.slice(7)) ||
          !variables.some((variable) => variable.code === key.slice(7))
        : !Object.hasOwn(periodInputFields, key) || item[key as Field] === undefined,
    )
  )
    throw new Error("Chỉ hoàn tác trường đối soát cơ bản đã có giá trị.");
  const clearFields = [...new Set(clear)];
  const customChanges: Record<string, number> = {};
  for (const [code, rawValue] of Object.entries(custom)) {
    const raw = rawValue.trim();
    if (!raw || clearFields.includes(`custom.${code}`)) continue;
    const variable = variables.find((variable) => variable.code === code);
    const value = Number(raw);
    if (
      !safeCode(code) ||
      !variable ||
      !/^\d+(\.\d+)?$/.test(raw) ||
      !Number.isFinite(value) ||
      value > Number.MAX_SAFE_INTEGER ||
      (variable.unit === "percent" && value > 100)
    )
      throw new Error("Biến tùy chỉnh phải đang áp dụng, có mã hợp lệ và giá trị không âm; phần trăm tối đa 100.");
    if (value !== item.customValues?.[code]) customChanges[code] = value;
  }
  if (Object.keys(customChanges).length && customClears.length)
    throw new Error("Lưu sửa và hoàn tác biến tùy chỉnh thành hai lần riêng để tránh xung đột dữ liệu.");
  if (Object.keys(customChanges).length && Object.keys(item.customValues || {}).some((code) => !safeCode(code)))
    throw new Error("Bản ghi có mã biến cũ không hợp lệ. Kiểm tra trên LuxCare trước khi sửa biến.");
  for (const key of Object.keys(periodInputFields) as Field[]) {
    if (clearFields.includes(key)) continue;
    const raw = values[key]?.trim();
    if (!raw) continue;
    const value = Number(raw);
    if (!/^\d+(\.\d+)?$/.test(raw) || !Number.isFinite(value) || value > Number.MAX_SAFE_INTEGER)
      throw new Error("Nhập số không âm, dùng dấu chấm cho phần thập phân và không có dấu phân cách hàng nghìn.");
    if (value !== item[key]) changes[key] = value;
  }
  if (!Object.keys(changes).length && !clearFields.length && !Object.keys(customChanges).length)
    throw new Error("Chưa có giá trị thay đổi. Ô trống giữ giá trị cũ.");
  return {
    ...changes,
    expectedVersion: item.version,
    reason: reason.trim(),
    ...(clearFields.length ? { clearFields } : {}),
    ...(Object.keys(customChanges).length ? { customValues: { ...item.customValues, ...customChanges } } : {}),
  };
}
export function validateEditedPeriodInput(
  value: unknown,
  original: PeriodInput,
  payload: ReturnType<typeof periodInputEditPayload>,
) {
  const result = parsePeriodInputs(
    { items: [value], variables: [], editable: true, needsRefresh: true },
    original.periodKey,
  ).items[0];
  if (
    result.employeeId !== original.employeeId ||
    result.version !== original.version + 1 ||
    result.reason !== payload.reason ||
    (Object.keys(periodInputFields) as Field[]).some(
      (key) => result[key] !== (payload.clearFields?.includes(key) ? undefined : (payload[key] ?? original[key])),
    ) ||
    Object.keys({ ...original.customValues, ...payload.customValues, ...result.customValues }).some(
      (key) =>
        result.customValues?.[key] !==
        (payload.clearFields?.includes(`custom.${key}`)
          ? undefined
          : (payload.customValues ?? original.customValues)?.[key]),
    )
  )
    throw new Error("Phản hồi đối soát chưa khớp nhân viên, phiên bản hoặc giá trị. Tải lại để kiểm tra.");
}
