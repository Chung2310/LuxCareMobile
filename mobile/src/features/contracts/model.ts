import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";
export function canReadContracts(user: UserProfile | null) {
  return !!user?.companyCode && canUseModule(user, "hr") && hasPermission(user, "hr:read");
}
export function canManageContracts(user: UserProfile | null) {
  return canReadContracts(user) && hasPermission(user, "hr:manage");
}
export const contractStatuses = {
  draft: "Bản nháp",
  active: "Đang hiệu lực",
  expired: "Hết hạn",
  terminated: "Đã chấm dứt",
};
export function contractDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}
