import { expect, it } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { notificationTarget } from "./notificationTarget";
const user = { uid: "u1", companyCode: "COMP", role: "user", enabledModules: ["hr"], permissions: [] } as UserProfile;
const work = { companyCode: "COMP", action: { tab: "NHÂN SỰ", subTab: "Giao Việc" } };
it("maps exact web targets to native screens", () => {
  expect(notificationTarget(work, user).target?.href).toBe("/(tabs)/work");
  expect(notificationTarget({ ...work, action: { tab: "NHÂN SỰ", subTab: "PHÒNG BAN" } }, user).target?.href).toBe(
    "/(tabs)/departments",
  );
});
it("checks session, company scope and module access", () => {
  expect(notificationTarget(work, null).target).toBeUndefined();
  expect(notificationTarget({ ...work, companyCode: "OTHER" }, user).target).toBeUndefined();
  expect(notificationTarget(work, { ...user, enabledModules: ["chat"] }).target).toBeUndefined();
});
it("requires dashboard permission", () => {
  const notice = { companyCode: "COMP", action: { tab: "TỔNG QUAN" } };
  expect(notificationTarget(notice, user).target).toBeUndefined();
  expect(notificationTarget(notice, { ...user, permissions: ["dashboard:read"] }).target?.href).toBe("/(tabs)");
});
it("does not guess destinations for unsupported tabs or arbitrary URLs", () => {
  for (const tab of ["https://example.com", "/(tabs)/work", "ĐÀO TẠO"])
    expect(notificationTarget({ companyCode: "COMP", action: { tab } }, user).target).toBeUndefined();
  expect(notificationTarget({ ...work, action: { tab: "NHÂN SỰ", subTab: "ĐÀO TẠO" } }, user).reason).toContain(
    "LuxCare web",
  );
  expect(notificationTarget({ companyCode: "COMP" }, user).target).toBeUndefined();
});
