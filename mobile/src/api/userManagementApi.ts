import { api } from "./services";
import type { UserProfile } from "../../../src/types/common";

export type UserRole =
  | "admin"
  | "branch_owner"
  | "manager"
  | "user"
  | "superadmin";

export interface UserStats {
  total: number;
  admin: number;
  branch_owner: number;
  manager: number;
  user: number;
}

export interface CreateUserInput {
  displayName: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  branchId?: string;
  department?: string;
  division?: string;
  birthDate?: string;
  companyCode?: string;
  companyName?: string;
}

export interface UpdateUserInput {
  displayName?: string;
  role?: UserRole;
  phone?: string;
  branchId?: string;
  department?: string;
  division?: string;
  jobTitle?: string;
  birthDate?: string;
  isLeader?: boolean;
}

export interface UserListParams {
  companyCode?: string;
  branchId?: string;
  role?: string;
  search?: string;
}

export const userManagementApi = {
  // 1. Lấy danh sách thành viên
  async getUsers(params?: UserListParams): Promise<UserProfile[]> {
    const query = new URLSearchParams();
    if (params?.companyCode && params.companyCode !== "all") {
      query.set("companyCode", params.companyCode);
    }
    if (params?.branchId && params.branchId !== "all") {
      query.set("branchId", params.branchId);
    }

    const endpoint = `/api/v1/auth/users${query.toString() ? `?${query.toString()}` : ""}`;
    const res = await api.transport.fetch(endpoint);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải danh sách người dùng.");

    const rawList: any[] = Array.isArray(json.data) ? json.data : [];
    const normalized: UserProfile[] = rawList.map((item) => ({
      ...item,
      uid: item._id || item.uid,
    }));

    return normalized;
  },

  // 2. Tạo mới tài khoản thành viên
  async createUser(input: CreateUserInput): Promise<{ success: boolean; uid?: string; message?: string }> {
    if (input.role === "admin" || (input.role as string) === "superadmin") {
      throw new Error("Không được phép tạo tài khoản mới với vai trò Quản trị viên (Admin).");
    }
    const res = await api.transport.fetch("/api/v1/auth/register-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tạo tài khoản người dùng.");

    return {
      success: true,
      uid: json.uid,
      message: json.message || "Đăng ký thành viên thành công!",
    };
  },

  // 3. Cập nhật thông tin thành viên
  async updateUser(id: string, input: UpdateUserInput): Promise<{ success: boolean; message?: string }> {
    const res = await api.transport.fetch(`/api/v1/auth/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể cập nhật thông tin người dùng.");

    return { success: true, message: json.message };
  },

  // 4. Cập nhật nhanh vai trò thành viên
  async updateRole(id: string, newRole: UserRole): Promise<{ success: boolean; message?: string }> {
    return this.updateUser(id, { role: newRole });
  },

  // 5. Xóa tài khoản thành viên
  async deleteUser(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await api.transport.fetch(`/api/v1/auth/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể xóa tài khoản người dùng.");

    return { success: true, message: json.message };
  },

  // 6. Tính toán thống kê theo vai trò
  calculateStats(users: UserProfile[]): UserStats {
    const stats: UserStats = {
      total: users.length,
      admin: 0,
      branch_owner: 0,
      manager: 0,
      user: 0,
    };

    for (const u of users) {
      if (u.role === "admin" || u.role === "superadmin") {
        stats.admin++;
      } else if (u.role === "branch_owner") {
        stats.branch_owner++;
      } else if (u.role === "manager") {
        stats.manager++;
      } else {
        stats.user++;
      }
    }

    return stats;
  },
};
