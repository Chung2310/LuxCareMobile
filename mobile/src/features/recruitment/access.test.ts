import { expect, it } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { recruitmentAccess } from "./access";
const user = { uid: "u", companyCode: "C", enabledModules: ["hr"], permissions: [], role: "user" } as UserProfile;
it("requires read permission separately from manage permission and HR", () => {
  expect(recruitmentAccess(null).read).toBe(false);
  expect(recruitmentAccess({ ...user, permissions: ["recruitment:manage"] }).read).toBe(false);
  expect(recruitmentAccess({ ...user, permissions: ["recruitment:read"] })).toEqual({ read: true, manage: false });
  expect(recruitmentAccess({ ...user, permissions: ["recruitment:read", "recruitment:manage"] }).manage).toBe(true);
  expect(recruitmentAccess({ ...user, enabledModules: ["chat"], permissions: ["*"] }).read).toBe(false);
  expect(recruitmentAccess({ ...user, companyCode: "", permissions: ["*"] }).read).toBe(false);
});
it("allows admin accounts to use recruitment within the HR module", () => {
  expect(recruitmentAccess({ ...user, role: "admin", permissions: [] })).toEqual({ read: true, manage: true });
  expect(recruitmentAccess({ ...user, role: "superadmin", permissions: [] })).toEqual({ read: true, manage: true });
});