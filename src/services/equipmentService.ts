import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { readEquipmentRecord } from "./equipmentRecord";
import type {
  EquipmentRecord,
  EquipmentSummary,
  EquipmentComplianceSummary,
  EquipmentListParams,
  EquipmentRequestRecord,
} from "../types/equipment";

export function createEquipmentService({ fetch, getAccessToken }: ServiceTransport) {
  function writePayload(payload: Partial<EquipmentRecord>) {
    // The server resolves the canonical name from departmentId within the user's company.
    const { departmentName, department, ...input } = payload;
    return JSON.stringify(input);
  }

  async function request<T>(path: string, options: RequestInit = {}, unwrapData = true): Promise<T> {
    const token = getAccessToken();
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });

    const body = await res.json().catch(() => {
      if (res.ok && res.status !== 204) throw new Error("Máy chủ trả về dữ liệu thiết bị không hợp lệ.");
      return {};
    });
    if (!res.ok) {
      let detailMsg = "";
      if (body.errors) {
        if (typeof body.errors === "object" && body.errors !== null) {
          const parts: string[] = [];
          for (const [, v] of Object.entries(body.errors)) {
            if (Array.isArray(v)) {
              parts.push(v.join("\n"));
            } else if (typeof v === "string") {
              parts.push(v);
            } else {
              parts.push(JSON.stringify(v));
            }
          }
          detailMsg = parts.join("\n");
        } else if (typeof body.errors === "string") {
          detailMsg = body.errors;
        }
      } else if (body.details) {
        detailMsg = typeof body.details === "string" ? body.details : JSON.stringify(body.details);
      }
      const mainMsg = body.message || body.error || `Lỗi yêu cầu thiết bị (${res.status})`;
      const fullMsg = detailMsg ? `${mainMsg}:\n${detailMsg}` : mainMsg;
      throw new Error(fullMsg);
    }
    return (unwrapData && body.data !== undefined ? body.data : body) as T;
  }

  const list = async (params?: EquipmentListParams): Promise<{ items: EquipmentRecord[]; total: number }> => {
    const q = new URLSearchParams();
    if (params?.search) q.set("search", params.search);
    if (params?.status && params.status !== "all") q.set("status", params.status);
    if (params?.category) q.set("category", params.category);
    if (params?.departmentId) q.set("departmentId", params.departmentId);
    if (params?.page) q.set("page", String(params.page));
    q.set("limit", String(params?.limit ?? 100));

    const qs = q.toString();
    const result = await request<any>(`/api/v1/equipment${qs ? `?${qs}` : ""}`, {}, false);
    const page = result?.data && !Array.isArray(result.data) ? result.data : result;

    if (Array.isArray(result)) return { items: result.map(readEquipmentRecord), total: result.length };
    if (page && Array.isArray(page.items)) return { items: page.items.map(readEquipmentRecord), total: page.total ?? page.items.length };
    if (result && Array.isArray(result.data)) return { items: result.data.map(readEquipmentRecord), total: result.total ?? result.data.length };
    throw new Error("Dữ liệu danh sách thiết bị không hợp lệ.");
  };

  return {
    list,

    listRequests: async (page = 1): Promise<{ items: EquipmentRequestRecord[]; total: number }> => {
      const body = await request<{ data: EquipmentRequestRecord[]; total: number }>(`/api/v1/equipment/borrow-requests?page=${page}&limit=100`, {}, false);
      if (!Array.isArray(body.data) || typeof body.total !== "number") throw new Error("Dữ liệu phiếu thiết bị không hợp lệ.");
      return { items: body.data, total: body.total };
    },

    createBorrowRequest: (id: string, input: { reason: string; expectedReturnAt?: string }): Promise<EquipmentRequestRecord> =>
      request(`/api/v1/equipment/${encodeURIComponent(id)}/borrow-requests`, { method: "POST", body: JSON.stringify(input) }),

    createReturnRequest: (id: string, input: { note?: string }): Promise<EquipmentRequestRecord> =>
      request(`/api/v1/equipment/${encodeURIComponent(id)}/return-requests`, { method: "POST", body: JSON.stringify(input) }),

    decideRequest: (id: string, decision: "approved" | "rejected", rejectionReason?: string): Promise<EquipmentRequestRecord> =>
      request(`/api/v1/equipment/borrow-requests/${encodeURIComponent(id)}/decision`, {
        method: "PATCH", body: JSON.stringify({ decision, ...(decision === "rejected" ? { rejectionReason } : {}) }),
      }),

    cancelRequest: (id: string): Promise<EquipmentRequestRecord> =>
      request(`/api/v1/equipment/borrow-requests/${encodeURIComponent(id)}`, { method: "DELETE" }),

    getSummary: async (): Promise<EquipmentSummary> => {
      // The backend exposes counts on the list endpoint, not /equipment/summary.
      const statuses = ["available", "requested", "in-use", "maintenance", "retired"];
      const pages = await Promise.all(statuses.map(status => list({ status, limit: 1 })));
      const counts = pages.map(page => page.total);
      return {
        total: counts.reduce((sum, count) => sum + count, 0),
        byStatus: statuses.map((status, index) => ({ status, count: counts[index] })),
        ready: counts[0], booked: counts[1], using: counts[2], maintenance: counts[3], disposed: counts[4],
      };
    },

    getCompliance: async (): Promise<EquipmentComplianceSummary> => {
      const summary = await request<{ overdue: number; dueSoon: number; valid: number }>("/api/v1/equipment/compliance-summary");
      return { overdue: summary.overdue, upcoming: summary.dueSoon, valid: summary.valid };
    },

    getById: async (id: string): Promise<EquipmentRecord> => {
      return readEquipmentRecord(await request<EquipmentRecord>(`/api/v1/equipment/${encodeURIComponent(id)}`));
    },

    create: async (payload: Partial<EquipmentRecord>): Promise<EquipmentRecord> => {
      return readEquipmentRecord(await request<EquipmentRecord>("/api/v1/equipment", {
        method: "POST",
        body: writePayload(payload),
      }));
    },

    update: async (id: string, payload: Partial<EquipmentRecord>): Promise<EquipmentRecord> => {
      return readEquipmentRecord(await request<EquipmentRecord>(`/api/v1/equipment/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: writePayload(payload),
      }));
    },

    delete: async (id: string): Promise<void> => {
      await request<unknown>(`/api/v1/equipment/${encodeURIComponent(id)}`, { method: "DELETE" });
    },
  };
}

export const equipmentService = createEquipmentService(browserTransport);

