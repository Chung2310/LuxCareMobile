import { browserTransport, type ServiceTransport } from "./serviceTransport";
import type {
  EquipmentRecord,
  EquipmentSummary,
  EquipmentComplianceSummary,
  EquipmentListParams,
  EquipmentListResponse,
} from "../types/equipment";

export function createEquipmentService({ fetch, getAccessToken }: ServiceTransport) {
  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = getAccessToken();
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(body.message || `Lỗi tải dữ liệu thiết bị (${res.status})`);
    }
    return (body.data !== undefined ? body.data : body) as T;
  }

  return {
    list: async (
      params?: EquipmentListParams,
    ): Promise<{ items: EquipmentRecord[]; total: number }> => {
      const q = new URLSearchParams();
      if (params?.search) q.set("search", params.search);
      if (params?.status && params.status !== "all") q.set("status", params.status);
      if (params?.category) q.set("category", params.category);
      if (params?.department) q.set("department", params.department);
      if (params?.page) q.set("page", String(params.page));
      q.set("limit", String(params?.limit ?? 100));

      const qs = q.toString();
      const result = await request<any>(
        `/api/v1/equipment${qs ? `?${qs}` : ""}`,
      );

      if (Array.isArray(result)) {
        return { items: result, total: result.length };
      }
      if (result && Array.isArray(result.items)) {
        return { items: result.items, total: result.total ?? result.items.length };
      }
      if (result && Array.isArray(result.data)) {
        return { items: result.data, total: result.total ?? result.data.length };
      }
      return { items: [], total: 0 };
    },

    getSummary: async (): Promise<EquipmentSummary> => {
      return request<EquipmentSummary>("/api/v1/equipment/summary");
    },

    getCompliance: async (): Promise<EquipmentComplianceSummary> => {
      return request<EquipmentComplianceSummary>("/api/v1/equipment/compliance");
    },

    getById: async (id: string): Promise<EquipmentRecord> => {
      return request<EquipmentRecord>(`/api/v1/equipment/${encodeURIComponent(id)}`);
    },

    create: async (payload: Partial<EquipmentRecord>): Promise<EquipmentRecord> => {
      return request<EquipmentRecord>("/api/v1/equipment", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    update: async (id: string, payload: Partial<EquipmentRecord>): Promise<EquipmentRecord> => {
      return request<EquipmentRecord>(`/api/v1/equipment/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },

    delete: async (id: string): Promise<void> => {
      await request<unknown>(`/api/v1/equipment/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    },
  };
}

export const equipmentService = createEquipmentService(browserTransport);
