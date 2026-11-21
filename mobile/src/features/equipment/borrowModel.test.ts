import { expect, it } from "vitest";
import { canReturnEquipment, equipmentIdentity } from "./borrowModel";
import type { EquipmentRecord } from "../../../../src/types/equipment";

const item: EquipmentRecord = { _id: "one", companyCode: "COMP", name: "Máy", code: "TB", status: "in-use", currentBorrowerId: "me" };
it("only lets the actual current borrower select an in-use device for return", () => {
  expect(canReturnEquipment(item, "me")).toBe(true);
  expect(canReturnEquipment(item, "other")).toBe(false);
  expect(canReturnEquipment(item)).toBe(false);
  for (const status of ["requested", "available", "maintenance", "retired"]) expect(canReturnEquipment({ ...item, status }, "me")).toBe(false);
});
it("compares stable device IDs without treating missing optional IDs as equal", () => {
  expect(equipmentIdentity(null)).toBe("");
  expect(equipmentIdentity(item)).not.toBe(equipmentIdentity({ ...item, _id: "two" }));
  expect(equipmentIdentity({ ...item, _id: "", id: "fallback" })).toBe("fallback");
});
