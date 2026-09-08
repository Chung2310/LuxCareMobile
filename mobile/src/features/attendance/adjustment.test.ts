import { expect, it } from "vitest";
import { adjustmentPayload } from "./adjustment";
it("requires a valid status and meaningful audit reason", () => {
  expect(() => adjustmentPayload("unknown", "", "test")).toThrow();
  expect(() => adjustmentPayload("Present", "", " a ")).toThrow();
});
it("sends only status, note and reason without overwriting attendance evidence", () => {
  expect(adjustmentPayload("Late", " updated ", " correction ")).toEqual({
    status: "Late",
    note: "updated",
    adjustmentReason: "correction",
  });
});
