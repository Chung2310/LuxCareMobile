import type { DepartmentRecord, DepartmentInput } from "../../../../src/services/departmentService";
import type { RoomRecord, RoomInput, RoomType } from "../../../../src/services/roomService";
import { ROOM_TYPE_LABELS } from "../../../../src/services/roomService";

export interface DepartmentStatMetrics {
  total: number;
  active: number;
  inactive: number;
  totalStaff: number;
}

export type DepartmentFilterMode = "all" | "active" | "inactive";
export type DepartmentTabType = "departments" | "rooms";

export const DEPARTMENT_CODE_PALETTES = [
  { bg: "#dbeafe", text: "#1d4ed8", border: "#bfdbfe" },
  { bg: "#dcfce7", text: "#15803d", border: "#bbf7d0" },
  { bg: "#fef3c7", text: "#b45309", border: "#fde68a" },
  { bg: "#f3e8ff", text: "#7e22ce", border: "#e9d5ff" },
  { bg: "#ffe4e6", text: "#be123c", border: "#fecdd3" },
  { bg: "#ccfbf1", text: "#0f766e", border: "#99f6e4" },
  { bg: "#e0e7ff", text: "#4338ca", border: "#c7d2fe" },
  { bg: "#ffedd5", text: "#c2410c", border: "#fed7aa" },
];

export function getDepartmentCodePalette(codeOrName: string) {
  let hash = 0;
  for (let i = 0; i < codeOrName.length; i++) {
    hash = codeOrName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DEPARTMENT_CODE_PALETTES.length;
  return DEPARTMENT_CODE_PALETTES[index];
}

export const ROOM_TYPE_ICONS: Record<RoomType, { icon: string; color: string; bg: string }> = {
  clinic: { icon: "medkit", color: "#059669", bg: "#ecfdf5" },
  office: { icon: "business", color: "#2563eb", bg: "#eff6ff" },
  storage: { icon: "cube", color: "#d97706", bg: "#fffbeb" },
  treatment: { icon: "pulse", color: "#dc2626", bg: "#fef2f2" },
  meeting: { icon: "people", color: "#7c3aed", bg: "#f5f3ff" },
  other: { icon: "grid", color: "#475569", bg: "#f1f5f9" },
};

export { DepartmentRecord, DepartmentInput, RoomRecord, RoomInput, RoomType, ROOM_TYPE_LABELS };
