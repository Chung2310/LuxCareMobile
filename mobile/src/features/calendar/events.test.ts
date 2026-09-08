import { expect, it } from "vitest";
import type { CalendarItem } from "../../../../src/services/hrCalendarService";
import { calendarEvents } from "./events";
const item: CalendarItem = {
  id: "1",
  companyCode: "C",
  title: "Họp",
  type: "event",
  status: "active",
  creatorId: "u1",
  startDate: "2026-08-31T17:00:00Z",
  endDate: "2026-08-31T18:00:00Z",
};
it("includes overlapping events at Vietnam month boundaries and excludes next month", () => {
  expect(calendarEvents([item], "2026-09", "all", "")).toHaveLength(1);
  expect(
    calendarEvents(
      [{ ...item, startDate: "2026-09-30T17:00:00Z", endDate: "2026-09-30T18:00:00Z" }],
      "2026-09",
      "all",
      "",
    ),
  ).toHaveLength(0);
  expect(
    calendarEvents(
      [{ ...item, startDate: "2026-08-15T00:00:00Z", endDate: "2026-10-01T00:00:00Z" }],
      "2026-09",
      "all",
      "",
    ),
  ).toHaveLength(1);
});
it("hides pending and malformed events", () => {
  expect(
    calendarEvents(
      [
        { ...item, status: "pending" },
        { ...item, endDate: "invalid" },
        { ...item, endDate: "2020-01-01" },
      ],
      "2026-09",
      "all",
      "",
    ),
  ).toEqual([]);
});
it("combines type, search and related-person filters", () => {
  expect(calendarEvents([item], "2026-09", "event", " HỌP ", "u1")).toHaveLength(1);
  expect(calendarEvents([item], "2026-09", "leave", "")).toHaveLength(0);
  expect(calendarEvents([item], "2026-09", "all", "", "u2")).toHaveLength(0);
  expect(calendarEvents([{ ...item, assigneeId: "u2" }], "2026-09", "all", "", "u2")).toHaveLength(1);
});
