import { describe, expect, it } from "vitest";
import { formatIntegerInput, formatNumber, parseIntegerInput } from "./numberFormat";

describe("number formatting", () => {
  it("formats display values with Vietnamese thousands separators", () => {
    expect(formatNumber(1234567890)).toBe("1.234.567.890");
  });

  it("formats numeric input without changing the numeric payload", () => {
    expect(formatIntegerInput("1a234567")).toBe("1.234.567");
    expect(parseIntegerInput("1.234.567")).toBe(1234567);
  });
});