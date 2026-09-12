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
it("groups work, projects and monthly KPI under one mobile module", () => {
  const modules = availableModules({ ...user, permissions: ["work:read"] });
  expect(modules.filter((item) => item.href === "/(tabs)/work")).toHaveLength(1);
  expect(modules.some((item) => item.href === "/(tabs)/projects")).toBe(false);
  expect(modules.some((item) => item.href === "/(tabs)/kpi")).toBe(false);
  expect(availableModules({ ...user, enabledModules: ["chat"], permissions: ["work:read"] }).some((item) => item.href === "/(tabs)/work")).toBe(false);
});

it("only exposes role management to administrators", () => {
  const visible = (role: UserProfile["role"]) => availableModules({ ...user, role }).some(item => item.href === "/(tabs)/roles");
  expect(visible("admin")).toBe(true);
  expect(visible("superadmin")).toBe(true);
  expect(visible("manager")).toBe(false);
  expect(visible("branch_owner")).toBe(false);
  expect(visible("user")).toBe(false);
});
