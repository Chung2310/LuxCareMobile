import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";
export function recruitmentAccess(user: UserProfile | null) {
  if (!user) return { read: false, manage: false };
  const isManager = ["admin", "superadmin", "branch_owner", "manager"].includes(user?.role || "");
  const readPermission = isManager || hasPermission(user, "recruitment:read") || hasPermission(user, "hr:read");
  const managePermission = isManager || hasPermission(user, "recruitment:manage") || hasPermission(user, "hr:manage");
  const hrEnabled = isManager || canUseModule(user, "hr");
  const read = (!!user?.companyCode || isManager) && hrEnabled && readPermission;
  return { read: Boolean(read), manage: Boolean(read && managePermission) };
}
export const JOB_STATUSES = [
  { value: "draft", label: "Bản nháp" },
  { value: "open", label: "Đang tuyển" },
  { value: "paused", label: "Tạm dừng" },
  { value: "closed", label: "Đã đóng" },
];

