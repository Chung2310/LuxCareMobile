import type { UserProfile } from "../../../../src/types/common";
import { canUseModule, hasPermission } from "../../auth/access";

const managerRoles = new Set(["superadmin", "admin", "manager"]);

export function workflowAccess(user: UserProfile | null) {
  const enabled = canUseModule(user, "hr");
  const manager = !!user && managerRoles.has(user.role);
  const readPermission =
    hasPermission(user, "hr:read") ||
    hasPermission(user, "user:read") ||
    hasPermission(user, "workflow:read") ||
    hasPermission(user, "workflow:manage");
  const managePermission = hasPermission(user, "hr:manage") || hasPermission(user, "workflow:manage");

  return {
    read: enabled && (manager || readPermission),
    manage: enabled && (manager || managePermission),
  };
}
