import { expect, it } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { workflowAccess } from "./access";

const user = {
  uid: "u1",
  role: "user",
  companyCode: "COMP",
  enabledModules: ["hr"],
  permissions: [],
} as UserProfile;

it("requires HR access and exposes read/manage independently", () => {
  expect(workflowAccess(null)).toEqual({ read: false, manage: false });
  expect(workflowAccess(user)).toEqual({ read: false, manage: false });
  expect(workflowAccess({ ...user, permissions: ["workflow:read"] })).toEqual({ read: true, manage: false });
  expect(workflowAccess({ ...user, permissions: ["workflow:manage"] })).toEqual({ read: true, manage: true });
  expect(workflowAccess({ ...user, permissions: ["workflow:manage"], enabledModules: ["chat"] })).toEqual({
    read: false,
    manage: false,
  });
});
