import { expect, it } from "vitest";
import { historicalUserLabel } from "./historicalUser";
it("keeps names and only marks deletion when the API confirms it", () => {
  expect(historicalUserLabel("An", true)).toBe("An · Tài khoản đã xóa");
  expect(historicalUserLabel("An")).toBe("An");
  expect(historicalUserLabel("", true)).toBe("Tài khoản đã xóa");
  expect(historicalUserLabel("Tài khoản đã xóa", true)).toBe(
    "Tài khoản đã xóa",
  );
  expect(historicalUserLabel(null, false, "Chưa phân công")).toBe(
    "Chưa phân công",
  );
});
