import { describe, expect, it } from "vitest";
import type { DepartmentRecord } from "../../../../src/services/departmentService";
import { appendEquipmentPage, equipmentDepartmentChoices, equipmentDepartmentName, equipmentStatusFilter } from "./departmentModel";
import type { EquipmentRecord } from "../../../../src/types/equipment";

const department = (id: string, name: string, isActive = true): DepartmentRecord => ({
  _id: id, name, code: id.toUpperCase(), companyCode: "COMP", sortOrder: 0, isActive,
});

describe("equipment departments", () => {
  it("displays the canonical name ahead of legacy department text", () => {
    expect(equipmentDepartmentName({ departmentName: "  Khoa Khám  ", department: "Tên cũ" })).toBe("Khoa Khám");
    expect(equipmentDepartmentName({ department: "Tên cũ" })).toBe("Tên cũ");
    expect(equipmentDepartmentName({})).toBe("");
  });

  it("uses department IDs and keeps only active departments plus the current inactive assignment", () => {
    const departments = [department("one", "Khoa Khám"), department("two", "Khoa Cũ", false), department("three", "Ngừng", false)];
    expect(equipmentDepartmentChoices(departments).map(choice => choice.value)).toEqual(["one"]);
    expect(equipmentDepartmentChoices(departments, "two")).toEqual([
      { value: "one", label: "Khoa Khám (ONE)" },
      { value: "two", label: "Khoa Cũ (TWO) · Ngừng hoạt động" },
    ]);
  });

  it("preserves the saved assignment when loading fails without inferring IDs from names", () => {
    expect(equipmentDepartmentChoices([], "saved-id", "Khoa Khám")).toEqual([{ value: "saved-id", label: "Khoa Khám" }]);
    expect(equipmentDepartmentChoices([], "saved-id")).toEqual([{ value: "saved-id", label: "Phòng ban đã gán" }]);
    expect(equipmentDepartmentChoices([], "", "Tên cũ")).toEqual([]);
  });

  it("refreshes a renamed department using the stable ID instead of the saved name", () => {
    expect(equipmentDepartmentChoices([department("one", "Tên mới")], "one", "Tên cũ")).toEqual([
      { value: "one", label: "Tên mới (ONE)" },
    ]);
  });

  it("maps UI status filters to the backend's canonical values", () => {
    expect(["all", "ready", "booked", "using", "maintenance", "disposed"].map(equipmentStatusFilter))
      .toEqual([undefined, "available", "requested", "in-use", "maintenance", "retired"]);
  });

  it("appends another page without duplicating records when data changes between requests", () => {
    const item: EquipmentRecord = { _id: "one", companyCode: "COMP", code: "TB", name: "Máy soi", status: "available" };
    const merged = appendEquipmentPage([item], [{ ...item, departmentName: "Tên mới" }, { ...item, _id: "two", code: "TB2" }]);
    expect(merged.map(record => record._id)).toEqual(["one", "two"]);
    expect(merged[0].departmentName).toBe("Tên mới");
  });
});
