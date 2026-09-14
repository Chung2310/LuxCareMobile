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
it("accepts web-aligned adjustment statuses like Approved-WFH and Incomplete", () => {
  expect(adjustmentPayload("Approved-WFH", "wfh", "Đăng ký WFH").status).toBe("Approved-WFH");
  expect(adjustmentPayload("Approved-Exception", "ngoai le", "Duyệt bổ sung").status).toBe("Approved-Exception");
  expect(adjustmentPayload("Incomplete", "", "Quên chấm công").status).toBe("Incomplete");
  expect(adjustmentPayload("Partial", "", "Thiếu công").status).toBe("Partial");
});
