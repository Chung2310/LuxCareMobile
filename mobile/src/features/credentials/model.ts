import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";
export function canReadCredentials(user: UserProfile | null) {
  return (
    !!user?.companyCode &&
    canUseModule(user, "hr") &&
    (hasPermission(user, "credentials:read") || hasPermission(user, "hr:read"))
  );
}
export const credentialTypes = {
  professional_degree: "Bằng chuyên môn",
  practice_certificate: "Chứng chỉ hành nghề",
  training_certificate: "Chứng nhận đào tạo",
  other: "Khác",
};
export const credentialStatuses = { active: "Còn hiệu lực", expiring: "Sắp hết hạn", expired: "Đã hết hạn" };
