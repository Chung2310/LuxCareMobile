import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";

export function trainingAccess(user: UserProfile | null) {
  const read = !!user?.companyCode && canUseModule(user, "hr");
  const managerRole = user?.role === "admin" || user?.role === "manager" || user?.role === "superadmin";
  const manage = read && (managerRole || hasPermission(user, "hr:manage"));
  return { read, manage };
}
