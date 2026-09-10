import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";
export function recruitmentAccess(user: UserProfile | null) {
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  // Keep the mobile guard aligned with the recruitment router in LuxCare.
  // hr:read/hr:manage alone must not open a screen whose API calls will be denied.
  const readPermission = isAdmin || hasPermission(user, "recruitment:read");
  const managePermission = isAdmin || hasPermission(user, "recruitment:manage");
  const read = !!user?.companyCode && canUseModule(user, "hr") && readPermission;
  return { read, manage: read && managePermission };
}
export const JOB_STATUSES = [
  { value: "draft", label: "Bản nháp" },
  { value: "open", label: "Đang tuyển" },
  { value: "paused", label: "Tạm dừng" },
  { value: "closed", label: "Đã đóng" },
];
