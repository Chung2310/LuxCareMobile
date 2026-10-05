import { describe, expect, it } from "vitest";
import { needsOnboarding, isOnboardingRoute } from "../../../shared/onboarding";
describe("onboarding access boundaries", () => {
  it("keeps existing company members and privileged/editor accounts out of the portal", () => {
    expect(needsOnboarding(null)).toBe(false);
    expect(needsOnboarding({ role: "user", companyCode: "LUX" })).toBe(false);
    expect(needsOnboarding({ role: "superadmin" })).toBe(false);
    expect(needsOnboarding({ role: "blog_author" })).toBe(false);
    expect(needsOnboarding({ role: "user" })).toBe(true);
    expect(needsOnboarding({ role: "admin" })).toBe(true);
  });
  it("allows only personal auth/onboarding endpoints before joining a company", () => {
    expect(isOnboardingRoute("GET", "/api/v1/auth/me?x=1")).toBe(true);
    expect(isOnboardingRoute("POST", "/api/v1/onboarding/email/verify")).toBe(true);
    expect(isOnboardingRoute("DELETE", "/api/v1/auth/delete-account")).toBe(true);
    expect(isOnboardingRoute("PATCH", "/api/v1/auth/profile")).toBe(true);
    for (const path of [
      "/api/v1/auth/users",
      "/api/v1/crud/users",
      "/api/v1/onboarding-other",
      "/api/v1/company-invitations",
      "/api/v1/auth/register-user",
      "/api/v1/chat/rooms",
      "/api/v1/media/upload",
    ]) {
      expect(isOnboardingRoute("GET", path)).toBe(false);
    }
    expect(isOnboardingRoute("POST", "/api/v1/auth/me")).toBe(false);
  });
});
