import { api } from "./services";

export type CustomerLeadStatus =
  | "new"
  | "contacted"
  | "in_consultation"
  | "converted"
  | "cancelled";

export interface ContactHistoryItem {
  date: string | Date;
  note: string;
  status: string;
  updatedBy?: {
    _id?: string;
    displayName?: string;
    email?: string;
  } | null;
}

export interface CustomerLeadItem {
  _id: string;
  companyCode: string;
  branchId?: string | null;
  branchCode?: string;
  branchName?: string;
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  serviceInterest?: string;
  preferredContactTime?: string;
  notes?: string;
  source: string;
  qrCampaign?: string;
  status: CustomerLeadStatus;
  assignedTo?: {
    _id?: string;
    displayName?: string;
    email?: string;
  } | null;
  contactHistory?: ContactHistoryItem[];
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CustomerLeadStats {
  total: number;
  todayNew: number;
  new: number;
  contacted: number;
  in_consultation: number;
  converted: number;
  cancelled: number;
}

export interface CustomerLeadListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  source?: string;
  branchId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface CreateCustomerLeadInput {
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  serviceInterest?: string;
  preferredContactTime?: string;
  notes?: string;
  branchId?: string;
  source?: string;
  qrCampaign?: string;
  status?: CustomerLeadStatus;
  assignedTo?: string;
}

export interface UpdateCustomerLeadInput {
  fullName?: string;
  phone?: string;
  email?: string;
  address?: string;
  serviceInterest?: string;
  preferredContactTime?: string;
  notes?: string;
  status?: CustomerLeadStatus;
  branchId?: string;
  assignedTo?: string;
  addNote?: string;
}

export const customerLeadApi = {
  // 1. Danh sách khách hàng
  async getLeads(
    params?: CustomerLeadListParams,
  ): Promise<{ leads: CustomerLeadItem[]; total: number; totalPages: number }> {
    const query = new URLSearchParams();
    query.set("page", String(params?.page || 1));
    query.set("limit", String(params?.limit || 50));
    if (params?.search && params.search.trim()) query.set("search", params.search.trim());
    if (params?.status && params.status !== "all") query.set("status", params.status);
    if (params?.source && params.source !== "all") query.set("source", params.source);
    if (params?.branchId && params.branchId !== "all") query.set("branchId", params.branchId);
    if (params?.fromDate) query.set("fromDate", params.fromDate);
    if (params?.toDate) query.set("toDate", params.toDate);

    const endpoint = `/api/v1/customer-leads?${query.toString()}`;
    const res = await api.transport.fetch(endpoint);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải danh sách khách hàng.");

    const rawList = Array.isArray(json.leads) ? json.leads : [];
    return {
      leads: rawList,
      total: json.total || rawList.length,
      totalPages: json.pagination?.totalPages || 1,
    };
  },

  // 2. Thống kê KPI khách hàng
  async getStats(branchId?: string): Promise<CustomerLeadStats> {
    const query = branchId && branchId !== "all" ? `?branchId=${branchId}` : "";
    const res = await api.transport.fetch(`/api/v1/customer-leads/stats${query}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải thống kê khách hàng.");

    const d = json.data || {};
    return {
      total: Number(d.total) || 0,
      todayNew: Number(d.todayNew) || 0,
      new: Number(d.new) || 0,
      contacted: Number(d.contacted) || 0,
      in_consultation: Number(d.in_consultation) || 0,
      converted: Number(d.converted) || 0,
      cancelled: Number(d.cancelled) || 0,
    };
  },

  // 3. Chi tiết một khách hàng
  async getLead(id: string): Promise<CustomerLeadItem> {
    const res = await api.transport.fetch(`/api/v1/customer-leads/${id}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không tìm thấy khách hàng.");
    return json.data;
  },

  // 4. Tạo mới khách hàng
  async createLead(data: CreateCustomerLeadInput): Promise<CustomerLeadItem> {
    const res = await api.transport.fetch("/api/v1/customer-leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tạo thông tin khách hàng.");
    return json.data;
  },

  // 5. Cập nhật thông tin & thêm ghi chú chăm sóc
  async updateLead(id: string, data: UpdateCustomerLeadInput): Promise<CustomerLeadItem> {
    const res = await api.transport.fetch(`/api/v1/customer-leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể cập nhật thông tin khách hàng.");
    return json.data;
  },

  // 6. Xóa khách hàng
  async deleteLead(id: string): Promise<{ success: boolean; message?: string }> {
    const res = await api.transport.fetch(`/api/v1/customer-leads/${id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể xóa khách hàng.");
    return { success: true, message: json.message };
  },

  // 7. Tạo đường dẫn mã QR biểu mẫu tiếp nhận khách hàng công khai
  getPublicQrUrl(companyCode: string, branchCode?: string, campaign?: string): string {
    const origin = api.getOrigin();
    const cleanOrigin = origin.replace(/\/+$/, "");
    const q = new URLSearchParams({ c: (companyCode || "LUXCARE").toUpperCase() });
    if (branchCode) q.set("b", branchCode);
    if (campaign && campaign.trim()) q.set("camp", campaign.trim());
    q.set("src", "qr");
    return `${cleanOrigin}/tiep-nhan-khach-hang?${q.toString()}`;
  },
};
