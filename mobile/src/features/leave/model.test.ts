import { expect, it } from "vitest";
import { canDeleteLeave, leaveDateRange, localDay } from "./model";
it("validates calendar dates and matches the existing local all-day FE contract", () => {
  expect(() => leaveDateRange("2026-02-30", "2026-03-01")).toThrow();
  expect(() => leaveDateRange("2026-09-09", "2026-09-08")).toThrow();
  const result = leaveDateRange("2028-02-29", "2028-03-01");
  expect(localDay(new Date(result.startDate))).toBe("2028-02-29");
  expect(new Date(result.startDate).getHours()).toBe(0);
  expect(localDay(new Date(result.endDate))).toBe("2028-03-01");
  expect(new Date(result.endDate).getHours()).toBe(23);
});
it("only offers removal of pending requests owned by the user or an admin", () => {
  const item = { status: "pending", employeeId: "owner" } as any;
  expect(canDeleteLeave(item, { uid: "owner", role: "user" })).toBe(true);
  expect(canDeleteLeave(item, { uid: "other", role: "manager" })).toBe(false);
  expect(canDeleteLeave(item, { uid: "other", role: "admin" })).toBe(true);
  expect(canDeleteLeave({ ...item, status: "approved" }, { uid: "other", role: "admin" })).toBe(false);
});
