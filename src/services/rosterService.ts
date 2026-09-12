import { isAdministrativeRole } from "../utils/userRolePolicy";
import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";
import type { UserProfile } from "../types/common";
export type EmployeeProfileInput = Partial<
  Pick<
    UserProfile,
    | "displayName"
    | "email"
    | "phone"
    | "birthDate"
    | "jobTitle"
    | "qualification"
    | "division"
    | "department"
    | "departmentId"
    | "role"
    | "branchId"
    | "branchName"
    | "isLeader"
    | "monthlySalary"
    | "jobDescriptionLink"
    | "parentId"
    | "level"
    | "status"
  >
>;
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

export function createRosterService({ fetch, getAccessToken }: ServiceTransport) {
  async function request(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    if (init.body) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...init, headers });
    if (!response.ok) throw await parseApiErrorResponse(response);
    const data = await response.json().catch(() => ({}));
    return data;
  }
  const normalize = (data: (UserProfile & { _id?: string })[]): UserProfile[] =>
    (data || []).map((user) => ({
      ...user,
      uid: user._id || user.uid,
      phone: normalizePhone(user.phone),
    }));
  return {
    list: async (companyCode?: string, branchId?: string): Promise<UserProfile[]> => {
      const query = new URLSearchParams();
      if (companyCode && companyCode !== "all") query.set("companyCode", companyCode);
      if (branchId) query.set("branchId", branchId);
      return normalize((await request(`/api/v1/auth/users${query.size ? `?${query}` : ""}`)).data);
    },
    colleagues: async (): Promise<UserProfile[]> => normalize((await request("/api/v1/auth/users/colleagues")).data),
    update: async (id: string, input: EmployeeProfileInput): Promise<void> => {
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
      await request(`/api/v1/auth/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(payload) });
    },
  };
}
export const rosterService = createRosterService(browserTransport);
