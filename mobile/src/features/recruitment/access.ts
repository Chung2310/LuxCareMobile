import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";
export function recruitmentAccess(user: UserProfile | null) {
  const read = !!user?.companyCode && canUseModule(user, "hr") && hasPermission(user, "recruitment:read");
  return { read, manage: read && hasPermission(user, "recruitment:manage") };
}
export const JOB_STATUSES = [
  { value: "draft", label: "Bản nháp" },
  { value: "open", label: "Đang tuyển" },
  { value: "paused", label: "Tạm dừng" },
  { value: "closed", label: "Đã đóng" },
];
