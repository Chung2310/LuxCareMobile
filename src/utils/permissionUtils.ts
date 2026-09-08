import { PERMISSION_CATALOG } from "../../shared/permissions";

export interface PermissionDefinition {
  code: string;
  label: string;
  description?: string;
  group?: string;
}

export const PERMISSION_TRANSLATIONS: Record<string, { label: string; group?: string; description?: string }> =
  Object.fromEntries(PERMISSION_CATALOG.map((entry) => [entry.code, {
    label: entry.label,
    group: entry.group,
    description: entry.description,
  }]));

export function getPermissionLabel(code: string, fallbackName?: string): string {
  if (!code) return "";
  if (code === "*") return "ToÃ n quyá»n há»‡ thá»‘ng";
  const mapped = PERMISSION_TRANSLATIONS[code];
  if (mapped?.label) {
    return mapped.label;
  }
  if (fallbackName && fallbackName !== code) {
    return fallbackName;
  }
  return code.replace(/^([a-z]+):([a-z]+)$/i, (_, mod, act) => {
    const actMap: Record<string, string> = { read: "Xem", manage: "Quáº£n lÃ½", post: "ÄÄƒng bÃ i" };
    return `${actMap[act] || act} ${mod.toUpperCase()}`;
  });
}

/**
 * Tráº£ vá» mÃ´ táº£ tiáº¿ng Viá»‡t dá»… hiá»ƒu cho mÃ£ quyá»n.
 */
export function getPermissionDescription(code: string, fallbackDesc?: string): string {
  if (!code) return "";
  const mapped = PERMISSION_TRANSLATIONS[code];
  if (mapped?.description) {
    return mapped.description;
  }
  return fallbackDesc || "";
}

/**
 * Tráº£ vá» tÃªn vai trÃ² tiáº¿ng Viá»‡t thÃ¢n thiá»‡n ngÆ°á»i dÃ¹ng.
 */
export function getRoleDisplayName(role: string, customDisplayName?: string): string {
  const roleMap: Record<string, string> = {
    superadmin: "Quản trị viên cấp cao",
    admin: "Quản trị viên doanh nghiệp",
    branch_owner: "Chủ chi nhánh",
    manager: "Quản lý",
    blog_editor: "Ban biên tập Blog",
    blog_author: "Tác giả Blog",
    user: "Nhân viên",
    staff: "Nhân viên",
    teacher: "Giáo viên",
    accountant: "Kế toán",
  };
  const key = role?.trim().toLowerCase();
  return roleMap[key] || (customDisplayName?.trim() && customDisplayName !== role ? customDisplayName : key ? "Vai trò tùy chỉnh" : "Nhân viên");
}
