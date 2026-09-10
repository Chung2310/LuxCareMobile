export type SupplyStockStatus = "in-stock" | "low-stock" | "out-of-stock" | "expired" | "quarantined";

export type InventorySectionTab =
  | "supplies"
  | "transactions"
  | "batches"
  | "suppliers"
  | "warehouses"
  | "categories";

export interface InventorySupply {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  quantity: number;
  minQuantity: number;
  unitPrice: number;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  manufactureDate?: string;
  requiresExpiry?: boolean;
  warehouseLocation: string;
  warehouseName?: string;
  warehouseId?: string;
  supplierName: string;
  supplier?: string;
  supplierId?: string;
  status: SupplyStockStatus;
  inspectionCertificateNumber?: string;
  inspectionDate?: string;
  nextInspectionDate?: string;
  imageUrl?: string;
  images?: string[];
  documents?: Array<{
    name: string;
    fileUrl: string;
    fileType?: string;
    fileSize?: number;
    uploadedAt?: string;
  }>;
  notes?: string;
}

export interface InventoryStats {
  totalItems: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  expiredCount: number;
  expiringSoonCount: number;
  totalValue: number;
}

// 1. Giao dịch xuất / nhập kho
export interface InventoryTransaction {
  id: string;
  voucherCode: string; // PNK-2026-001 hoặc PXK-2026-042
  type: "in" | "out";
  supplyId: string;
  supplyCode: string;
  supplyName: string;
  unit: string;
  quantity: number;
  balanceBefore: number;
  balanceAfter: number;
  batchNumber: string;
  expiryDate?: string;
  recipientDepartment?: string; // Khoa Cấp Cứu, Phòng Mổ...
  performerName: string; // Dược sĩ Nguyễn Thị Mai...
  reason: string; // Nhập kho định kỳ, Xuất cấp phòng mổ khẩn cấp...
  createdAt: string; // ISO hoặc định dạng ngày giờ
  rawCreatedAt?: string;
  status: "completed" | "pending";
}

// 2. Tồn theo từng lô hàng (Batch/Lot Inventory)
export interface InventoryBatchItem {
  id: string;
  supplyId: string;
  supplyCode: string;
  supplyName: string;
  category: string;
  unit: string;
  batchNumber: string;
  manufactureDate: string;
  expiryDate: string;
  quantity: number;
  warehouseName: string;
  warehouseLocation: string;
  supplierName: string;
  daysToExpiry: number;
  expiryStatus: "valid" | "warning" | "expired"; // Còn hạn, Cận hạn (<60 ngày), Quá hạn
}

// 3. Nhà cung cấp (Suppliers)
export interface InventorySupplier {
  id: string;
  code: string;
  name: string;
  shortName: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  taxCode: string;
  suppliedItemsCount: number;
  isActive: boolean;
}

// 4. Kho lưu trữ (Warehouses)
export interface InventoryWarehouse {
  id: string;
  code: string;
  name: string;
  location: string;
  managerName: string;
  managerPhone: string;
  totalItemsCount: number;
  description: string;
  isActive: boolean;
}

// 5. Danh mục nhóm hàng (Categories)
export interface InventoryCategory {
  id: string;
  code: string;
  name: string;
  description: string;
  itemCount: number;
  color: string;
  icon: string;
}
