import { expect, it } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import type { WorkCalendarDay } from "../../../../src/services/companyWorkCalendarService";
import { calendarAccess, calendarInput, calendarToggle } from "./model";
const user = { role: "admin", companyCode: "COMP", enabledModules: ["hr"], permissions: [] } as UserProfile;
it("requires admin role for reading and additional permission for writing", () => {
  expect(calendarAccess(user)).toEqual({ read: true, write: false });
  expect(calendarAccess({ ...user, permissions: ["timekeeping:manage"] })).toEqual({ read: true, write: true });
  expect(calendarAccess({ ...user, role: "manager", permissions: ["timekeeping:manage"] }).read).toBe(false);
  expect(calendarAccess(null).read).toBe(false);
});
it("requires a disable reason but allows enabling without one", () => {
  expect(() => calendarToggle({ isApplied: true } as WorkCalendarDay, " ")).toThrow();
  expect(calendarToggle({ isApplied: true } as WorkCalendarDay, " Holiday changed ")).toEqual({
    isApplied: false,
    adminReason: "Holiday changed",
  });
  expect(calendarToggle({ isApplied: false } as WorkCalendarDay, "")).toEqual({ isApplied: true });
});
it("rejects impossible days and keeps date-only values", () => {
  expect(() => calendarInput("2026-02-30", "Holiday", "holiday")).toThrow();
  expect(calendarInput("2026-09-02", " Holiday ", "holiday")).toEqual({
    date: "2026-09-02",
    name: "Holiday",
    dayType: "holiday",
  });
});
