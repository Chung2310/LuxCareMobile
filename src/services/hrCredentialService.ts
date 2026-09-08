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
export function createHrCredentialService({ fetch, getAccessToken }: ServiceTransport) {
  return {
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
