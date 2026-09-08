import { expect, it, vi } from "vitest";
import { paymentMetadataInput, validatePaymentMetadata } from "./paymentMetadataModel";
import { paymentDraftInput } from "./paymentFormModel";
import { createPayrollService } from "../../../../src/services/payrollService";
it("omits blank fields so existing metadata is preserved", () => {
  expect(paymentMetadataInput(" ", " ", " ")).toEqual({});
});
it("converts a Vietnam calendar day independently of device timezone", () => {
  expect(paymentMetadataInput(" 2028-02-29 ", "", "")).toEqual({ paymentDate: "2028-02-28T17:00:00.000Z" });
});
it("rejects impossible or ambiguous dates instead of normalizing them", () => {
  for (const date of [
    "2026-02-29",
    "2026-04-31",
    "2026-13-01",
    "2026-00-01",
    "08/09/2026",
    "2026-9-8",
    "2026-09-08T00:00:00Z",
  ])
    expect(() => paymentMetadataInput(date, "", "")).toThrow();
});
it("trims note and HTTP evidence without changing the URL", () => {
  expect(paymentMetadataInput("", " https://example.com/proof?id=1 ", " note ")).toEqual({
    evidenceUrl: "https://example.com/proof?id=1",
    note: "note",
  });
  expect(paymentMetadataInput("", "http://example.com/proof", "").evidenceUrl).toBe("http://example.com/proof");
});
it("rejects unsupported, malformed and overlong evidence and notes", () => {
  for (const url of [
    "javascript:alert(1)",
    "file:///proof",
    "example.com",
    "https://",
    "https://example.com/a b",
    "https:\\example.com",
    "https://example.com/" + "a".repeat(2000),
  ])
    expect(() => paymentMetadataInput("", url, "")).toThrow();
  expect(() => paymentMetadataInput("", "", "a".repeat(1001))).toThrow();
  expect(paymentMetadataInput("", "", "a".repeat(1000)).note).lengthOf(1000);
});
it("includes metadata alongside draft allocation", () => {
  expect(
    paymentDraftInput(
      { _id: "r", periodKey: "2026-09", status: "closed", effectiveLines: [{ employeeId: "a", calculation: {} }] },
      { a: "100" },
      "note",
      "2026-09-08",
      "https://example.com/proof",
    ),
  ).toEqual({
    amount: 100,
    lines: [{ employeeId: "a", amount: 100 }],
    note: "note",
    paymentDate: "2026-09-07T17:00:00.000Z",
    evidenceUrl: "https://example.com/proof",
  });
});
it("validates every submitted field and accepts equivalent timestamp offsets", () => {
  const expected = paymentMetadataInput("2026-09-08", "https://example.com/proof", "note");
  expect(() =>
    validatePaymentMetadata({ ...expected, paymentDate: "2026-09-08T00:00:00+07:00" }, expected),
  ).not.toThrow();
  for (const change of [{ note: "other" }, { evidenceUrl: undefined }, { paymentDate: "2026-09-08T00:00:00Z" }])
    expect(() => validatePaymentMetadata({ ...expected, ...change }, expected)).toThrow();
  expect(() => validatePaymentMetadata(null, expected)).toThrow();
  expect(() => validatePaymentMetadata({ note: "old" }, {})).not.toThrow();
});
it.each(["confirmPayment", "cancelPayment", "reversePayment"] as const)(
  "sends optional metadata through %s while old calls remain bodyless",
  async (method) => {
    const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: {} })));
    const service = createPayrollService({ fetch, getAccessToken: () => "t" });
    const payload = {
      note: "note",
      evidenceUrl: "https://example.com/proof",
      ...(method === "confirmPayment" ? { paymentDate: "2026-09-07T17:00:00.000Z" } : {}),
    };
    await service[method]("p/1", payload);
    expect(fetch.mock.calls[0][0]).toBe(`/api/v1/payroll/payments/p%2F1/${method.replace("Payment", "")}`);
    expect(fetch.mock.calls[0][1].body).toBe(JSON.stringify(payload));
    await service[method]("p/1");
    expect(fetch.mock.calls[1][1].body).toBeUndefined();
  },
);
