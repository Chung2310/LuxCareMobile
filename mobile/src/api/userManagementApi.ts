import { isAdministrativeRole } from "../../../src/utils/userRolePolicy";
import { api } from "./services";
import type { UserProfile } from "../../../src/types/common";

export type UserRole =
  | "admin"
  | "branch_owner"
  | "manager"
  | "user"
  | "superadmin"
  | (string & {});

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
  monthlySalary?: number;
  parentId?: string;
  jobDescriptionLink?: string;
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
  monthlySalary?: number;
  parentId?: string;
  jobDescriptionLink?: string;
}

export interface UserListParams {
  companyCode?: string;
  branchId?: string;
  role?: string;
  search?: string;
}

export const normalizePhone = (phone?: string | null): string => {
  if (!phone) return "";
  const str = String(phone).trim();
  const lower = str.toLowerCase();
  if (
    !str ||
    lower === "chưa cập nhật" ||
    lower === "chua cap nhat" ||
    lower === "chưa có" ||
    lower === "chua co" ||
    lower === "không có" ||
    lower === "khong co" ||
    lower === "null" ||
    lower === "undefined" ||
    lower === "n/a" ||
    lower === "none" ||
    lower === "—" ||
    lower === "-"
  ) {
    return "";
  }
  return str;
};

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
      phone: normalizePhone(item.phone),
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

    const uid = json.uid || json.data?.uid || json.data?._id || json._id;
    if (uid && (input.monthlySalary !== undefined || input.parentId || input.jobDescriptionLink || input.birthDate)) {
      try {
        await userManagementApi.updateUser(uid, {
          birthDate: input.birthDate,
          monthlySalary: input.monthlySalary,
          parentId: input.parentId,
          jobDescriptionLink: input.jobDescriptionLink,
        });
      } catch {
        // bỏ qua nếu register-user đã lưu hoặc cập nhật riêng
      }
    }

    return {
      success: true,
      uid,
      message: json.message || "Đăng ký thành viên thành công!",
    };
  },

  // 3. Cập nhật thông tin thành viên
  async updateUser(id: string, input: UpdateUserInput): Promise<{ success: boolean; message?: string }> {
    if (isAdministrativeRole(input.role)) {
      throw new Error("Không được phép nâng quyền lên Quản trị viên.");
    }
    const payload = { ...input };
    if (payload.birthDate) {
      const val = String(payload.birthDate).trim();
      payload.birthDate = val.includes("T") ? val.split("T")[0] : val.slice(0, 10);
    }
    if (payload.phone !== undefined) {
      const p = normalizePhone(payload.phone).replace(/[\s.\-()]/g, "");
      payload.phone = p || undefined;
    }
    const res = await api.transport.fetch(`/api/v1/auth/users/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
