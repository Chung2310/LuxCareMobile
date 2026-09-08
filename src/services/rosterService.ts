import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";
import type { UserProfile } from "../types/common";
export type EmployeeProfileInput = Partial<
  Pick<UserProfile, "displayName" | "phone" | "birthDate" | "jobTitle" | "qualification" | "division">
>;
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
    (data || []).map((user) => ({ ...user, uid: user._id || user.uid }));
  return {
    list: async (companyCode?: string, branchId?: string): Promise<UserProfile[]> => {
      const query = new URLSearchParams();
      if (companyCode && companyCode !== "all") query.set("companyCode", companyCode);
      if (branchId) query.set("branchId", branchId);
      return normalize((await request(`/api/v1/auth/users${query.size ? `?${query}` : ""}`)).data);
    },
    colleagues: async (): Promise<UserProfile[]> => normalize((await request("/api/v1/auth/users/colleagues")).data),
    update: async (id: string, input: EmployeeProfileInput): Promise<void> => {
      await request(`/api/v1/auth/users/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) });
    },
  };
}
export const rosterService = createRosterService(browserTransport);
