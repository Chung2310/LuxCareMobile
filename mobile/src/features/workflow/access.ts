import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";

const managerRoles = new Set(["superadmin", "admin", "branch_owner", "manager"]);

export function workflowAccess(user: UserProfile | null) {
  const isSuper = user?.role === "superadmin";
  const enabled = canUseModule(user, "hr");
  const manager = !!user && managerRoles.has(user.role);
  const readPermission =
    isSuper ||
    manager ||
    hasPermission(user, "hr:read") ||
    hasPermission(user, "user:read") ||
    hasPermission(user, "workflow:read") ||
    hasPermission(user, "workflow:manage") ||
    !!user?.companyCode;
  const managePermission = isSuper || manager || hasPermission(user, "hr:manage") || hasPermission(user, "workflow:manage");

  return {
    read: isSuper || (enabled && readPermission) || (!!user?.companyCode && readPermission),
    manage: isSuper || (enabled && managePermission) || (manager && !!user?.companyCode),
  };
}
