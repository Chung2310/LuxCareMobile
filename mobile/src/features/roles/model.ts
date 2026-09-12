import type { UserProfile } from "../../../../src/types/common";
import type { RolePermission, Permission } from "../../../../src/services/rolePermissionService";
import { DEFAULT_ROLE_PERMISSIONS, normalizePermissions, PERMISSION_CATALOG } from "../../../../shared/permissions";
import { getRoleDisplayName } from "../../../../src/utils/permissionUtils";

export const canManageRoles = (user: Pick<UserProfile, "role"> | null) =>
  user?.role === "admin" || user?.role === "superadmin";

export function canEditRole(user: Pick<UserProfile, "role"> | null, role: string) {
  return canManageRoles(user) && role !== "superadmin" &&
    (user?.role === "superadmin" || (role !== "admin" && role !== user?.role));
}
export function roleTitle(role: RolePermission) {
  return role.displayName?.trim() || getRoleDisplayName(role.role);
}
export function roleSlug(name: string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[đĐ]/g, "d")
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
export function withDefaultRoles(records: RolePermission[], companyCode: string): RolePermission[] {
  const defaults = [["admin", 2], ["branch_owner", 3], ["manager", 4], ["user", 5]] as const;
  const result = new Map(defaults.map(([role, level]) => [role as string, {
    role, level, companyCode, displayName: getRoleDisplayName(role),
    permissions: DEFAULT_ROLE_PERMISSIONS[role] || [],
  } as RolePermission]));
  records.filter(record => record.companyCode === companyCode).forEach(record => result.set(record.role, record));
  return [...result.values()].sort((a, b) => a.level - b.level || roleTitle(a).localeCompare(roleTitle(b), "vi"));
}
export function togglePermission(selected: string[], code: string) {
  if (selected.includes("*")) return selected;
  // Removing a read permission also removes grants that imply it.
  const next = selected.includes(code)
    ? selected.filter(item => item !== code && !PERMISSION_CATALOG.find(entry => entry.code === item)?.implies?.includes(code))
    : [...selected, code];
  const normalized = normalizePermissions(next);
  // Preserve server catalog entries newer than the app's bundled catalog.
  return [...normalized.permissions, ...normalized.unknown];
}
export function groupPermissions(catalog: Permission[], search: string) {
  const groups = new Map<string, Permission[]>();
  const needle = search.trim().toLocaleLowerCase("vi");
  for (const item of catalog) {
    const local = PERMISSION_CATALOG.find(entry => entry.code === item.code);
    const permission = { ...item, name: local?.label || item.name, description: local?.description || item.description };
    const group = item.group || local?.group || item.module || "Khác";
    if (needle && !(permission.name + " " + item.code + " " + group).toLocaleLowerCase("vi").includes(needle)) continue;
    groups.set(group, [...(groups.get(group) || []), permission]);
  }
  return [...groups.entries()];
}
