import type { DepartmentRecord } from "../../../../src/services/departmentService";
import type { EquipmentRecord } from "../../../../src/types/equipment";

export function equipmentDepartmentName(item: Pick<EquipmentRecord, "departmentName" | "department">): string {
  return item.departmentName?.trim() || item.department?.trim() || "";
}

export function equipmentStatusFilter(value: string): string | undefined {
  return ({ ready: "available", booked: "requested", using: "in-use", maintenance: "maintenance", disposed: "retired" } as Record<string, string>)[value];
}

export function appendEquipmentPage(current: EquipmentRecord[], next: EquipmentRecord[]): EquipmentRecord[] {
  return [...new Map([...current, ...next].map(item => [item._id || item.id || item.code, item])).values()];
}

export function equipmentDepartmentChoices(
  departments: DepartmentRecord[],
  selectedId = "",
  selectedName = "",
) {
  const choices = departments
    .filter(department => department.isActive || department._id === selectedId)
    .map(department => ({
      value: department._id,
      label: `${department.name}${department.code ? ` (${department.code})` : ""}${department.isActive ? "" : " · Ngừng hoạt động"}`,
    }));

  // Preserve the saved assignment while the catalogue is unavailable or has changed.
  if (selectedId && !choices.some(choice => choice.value === selectedId)) {
    choices.unshift({ value: selectedId, label: selectedName || "Phòng ban đã gán" });
  }
  return choices;
}
