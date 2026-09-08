import { expect, it, vi } from "vitest";
import { adjustmentInput } from "./adjustmentFormModel";
import { createPayrollService } from "../../../../src/services/payrollService";
const id = "a".repeat(24);
it("builds only business fields with trimmed reason and exact VND amount", () => {
  expect(adjustmentInput(id, [id], "deduction", " 100000 ", " Reason ")).toEqual({
    employeeId: id,
    kind: "deduction",
    amount: 100000,
    reason: "Reason",
  });
  expect(adjustmentInput(id, [id], "bonus", "0", "Reason").amount).toBe(0);
});
it("rejects unlisted employees, unsupported kinds, unsafe amounts and missing reason", () => {
  expect(() => adjustmentInput(id, [], "bonus", "100", "r")).toThrow();
  expect(() => adjustmentInput(id, [id], "other", "100", "r")).toThrow();
  for (const amount of ["", "-1", "1.5", "1,000", "1e6", "9007199254740992"])
    expect(() => adjustmentInput(id, [id], "bonus", amount, "r")).toThrow();
  expect(() => adjustmentInput(id, [id], "bonus", "100", " ")).toThrow();
});
it("posts the selected period and payload once without setting approval status", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { _id: "new", status: "pending" } })));
  const service = createPayrollService({ fetch, getAccessToken: () => "token" });
  const payload = adjustmentInput(id, [id], "bonus", "100", "reason");
  await service.createAdjustment("2026/09", payload);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/payroll/periods/2026%2F09/adjustments");
  expect(fetch.mock.calls[0][1].method).toBe("POST");
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(payload);
});
