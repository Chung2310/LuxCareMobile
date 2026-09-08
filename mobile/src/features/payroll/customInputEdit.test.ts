import { expect, it } from "vitest";
import { periodInputEditPayload, validateEditedPeriodInput } from "./periodInputEditModel";
const item = { employeeId: "a", periodKey: "2026-09", version: 1, bonus: 5, customValues: { ACTIVE: 10, OLD: 20 } };
const variables = [
  { code: "ACTIVE", name: "Active", unit: "number" },
  { code: "PERCENT", name: "Percent", unit: "percent" },
];
it("preserves inactive values when replacing the custom map", () => {
  const payload = periodInputEditPayload(item, {}, "reason", [], { ACTIVE: "0" }, variables);
  expect(payload.customValues).toEqual({ ACTIVE: 0, OLD: 20 });
  expect(payload.expectedVersion).toBe(1);
});
it("clears active custom values with a dotted path and no replacement map", () => {
  const payload = periodInputEditPayload(item, {}, "reason", ["custom.ACTIVE"], {}, variables);
  expect(payload.clearFields).toEqual(["custom.ACTIVE"]);
  expect(payload.customValues).toBeUndefined();
  expect(() =>
    validateEditedPeriodInput({ ...item, customValues: { OLD: 20 }, reason: "reason", version: 2 }, item, payload),
  ).not.toThrow();
});
it("rejects inactive codes, invalid amounts, unsafe paths and over-limit percent", () => {
  for (const custom of [{ OLD: "1" }, { ACTIVE: "-1" }, { ACTIVE: "1e3" }, { PERCENT: "101" }, { "BAD.path": "1" }])
    expect(() => periodInputEditPayload(item, {}, "reason", [], custom, variables)).toThrow();
  expect(() => periodInputEditPayload(item, {}, "reason", ["custom.OLD"], {}, variables)).toThrow();
  expect(() => periodInputEditPayload(item, {}, "reason", ["custom.PERCENT"], {}, variables)).toThrow();
});
it("blocks simultaneous custom map replacement and nested unset", () => {
  expect(() => periodInputEditPayload(item, {}, "reason", ["custom.ACTIVE"], { PERCENT: "10" }, variables)).toThrow();
  expect(periodInputEditPayload(item, {}, "reason", ["bonus"], { PERCENT: "10" }, variables).customValues).toEqual({
    ACTIVE: 10,
    OLD: 20,
    PERCENT: 10,
  });
});
it("requires every preserved and changed custom value in response", () => {
  const payload = periodInputEditPayload(item, {}, "reason", [], { ACTIVE: "0", PERCENT: "50" }, variables);
  const saved = { ...item, customValues: payload.customValues, reason: "reason", version: 2 };
  expect(() => validateEditedPeriodInput(saved, item, payload)).not.toThrow();
  for (const customValues of [{ ACTIVE: 0 }, { ACTIVE: 0, OLD: 20 }, { ACTIVE: 1, OLD: 20, PERCENT: 50 }])
    expect(() => validateEditedPeriodInput({ ...saved, customValues }, item, payload)).toThrow();
});
it("does not turn blank values into zero or erase custom data on basic edits", () => {
  expect(
    periodInputEditPayload(item, { bonus: "6" }, "reason", [], { ACTIVE: " " }, variables).customValues,
  ).toBeUndefined();
  expect(() => periodInputEditPayload(item, {}, "reason", [], { ACTIVE: "10" }, variables)).toThrow();
});
