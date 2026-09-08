import type { UserProfile } from "../../../../src/types/common";
import { canManageVariables, parseVariables, type PayrollVariable } from "./variableModel";
export type VariableAction = "activate" | "retire";
export function canTransitionVariable(user: UserProfile | null, item: PayrollVariable, action: VariableAction) {
  return (
    canManageVariables(user) &&
    item.companyCode === user?.companyCode &&
    !!item._id &&
    (action === "activate" ? ["draft", "retired"].includes(item.status) : item.status === "active")
  );
}
export function validateVariableTransition(value: unknown, original: PayrollVariable, action: VariableAction) {
  const saved = parseVariables([value], original.companyCode)[0];
  if (
    saved._id !== original._id ||
    saved.status !== (action === "activate" ? "active" : "retired") ||
    saved.code !== original.code ||
    saved.name !== original.name ||
    saved.unit !== original.unit ||
    saved.defaultValue !== original.defaultValue ||
    saved.description !== original.description ||
    saved.version !== original.version
  )
    throw new Error("Kết quả chuyển trạng thái biến chưa khớp dữ liệu đã xem. Tải lại để kiểm tra.");
}
