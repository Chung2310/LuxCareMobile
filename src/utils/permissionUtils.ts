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
  if (code === "*") return "Toàn quyền hệ thống";
  const mapped = PERMISSION_TRANSLATIONS[code];
  if (mapped?.label) {
    return mapped.label;
  }
  if (fallbackName && fallbackName !== code) {
    return fallbackName;
  }
  return code.replace(/^([a-z]+):([a-z]+)$/i, (_, mod, act) => {
    const actMap: Record<string, string> = { read: "Xem", manage: "Quản lý", post: "Đăng bài" };
    return `${actMap[act] || act} ${mod.toUpperCase()}`;
  });
}

/**
 * Trả về mô tả tiếng Việt dễ hiểu cho mã quyền.
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
 * Trả về tên vai trò tiếng Việt thân thiện người dùng.
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

/**
 * Kiểm tra xem người dùng có quyền cụ thể hay không (Dựa trên Vai trò và Danh sách Quyền).
 */
export function hasPermission(
  user: { role?: string; permissions?: string[] } | null | undefined,
  requiredPermission: string
): boolean {
  if (!user) return false;
  const role = (user.role || "").toLowerCase();
  
  // Quản trị viên cấp cao, quản trị doanh nghiệp, chủ chi nhánh có toàn quyền
  if (["superadmin", "admin", "branch_owner"].includes(role)) return true;
  
  // Kiểm tra quyền wildcard (*)
  if (user.permissions?.includes("*")) return true;
  
  // Kiểm tra quyền trực tiếp
  if (user.permissions?.includes(requiredPermission)) return true;
  
  // Quản lý (Manager) mặc định có quyền quản lý & duyệt trong các module chính
  if (role === "manager") {
    if (requiredPermission.includes(":manage") || requiredPermission.includes(":approve") || requiredPermission.includes(":read")) {
      return true;
    }
  }
  
  return false;
}

/**
 * Kiểm tra xem người dùng có ít nhất một trong các quyền trong danh sách hay không.
 */
export function hasAnyPermission(
  user: { role?: string; permissions?: string[] } | null | undefined,
  permissions: string[]
): boolean {
  return permissions.some((p) => hasPermission(user, p));
}
