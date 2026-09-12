import { describe, expect, it } from "vitest";
import { canEditRole, canManageRoles, roleSlug, togglePermission, withDefaultRoles, groupPermissions } from "./model";
describe("role management policy", () => {
  it("restricts role configuration to admins and protects privileged roles", () => {
    expect(canManageRoles(null)).toBe(false);
    expect(canManageRoles({ role: "manager" })).toBe(false);
    expect(canManageRoles({ role: "branch_owner" })).toBe(false);
    expect(canEditRole({ role: "admin" }, "admin")).toBe(false);
    expect(canEditRole({ role: "admin" }, "superadmin")).toBe(false);
    expect(canEditRole({ role: "admin" }, "hr_team")).toBe(true);
    expect(canEditRole({ role: "superadmin" }, "admin")).toBe(true);
    expect(canEditRole({ role: "superadmin" }, "superadmin")).toBe(false);
  });
  it("uses configured empty permissions instead of defaults and isolates companies", () => {
    const roles = withDefaultRoles([
      { role: "manager", level: 4, companyCode: "A", permissions: [] },
      { role: "custom", level: 6, companyCode: "B", permissions: ["*"] },
    ], "A");
    expect(roles.find(item => item.role === "manager")?.permissions).toEqual([]);
    expect(roles.find(item => item.role === "custom")).toBeUndefined();
    expect(roles.find(item => item.role === "admin")?.permissions).toEqual(["*"]);
  });
  it("normalizes Vietnamese names into stable role codes", () => {
    expect(roleSlug("  Trưởng phòng Đào tạo  ")).toBe("truong_phong_dao_tao");
  });
  it("adds implied read permission and removes the grants that require a removed read", () => {
    expect(togglePermission([], "hr:manage")).toEqual(expect.arrayContaining(["hr:read", "hr:manage"]));
    expect(togglePermission(["hr:read", "hr:manage"], "hr:read")).toEqual([]);
  });
  it("preserves newer server permissions and wildcard grants", () => {
    expect(togglePermission(["new:permission"], "hr:read")).toContain("new:permission");
    expect(togglePermission(["*"], "hr:read")).toEqual(["*"]);
  });
  it("searches and groups catalog permissions", () => {
    const groups = groupPermissions([{ code: "hr:read", name: "Read HR", module: "hr" }], "hr:read");
    expect(groups).toHaveLength(1);
    expect(groups[0][1][0].code).toBe("hr:read");
    expect(groupPermissions([{ code: "hr:read", name: "Read HR", module: "hr" }], "no-match")).toEqual([]);
  });
});
