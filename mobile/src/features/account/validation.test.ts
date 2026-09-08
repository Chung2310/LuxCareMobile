import { expect, it } from "vitest";
import { profileName, confirmedPassword } from "./validation";
it("trims names but rejects blank names", () => {
  expect(profileName(" An ")).toBe("An");
  expect(() => profileName("  ")).toThrow();
});
it("checks password length and exact confirmation without trimming", () => {
  expect(() => confirmedPassword("short", "short")).toThrow();
  expect(() => confirmedPassword("secret", "Secret")).toThrow();
  expect(confirmedPassword(" secret ", " secret ")).toBe(" secret ");
});
