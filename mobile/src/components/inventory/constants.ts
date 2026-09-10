import type { InventorySupply, InventoryWarehouse } from "./types";

/**
 * Danh sách phòng ban dự phòng nếu chưa tải kịp từ máy chủ (ưu tiên tải từ database)
 */
export const DEFAULT_DEPARTMENTS: string[] = [];
export const DEPARTMENTS = DEFAULT_DEPARTMENTS;


/**
 * Sinh mã chứng từ tự động: PNK (Phiếu nhập kho) hoặc PXK (Phiếu xuất kho)
 */
export const generateVoucherCode = (txType: "in" | "out"): string => {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${txType === "in" ? "PNK" : "PXK"}-${ymd}-${rand}`;
};

/**
 * Kiểm tra xem vật tư có thuộc kho lưu trữ chỉ định hay không
 */
export const isSupplyInWarehouse = (
  s: InventorySupply,
  warehouseName: string,
  warehouseList: InventoryWarehouse[] = []
): boolean => {
  if (!warehouseName) return true;
  const target = warehouseName.trim().toLowerCase();
  const loc = (s.warehouseLocation || "").trim().toLowerCase();
  const wName = (s.warehouseName || "").trim().toLowerCase();
  const wId = (s.warehouseId || "").trim().toLowerCase();

  if (loc === target || wName === target || wId === target) return true;
  if (loc && (loc.includes(target) || target.includes(loc))) return true;
  if (wName && (wName.includes(target) || target.includes(wName))) return true;

  const foundW = warehouseList.find(
    (w) => w.name.trim().toLowerCase() === target || w.id.toLowerCase() === target
  );
  if (foundW) {
    if (s.warehouseId && s.warehouseId.toLowerCase() === foundW.id.toLowerCase()) return true;
    if (
      loc &&
      (loc === foundW.name.trim().toLowerCase() ||
        loc === foundW.location.trim().toLowerCase())
    ) {
      return true;
    }
  }
  return false;
};
