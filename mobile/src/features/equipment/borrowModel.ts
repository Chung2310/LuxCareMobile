import type { EquipmentRecord } from "../../../../src/types/equipment";

export function canReturnEquipment(item: EquipmentRecord, userId?: string) {
  return !!userId && item.status === "in-use" && item.currentBorrowerId === userId;
}

export function equipmentIdentity(item: EquipmentRecord | null) {
  return item?._id || item?.id || "";
}
