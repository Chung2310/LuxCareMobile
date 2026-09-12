import type { ServiceTransport } from "./serviceTransport";

export interface RolePermission {
  _id?: string;
  companyCode: string;
  role: string;
  permissions: string[];
  level: number;
  displayName?: string;
}
export interface Permission {
  _id?: string;
  code: string;
  name: string;
  module: string;
  group?: string;
  description?: string;
}
export type RolePermissionInput = Omit<RolePermission, "_id">;

export function createRolePermissionService(transport: ServiceTransport) {
  async function request(path: string, init: RequestInit = {}) {
    const token = transport.getAccessToken();
    const response = await transport.fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}), ...init.headers },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.message || "Không thể cập nhật hoặc tải phân quyền.");
    return body;
  }
  async function listAll<T>(path: string, companyCode?: string): Promise<T[]> {
    const items: T[] = [];
    for (let page = 1; ; page++) {
      const query = new URLSearchParams({ page: String(page), limit: "100" });
      if (companyCode) query.set("companyCode", companyCode);
      const body = await request(path + "?" + query);
      if (!Array.isArray(body.data)) throw new Error("Dữ liệu phân quyền không hợp lệ.");
      items.push(...body.data);
      if (typeof body.total === "number" ? items.length >= body.total : body.data.length < 100) return items;
      if (!body.data.length) throw new Error("Danh sách phân quyền chưa tải đầy đủ. Vui lòng thử lại.");
    }
  }
  return {
    list: (companyCode: string) => listAll<RolePermission>("/api/v1/role-permissions", companyCode),
    permissions: () => listAll<Permission>("/api/v1/permissions"),
    save: async (input: RolePermissionInput): Promise<RolePermission> => {
      const body = await request("/api/v1/role-permissions", { method: "POST", body: JSON.stringify(input) });
      if (!body.data) throw new Error("Máy chủ chưa trả về cấu hình vai trò.");
      return body.data;
    },
    remove: async (role: string, companyCode: string): Promise<void> => {
      await request("/api/v1/role-permissions/" + encodeURIComponent(role) + "?" +
        new URLSearchParams({ companyCode }), { method: "DELETE" });
    },
  };
}
