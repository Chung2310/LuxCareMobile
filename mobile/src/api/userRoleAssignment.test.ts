import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRosterService } from "../../../src/services/rosterService";
import { userManagementApi } from "./userManagementApi";
const { fetch } = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("./services", () => ({ api: { transport: { fetch } } }));
const roster = createRosterService({ fetch, getAccessToken: () => null });
beforeEach(() => {
  fetch.mockReset();
  fetch.mockImplementation(async () => new Response(JSON.stringify({ success: true })));
});
describe("employee role assignment", () => {
  it.each(["admin", "superadmin", " ADMIN "])("blocks %s in both profile update paths before making a request", async (role) => {
    await expect(roster.update("employee", { role })).rejects.toThrow();
    await expect(userManagementApi.updateUser("employee", { role })).rejects.toThrow();
    await expect(userManagementApi.updateRole("employee", role)).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["user", "manager", "branch_owner", "custom_role"])("continues to allow assigning %s", async (role) => {
    await roster.update("employee", { role });
    await userManagementApi.updateRole("employee", role);
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [, init] of fetch.mock.calls) expect(JSON.parse(init.body)).toEqual({ role });
  });
  it("allows personal details to be saved without sending a role or status change", async () => {
    await roster.update("existing-admin", { displayName: "Updated name" });
    await userManagementApi.updateUser("existing-admin", { displayName: "Updated name" });
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [, init] of fetch.mock.calls) expect(JSON.parse(init.body)).toEqual({ displayName: "Updated name" });
  });
});
