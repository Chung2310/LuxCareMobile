import type { Credential } from "../types/hrCredential";
import type { Employee } from "../types/hrContract";
import type { HRCredentialStatus, HRCredentialType } from "../../shared/hr-credential";
import type { ServiceTransport } from "./serviceTransport";
export interface CredentialFilters {
  companyCode: string;
  branchId?: string;
  employeeId?: string;
  search?: string;
  status?: HRCredentialStatus | "";
  type?: HRCredentialType | "";
  page: number;
  limit: number;
}
export interface CredentialList {
  credentials: Credential[];
  employees: (Employee & { branchId?: string })[];
  total: number;
  page: number;
  limit: number;
  summary: { total: number; active: number; expiring: number; expired: number };
}
export type CredentialInput = Pick<
  Credential,
  | "employeeId"
  | "name"
  | "type"
  | "credentialNumber"
  | "issuingOrganization"
  | "issueDate"
  | "expiryDate"
  | "professionalScope"
  | "note"
  | "reminderDays"
>;
export function createHrCredentialService({ fetch, getAccessToken }: ServiceTransport) {
  async function save(companyCode: string, value: Partial<CredentialInput>, id?: string): Promise<Credential> {
    const response = await fetch(
      `/api/v1/hr-credentials${id ? `/${encodeURIComponent(id)}` : ""}?companyCode=${encodeURIComponent(companyCode)}`,
      {
        method: id ? "PATCH" : "POST",
        headers: { Authorization: `Bearer ${getAccessToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify(value),
      },
    );
    const body = await response.json();
    if (!response.ok)
      throw Object.assign(new Error(body.message || "Không lưu được chứng chỉ."), { status: response.status });
    return body.data;
  }
  return {
    async remove(companyCode: string, id: string): Promise<void> {
      const response = await fetch(
        `/api/v1/hr-credentials/${encodeURIComponent(id)}?companyCode=${encodeURIComponent(companyCode)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${getAccessToken()}` } },
      );
      const body = await response.json();
      if (!response.ok)
        throw Object.assign(new Error(body.message || "Không xóa được chứng chỉ."), { status: response.status });
      if (body.status !== "success") throw new Error("Chưa xác nhận được kết quả xóa.");
    },
    create: (companyCode: string, value: CredentialInput) => save(companyCode, value),
    update: (companyCode: string, id: string, value: Partial<CredentialInput>) => save(companyCode, value, id),
    async list(filters: CredentialFilters): Promise<CredentialList> {
      const query = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== "") query.set(key, String(value));
      });
      const response = await fetch(`/api/v1/hr-credentials?${query}`, {
        headers: { Authorization: `Bearer ${getAccessToken()}` },
      });
      const body = await response.json();
      if (!response.ok)
        throw Object.assign(new Error(body.message || "Không tải được chứng chỉ."), { status: response.status });
      return body.data;
    },
  };
}
