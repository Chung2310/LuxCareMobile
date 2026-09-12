export function isAdministrativeRole(role?: string): boolean {
  return ["admin", "superadmin"].includes(role?.trim().toLowerCase() || "");
}
