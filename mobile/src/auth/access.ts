import type { UserProfile } from "../../../src/types/common";
import { isModuleEnabled, type ModuleKey } from "../../../src/config/modules";
export function canUseModule(user: UserProfile | null, module: ModuleKey) {
  return !!user && (user.role === "superadmin" || (!!user.companyCode && isModuleEnabled(user.enabledModules, module)));
}
export function hasPermission(user: UserProfile | null, permission: string) {
  return !!user?.permissions?.some((value) => value === "*" || value === permission);
}
