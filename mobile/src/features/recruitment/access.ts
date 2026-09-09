import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";
export function recruitmentAccess(user: UserProfile | null) {
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const readPermission = isAdmin || hasPermission(user, "recruitment:read") || hasPermission(user, "hr:read");
  const managePermission = isAdmin || hasPermission(user, "recruitment:manage") || hasPermission(user, "hr:manage");
  const read = !!user?.companyCode && canUseModule(user, "hr") && readPermission;
  return { read, manage: read && managePermission };
}
export const JOB_STATUSES = [
  { value: "draft", label: "Bản nháp" },
  { value: "open", label: "Đang tuyển" },
  { value: "paused", label: "Tạm dừng" },
  { value: "closed", label: "Đã đóng" },
];
