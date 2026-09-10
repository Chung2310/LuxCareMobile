import { api } from "./services";
import type {
  InventorySupply,
  InventoryStats,
  InventoryTransaction,
  InventorySupplier,
  InventoryWarehouse,
  InventoryCategory,
} from "../components/inventory/types";

export interface SupplyListParams {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  status?: string;
  expiryStatus?: string;
  supplier?: string;
  warehouse?: string;
}

export interface TransactionListParams {
  page?: number;
  limit?: number;
  type?: "in" | "out";
  status?: string;
  search?: string;
}

export interface BatchStockLineItem {
  supplyId: string;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
  unitPrice?: number;
  notes?: string;
}

export interface BatchStockPayload {
  type: "in" | "out";
  batchCode?: string;
  supplier?: string;
  warehouseLocation?: string;
  recipientDepartment?: string;
  reason: string;
  items: BatchStockLineItem[];
}

/**
 * Helper sinh mã thao tác (Idempotency-Key) cho các giao dịch kho / vật tư.
 * Tuân thủ quy cách regex của server: /^[a-zA-Z0-9:_-]{8,128}$/
 */
export function generateIdempotencyKey(prefix = "op"): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      const uuid = crypto.randomUUID();
      return `${prefix}-${uuid}`.slice(0, 128);
    } catch {
      // Fallback nếu môi trường native không hỗ trợ crypto.randomUUID
    }
  }
  const timestamp = Date.now().toString(36);
  const rand1 = Math.random().toString(36).substring(2, 10);
  const rand2 = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${timestamp}-${rand1}-${rand2}`.slice(0, 128);
}

export const supplyApi = {
  // 1. Danh sách vật tư & dược phẩm
  async getSupplies(params?: SupplyListParams): Promise<{ data: InventorySupply[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    query.set("limit", String(params?.limit || 200));
    if (params?.search) query.set("search", params.search);
    if (params?.category && params.category !== "all") query.set("category", params.category);
    if (params?.status) query.set("status", params.status);
    if (params?.expiryStatus) query.set("expiryStatus", params.expiryStatus);
    if (params?.supplier) query.set("supplier", params.supplier);
    if (params?.warehouse) query.set("warehouse", params.warehouse);

    const queryString = query.toString();
    const endpoint = `/api/v1/supplies${queryString ? `?${queryString}` : ""}`;
    const res = await api.transport.fetch(endpoint);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải danh sách vật tư.");

    const items = (json.data || []).map((raw: any) => ({
      id: raw._id || raw.id,
      code: raw.code,
      name: raw.name,
      category: raw.category || "Chưa phân loại",
      unit: raw.unit || "Đơn vị",
      quantity: Number(raw.quantity) || 0,
      minQuantity: Number(raw.minQuantity) || 0,
      unitPrice: Number(raw.unitPrice) || 0,
      batchNumber: raw.batchNumber || "N/A",
      expiryDate: raw.expiryDate ? new Date(raw.expiryDate).toISOString().slice(0, 10) : "",
      manufactureDate: raw.manufactureDate ? new Date(raw.manufactureDate).toISOString().slice(0, 10) : undefined,
      requiresExpiry: raw.requiresExpiry !== false,
      warehouseLocation: raw.warehouseLocation || raw.warehouseName || "Kho chung",
      warehouseName: raw.warehouseName || raw.warehouse?.name || "Kho chính",
      warehouseId: raw.warehouseId || undefined,
      supplierName: raw.supplier || raw.supplierName || "Chưa xác định",
      supplierId: raw.supplierId || undefined,
      status: raw.status || "in-stock",
      inspectionCertificateNumber: raw.inspectionCertificateNumber,
      inspectionDate: raw.inspectionDate ? new Date(raw.inspectionDate).toISOString().slice(0, 10) : undefined,
      nextInspectionDate: raw.nextInspectionDate ? new Date(raw.nextInspectionDate).toISOString().slice(0, 10) : undefined,
      imageUrl: raw.imageUrl || "",
      images: raw.images || [],
      documents: raw.documents || [],
      notes: raw.notes,
    }));

    return { data: items, total: json.total || items.length };
  },

  // 2. Thống kê KPI kho
  async getStats(): Promise<InventoryStats> {
    const res = await api.transport.fetch("/api/v1/supplies/stats");
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải thống kê kho.");
    const data = json.data || {};

    return {
      totalItems: Number(data.totalItems) || 0,
      totalQuantity: Number(data.totalQuantity) || 0,
      lowStockCount: Number(data.lowStockCount) || 0,
      outOfStockCount: Number(data.outOfStockCount) || 0,
      expiredCount: Number(data.expiredCount) || 0,
      expiringSoonCount: Number(data.expiringSoonCount) || 0,
      totalValue: Number(data.totalValue) || 0,
    };
  },

  // 3. Chi tiết 1 mặt hàng
  async getSupply(id: string): Promise<InventorySupply> {
    const res = await api.transport.fetch(`/api/v1/supplies/${id}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải thông tin vật tư.");
    const raw = json.data;

    return {
      id: raw._id || raw.id,
      code: raw.code,
      name: raw.name,
      category: raw.category || "Chưa phân loại",
      unit: raw.unit || "Đơn vị",
      quantity: Number(raw.quantity) || 0,
      minQuantity: Number(raw.minQuantity) || 0,
      unitPrice: Number(raw.unitPrice) || 0,
      batchNumber: raw.batchNumber || "N/A",
      expiryDate: raw.expiryDate ? new Date(raw.expiryDate).toISOString().slice(0, 10) : "",
      manufactureDate: raw.manufactureDate ? new Date(raw.manufactureDate).toISOString().slice(0, 10) : undefined,
      requiresExpiry: raw.requiresExpiry !== false,
      warehouseLocation: raw.warehouseLocation || "Kho chính",
      warehouseName: raw.warehouseName || "Kho chính",
      warehouseId: raw.warehouseId || undefined,
      supplierName: raw.supplier || "Chưa xác định",
      supplierId: raw.supplierId || undefined,
      status: raw.status || "in-stock",
      inspectionCertificateNumber: raw.inspectionCertificateNumber,
      inspectionDate: raw.inspectionDate ? new Date(raw.inspectionDate).toISOString().slice(0, 10) : undefined,
      nextInspectionDate: raw.nextInspectionDate ? new Date(raw.nextInspectionDate).toISOString().slice(0, 10) : undefined,
      imageUrl: raw.imageUrl || "",
      images: raw.images || [],
      documents: raw.documents || [],
      notes: raw.notes,
    };
  },

  // 4. Tạo mới vật tư
  async createSupply(data: Partial<InventorySupply>, operationKey?: string): Promise<any> {
    const payload: any = {
      name: data.name?.trim(),
      code: data.code?.trim().toUpperCase(),
      category: data.category?.trim(),
      unit: data.unit?.trim(),
      quantity: 0,
      minQuantity: typeof data.minQuantity === "number" ? data.minQuantity : 10,
    };
    if (data.requiresExpiry !== undefined) payload.requiresExpiry = data.requiresExpiry;
    if (data.unitPrice !== undefined && data.unitPrice !== null) payload.unitPrice = Number(data.unitPrice);
    if (data.warehouseLocation) payload.warehouseLocation = data.warehouseLocation;
    if (data.warehouseId && /^[0-9a-fA-F]{24}$/.test(data.warehouseId)) payload.warehouseId = data.warehouseId;
    const supplierVal = data.supplier || data.supplierName;
    if (supplierVal) payload.supplier = supplierVal;
    if (data.supplierId && /^[0-9a-fA-F]{24}$/.test(data.supplierId)) payload.supplierId = data.supplierId;
    if (data.batchNumber) payload.batchNumber = data.batchNumber;
    if (data.expiryDate) payload.expiryDate = data.expiryDate;
    if (data.manufactureDate) payload.manufactureDate = data.manufactureDate;
    if (data.inspectionDate) payload.inspectionDate = data.inspectionDate;
    if (data.nextInspectionDate) payload.nextInspectionDate = data.nextInspectionDate;
    if (data.inspectionCertificateNumber) payload.inspectionCertificateNumber = data.inspectionCertificateNumber;
    if (data.imageUrl) payload.imageUrl = data.imageUrl;
    if (data.images && data.images.length > 0) payload.images = data.images;
    if (data.documents && data.documents.length > 0) payload.documents = data.documents;
    if (data.notes) payload.notes = data.notes;

    const key = operationKey || generateIdempotencyKey("create-supply");
    const res = await api.transport.fetch("/api/v1/supplies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tạo vật tư mới.");
    return json.data;
  },

  // 5. Cập nhật thông tin vật tư (Sửa)
  async updateSupply(id: string, data: Partial<InventorySupply>): Promise<any> {
    const payload: any = {};
    if (data.name !== undefined) payload.name = data.name.trim();
    if (data.code !== undefined) payload.code = data.code.trim().toUpperCase();
    if (data.category !== undefined) payload.category = data.category.trim();
    if (data.unit !== undefined) payload.unit = data.unit.trim();
    if (data.minQuantity !== undefined) payload.minQuantity = Number(data.minQuantity);
    if (data.unitPrice !== undefined) payload.unitPrice = Number(data.unitPrice);
    if (data.warehouseLocation !== undefined) payload.warehouseLocation = data.warehouseLocation;
    if (data.warehouseId && /^[0-9a-fA-F]{24}$/.test(data.warehouseId)) payload.warehouseId = data.warehouseId;
    const supplierVal = data.supplier || data.supplierName;
    if (supplierVal !== undefined) payload.supplier = supplierVal;
    if (data.supplierId && /^[0-9a-fA-F]{24}$/.test(data.supplierId)) payload.supplierId = data.supplierId;
    if (data.requiresExpiry !== undefined) payload.requiresExpiry = data.requiresExpiry;
    if (data.batchNumber !== undefined) payload.batchNumber = data.batchNumber;
    if (data.expiryDate !== undefined) payload.expiryDate = data.expiryDate || null;
    if (data.manufactureDate !== undefined) payload.manufactureDate = data.manufactureDate || null;
    if (data.inspectionDate !== undefined) payload.inspectionDate = data.inspectionDate || null;
    if (data.nextInspectionDate !== undefined) payload.nextInspectionDate = data.nextInspectionDate || null;
    if (data.inspectionCertificateNumber !== undefined) payload.inspectionCertificateNumber = data.inspectionCertificateNumber;
    if (data.imageUrl !== undefined) payload.imageUrl = data.imageUrl;
    if (data.images !== undefined) payload.images = data.images;
    if (data.documents !== undefined) payload.documents = data.documents;
    if (data.notes !== undefined) payload.notes = data.notes;

    const res = await api.transport.fetch(`/api/v1/supplies/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể cập nhật vật tư.");
    return json.data;
  },

  // 6. Tải lên tệp ảnh hoặc tài liệu (dùng XMLHttpRequest để bypass Expo Winter Fetch)
  async uploadFiles(
    files: Array<{ uri: string; name: string; type?: string }>,
  ): Promise<Array<{ name: string; fileUrl: string; fileType: string; fileSize: number; uploadedAt: string }>> {
    if (!files || files.length === 0) return [];

    const token = api.transport.getAccessToken ? api.transport.getAccessToken() : null;
    const origin = api.getOrigin();
    const branchId = api.getBranchId();

    const uploadPromises = files.map((f) => {
      return new Promise<Array<{ name: string; fileUrl: string; fileType: string; fileSize: number; uploadedAt: string }>>((resolve, reject) => {
        const form = new FormData();
        form.append("files", {
          uri: f.uri,
          name: f.name || `file_${Date.now()}`,
          type: f.type || "application/octet-stream",
        } as any);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${origin}/api/v1/supplies/upload-files`);

        // Set headers
        xhr.setRequestHeader("x-luxcare-client", "native");
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        if (branchId) xhr.setRequestHeader("x-branch-id", branchId);

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const body = JSON.parse(xhr.responseText);
              resolve(body?.data || []);
            } catch {
              reject(new Error("Không thể xử lý phản hồi từ máy chủ."));
            }
          } else {
            let errMsg = `Tải lên tệp ${f.name} thất bại (${xhr.status}).`;
            try {
              const body = JSON.parse(xhr.responseText);
              if (body?.message) errMsg = body.message;
            } catch {}
            reject(new Error(errMsg));
          }
        };

        xhr.onerror = () => {
          reject(new Error(`Lỗi mạng khi tải lên tệp ${f.name}.`));
        };

        xhr.timeout = 120000;
        xhr.ontimeout = () => {
          reject(new Error(`Hết thời gian tải lên tệp ${f.name}.`));
        };

        xhr.send(form);
      });
    });

    const settled = await Promise.all(uploadPromises);
    return settled.flat();
  },

  // 6. Xóa / Ngừng sử dụng vật tư (Xóa)
  async deleteSupply(id: string): Promise<any> {
    const res = await api.transport.fetch(`/api/v1/supplies/${id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể xóa vật tư.");
    return json;
  },

  // 7. Nhập kho
  async stockIn(
    id: string,
    data: { quantity: number; batchNumber?: string; expiryDate?: string; reason?: string },
    operationKey?: string,
  ): Promise<any> {
    const key = operationKey || generateIdempotencyKey("stock-in");
    const res = await api.transport.fetch(`/api/v1/supplies/${id}/stock-in`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Nhập kho thất bại.");
    return json;
  },

  // 8. Xuất kho
  async stockOut(
    id: string,
    data: { quantity: number; recipientDepartment: string; reason?: string },
    operationKey?: string,
  ): Promise<any> {
    const key = operationKey || generateIdempotencyKey("stock-out");
    const res = await api.transport.fetch(`/api/v1/supplies/${id}/stock-out`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Xuất kho thất bại.");
    return json;
  },

  // 9. Lập phiếu Nhập / Xuất kho theo lô đa mặt hàng (Batch Stock Voucher)
  async batchStock(payload: BatchStockPayload, operationKey?: string): Promise<any> {
    const defaultKey =
      payload.batchCode && /^[a-zA-Z0-9:_-]{3,100}$/.test(payload.batchCode)
        ? `batch-${payload.batchCode}`
        : generateIdempotencyKey("batch");
    const key = operationKey || defaultKey;

    const res = await api.transport.fetch("/api/v1/supplies/transactions/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": key,
      },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Lập phiếu nhập/xuất kho thất bại.");
    return json;
  },

  // 6. Lịch sử giao dịch nhập / xuất kho
  async getTransactions(params?: TransactionListParams): Promise<{ data: InventoryTransaction[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    query.set("limit", String(params?.limit || 100));
    if (params?.type) query.set("type", params.type);
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);

    const queryString = query.toString();
    const endpoint = `/api/v1/supplies/transactions/all${queryString ? `?${queryString}` : ""}`;
    const res = await api.transport.fetch(endpoint);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải lịch sử giao dịch.");

    const rawList = Array.isArray(json.data) ? json.data : (json.data?.transactions || []);
    const items: InventoryTransaction[] = rawList.map((raw: any) => ({
      id: raw._id || raw.id,
      voucherCode: raw.voucherId || raw.voucherCode || `PH-${(raw._id || "").slice(-6).toUpperCase()}`,
      type: raw.type === "in" ? "in" : "out",
      supplyId: raw.supplyId || "",
      supplyCode: raw.supplyCode || "N/A",
      supplyName: raw.supplyName || "Vật tư",
      unit: raw.unit || "Đơn vị",
      quantity: Number(raw.quantity) || 0,
      balanceBefore: Number(raw.balanceBefore) || 0,
      balanceAfter: Number(raw.balanceAfter) || 0,
      batchNumber: raw.batchNumber || "N/A",
      expiryDate: raw.expiryDate ? new Date(raw.expiryDate).toISOString().slice(0, 10) : undefined,
      recipientDepartment: raw.recipientDepartment || "Kho tổng",
      performerName: raw.performerName || "Người vận hành",
      reason: raw.reason || (raw.type === "in" ? "Nhập kho" : "Xuất cấp"),
      createdAt: raw.createdAt ? new Date(raw.createdAt).toLocaleString("vi-VN") : "Hôm nay",
      rawCreatedAt: raw.createdAt || "",
      status: raw.status === "completed" ? "completed" : "pending",
    }));

    return { data: items, total: json.total || items.length };
  },

  // 7. Danh sách nhà cung cấp
  async getSuppliers(params?: { search?: string }): Promise<InventorySupplier[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);

    const queryString = query.toString();
    const endpoint = `/api/v1/suppliers${queryString ? `?${queryString}` : ""}`;
    const res = await api.transport.fetch(endpoint);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải danh sách nhà cung cấp.");

    const rawList = Array.isArray(json.data) ? json.data : [];
    return rawList.map((raw: any) => ({
      id: raw._id || raw.id,
      code: raw.code || "NCC",
      name: raw.name || "Nhà cung cấp",
      shortName: raw.shortName || raw.name || "NCC",
      contactPerson: raw.contactPerson || "Đại diện kinh doanh",
      phone: raw.phone || "",
      email: raw.email || "",
      address: raw.address || "Chưa cập nhật địa chỉ",
      taxCode: raw.taxCode || "",
      suppliedItemsCount: Number(raw.supplyCount) || 0,
      isActive: raw.isActive !== false,
    }));
  },

  // 8. Danh sách kho bãi
  async getWarehouses(params?: { search?: string }): Promise<InventoryWarehouse[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);

    const queryString = query.toString();
    const endpoint = `/api/v1/warehouses${queryString ? `?${queryString}` : ""}`;
    const res = await api.transport.fetch(endpoint);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải danh sách kho lưu trữ.");

    const rawList = Array.isArray(json.data) ? json.data : [];
    return rawList.map((raw: any) => ({
      id: raw._id || raw.id,
      code: raw.code || "KHO",
      name: raw.name || "Kho lưu trữ",
      location: raw.location || "Tầng 1 - Khu lưu trữ",
      managerName: raw.managerName || "Thủ kho",
      managerPhone: raw.managerPhone || "",
      totalItemsCount: Number(raw.supplyCount) || 0,
      description: raw.description || "Lưu trữ vật tư, thiết bị y tế",
      isActive: raw.isActive !== false,
    }));
  },

  // 9. Danh sách danh mục nhóm hàng
  async getCategories(params?: { search?: string }): Promise<InventoryCategory[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);

    const queryString = query.toString();
    const endpoint = `/api/v1/categories${queryString ? `?${queryString}` : ""}`;
    const res = await api.transport.fetch(endpoint);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải danh mục phân loại.");

    const rawList = Array.isArray(json.data) ? json.data : [];
    return rawList.map((raw: any) => ({
      id: raw._id || raw.id,
      code: raw.code || "CAT",
      name: raw.name || "Danh mục",
      description: raw.description || "Phân loại vật tư y tế",
      itemCount: Number(raw.supplyCount) || 0,
      color: raw.color || "#059669",
      icon: raw.icon || "layers-outline",
    }));
  },

  // 10. Quản lý Danh mục (Tùy chỉnh)
  async createCategory(data: { name: string; code: string; description?: string; color?: string }): Promise<any> {
    const res = await api.transport.fetch("/api/v1/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tạo danh mục phân loại.");
    return json.data;
  },

  async updateCategory(id: string, data: Partial<{ name: string; code: string; description?: string; color?: string }>): Promise<any> {
    const res = await api.transport.fetch(`/api/v1/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể cập nhật danh mục phân loại.");
    return json.data;
  },

  async deleteCategory(id: string): Promise<void> {
    const res = await api.transport.fetch(`/api/v1/categories/${id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể xóa danh mục phân loại.");
  },

  // 11. Quản lý Nhà cung cấp (Tùy chỉnh)
  async createSupplier(data: {
    name: string;
    code: string;
    phone?: string;
    email?: string;
    address?: string;
    contactPerson?: string;
    taxCode?: string;
  }): Promise<any> {
    const res = await api.transport.fetch("/api/v1/suppliers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tạo nhà cung cấp.");
    return json.data;
  },

  async updateSupplier(
    id: string,
    data: Partial<{
      name: string;
      code: string;
      phone?: string;
      email?: string;
      address?: string;
      contactPerson?: string;
      taxCode?: string;
    }>,
  ): Promise<any> {
    const res = await api.transport.fetch(`/api/v1/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể cập nhật nhà cung cấp.");
    return json.data;
  },

  async deleteSupplier(id: string): Promise<void> {
    const res = await api.transport.fetch(`/api/v1/suppliers/${id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể xóa nhà cung cấp.");
  },

  // 12. Quản lý Kho lưu trữ (Tùy chỉnh)
  async createWarehouse(data: {
    name: string;
    code: string;
    location: string;
    managerName?: string;
    managerPhone?: string;
    description?: string;
  }): Promise<any> {
    const res = await api.transport.fetch("/api/v1/warehouses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tạo kho lưu trữ.");
    return json.data;
  },

  async updateWarehouse(
    id: string,
    data: Partial<{
      name: string;
      code: string;
      location: string;
      managerName?: string;
      managerPhone?: string;
      description?: string;
    }>,
  ): Promise<any> {
    const res = await api.transport.fetch(`/api/v1/warehouses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể cập nhật kho lưu trữ.");
    return json.data;
  },

  async deleteWarehouse(id: string): Promise<void> {
    const res = await api.transport.fetch(`/api/v1/warehouses/${id}`, {
      method: "DELETE",
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể xóa kho lưu trữ.");
  },

  // 13. Danh sách khoa / phòng ban thực tế từ cơ sở dữ liệu
  async getDepartments(params?: { search?: string }): Promise<Array<{ id: string; name: string; code?: string }>> {
    const query = new URLSearchParams();
    query.set("activeOnly", "true");
    if (params?.search) query.set("search", params.search);

    const queryString = query.toString();
    const endpoint = `/api/v1/departments${queryString ? `?${queryString}` : ""}`;
    const res = await api.transport.fetch(endpoint);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Không thể tải danh sách khoa/phòng ban.");

    const rawList = Array.isArray(json.data) ? json.data : [];
    return rawList.map((raw: any) => ({
      id: raw._id || raw.id,
      name: raw.name || "Phòng ban",
      code: raw.code || "",
    }));
  },
};
