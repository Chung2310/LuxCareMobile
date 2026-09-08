import { expect, it } from "vitest";
import { shiftDraft, shiftPayload, assignmentDates } from "./model";
it("preserves advanced shift settings when editing unrelated fields", () => {
  const stored = {
    ...shiftDraft(),
    _id: "s1",
    code: "DAY",
    name: "Day",
    standardMinutes: 420,
    checkInFrom: "07:30",
    checkInUntil: "09:00",
    checkOutFrom: "16:00",
    checkOutUntil: "18:00",
  };
  expect(shiftPayload({ ...shiftDraft(stored), name: "Renamed" })).toMatchObject({
    standardMinutes: 420,
    checkInFrom: "07:30",
    checkOutUntil: "18:00",
    name: "Renamed",
  });
});
it("recalculates standard work time excluding only unpaid breaks when requested", () => {
  const draft = {
    ...shiftDraft(),
    code: "DAY",
    name: "Day",
    breakPeriods: [
      { name: "Lunch", startTime: "12:00", endTime: "13:00", paid: false },
      { name: "Rest", startTime: "15:00", endTime: "15:15", paid: true },
    ],
  };
  expect(shiftPayload(draft).standardMinutes).toBe(480);
  expect(shiftPayload({ ...draft, standardMinutes: 400 }).standardMinutes).toBe(400);
});
it("validates optional windows, preserves overnight windows and explicitly clears removed bounds", () => {
  const draft = {
    ...shiftDraft(),
    code: "NIGHT",
    name: "Night",
    checkInFrom: " 23:00 ",
    checkInUntil: "01:00",
    checkOutFrom: null,
  };
  expect(shiftPayload(draft)).toMatchObject({
    checkInFrom: "23:00",
    checkInUntil: "01:00",
    checkOutFrom: "",
    checkOutUntil: "",
  });
  expect(() => shiftPayload({ ...draft, checkOutUntil: "24:00" })).toThrow("HH:mm");
  for (const standardMinutes of [0, 1441, 2.5, NaN])
    expect(() => shiftPayload({ ...draft, standardMinutes })).toThrow("Công chuẩn");
});
it("supports overnight shifts with a break after midnight", () => {
  const result = shiftPayload({
    ...shiftDraft(),
    code: "night",
    name: "Night",
    startTime: "22:00",
    endTime: "06:00",
    breakPeriods: [{ name: "Rest", startTime: "02:00", endTime: "02:30", paid: false }],
  });
  expect(result.crossesMidnight).toBe(true);
  expect(result.code).toBe("NIGHT");
});
it("rejects breaks outside a shift and overlapping breaks", () => {
  const draft = { ...shiftDraft(), code: "DAY", name: "Day" };
  expect(() =>
    shiftPayload({ ...draft, breakPeriods: [{ name: "Bad", startTime: "18:00", endTime: "19:00", paid: false }] }),
  ).toThrow();
  expect(() =>
    shiftPayload({
      ...draft,
      breakPeriods: [
        { name: "A", startTime: "12:00", endTime: "13:00", paid: false },
        { name: "B", startTime: "12:30", endTime: "13:30", paid: true },
      ],
    }),
  ).toThrow();
});
it("requires valid work days, times and grace minutes", () => {
  const draft = { ...shiftDraft(), code: "DAY", name: "Day" };
  expect(() => shiftPayload({ ...draft, workingDays: [] })).toThrow();
  expect(() => shiftPayload({ ...draft, allowedLateMinutes: 241 })).toThrow();
  expect(() => shiftPayload({ ...draft, startTime: "25:00" })).toThrow();
});
it("validates assignment dates and allows open ended assignments", () => {
  expect(assignmentDates("2026-09-08", "")).toEqual({ effectiveFrom: "2026-09-08" });
  expect(() => assignmentDates("2026-09-08", "2026-09-07")).toThrow();
  expect(() => assignmentDates("2026-02-30", "")).toThrow();
});
