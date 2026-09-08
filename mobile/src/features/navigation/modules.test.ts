import { expect, it } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { availableModules } from "./modules";
const user = { uid: "u1", role: "user", companyCode: "COMP", enabledModules: ["hr"], permissions: [] } as UserProfile;
it("requires company, HR module and hr:read for contracts", () => {
  const visible = (profile: UserProfile | null) =>
    availableModules(profile).some((item) => item.href === "/(tabs)/contracts");
  expect(visible(null)).toBe(false);
  expect(visible(user)).toBe(false);
  expect(visible({ ...user, permissions: ["hr:manage"] })).toBe(false);
  expect(visible({ ...user, permissions: ["hr:read"] })).toBe(true);
  expect(visible({ ...user, permissions: ["*"], companyCode: "" })).toBe(false);
  expect(visible({ ...user, permissions: ["hr:read"], enabledModules: ["chat"] })).toBe(false);
});
it("restricts attendance management to HR managers with a company", () => {
  const visible = (profile: UserProfile) =>
    availableModules(profile).some((item) => item.href === "/(tabs)/attendance-management");
  expect(visible(user)).toBe(false);
  expect(visible({ ...user, permissions: ["timekeeping:manage"] })).toBe(true);
  expect(visible({ ...user, companyCode: "", permissions: ["timekeeping:manage"] })).toBe(false);
  expect(visible({ ...user, enabledModules: ["chat"], permissions: ["timekeeping:manage"] })).toBe(false);
});
it("requires both HR access and work read permission for KPI navigation", () => {
  const hasKpi = (profile: UserProfile | null) => availableModules(profile).some((item) => item.href === "/(tabs)/kpi");
  expect(hasKpi(null)).toBe(false);
  expect(hasKpi(user)).toBe(false);
  expect(hasKpi({ ...user, permissions: ["work:read"] })).toBe(true);
  expect(hasKpi({ ...user, enabledModules: ["chat"], permissions: ["work:read"] })).toBe(false);
});
