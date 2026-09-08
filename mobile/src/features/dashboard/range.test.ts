import { expect, it } from "vitest";
import { customDashboardRange } from "./range";
it("keeps date-only API values without timezone conversion", () => {
  expect(customDashboardRange("2024-02-29", "2024-03-01")).toEqual({
    filter: "custom",
    startDate: "2024-02-29",
    endDate: "2024-03-01",
  });
});
it.each([
  ["2026-02-29", "2026-03-01"],
  ["2026-04-31", "2026-05-01"],
  ["2026-09-10", "2026-09-09"],
  ["", "2026-09-09"],
  ["09/09/2026", "2026-09-09"],
])("rejects invalid range %s to %s", (start, end) => {
  expect(() => customDashboardRange(start, end)).toThrow();
});
it("allows one day", () => {
  expect(customDashboardRange("2026-09-08", "2026-09-08").startDate).toBe("2026-09-08");
});
