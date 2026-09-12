import { describe, expect, it, vi } from "vitest";
import { createRolePermissionService } from "../../../../src/services/rolePermissionService";

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe("role permission API contract", () => {
  it("loads every page and scopes roles to the selected company", async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ data: [{ role: "one" }], total: 2 }))
      .mockResolvedValueOnce(response({ data: [{ role: "two" }], total: 2 }));
    const service = createRolePermissionService({ fetch, getAccessToken: () => null });
    expect(await service.list("A&B")).toEqual([{ role: "one" }, { role: "two" }]);
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/role-permissions?page=1&limit=100&companyCode=A%26B");
    expect(fetch.mock.calls[1][0]).toContain("page=2");
  });
  it("does not truncate the permission catalog at 100 entries", async () => {
    const items = Array.from({ length: 100 }, (_, i) => ({ code: "permission:" + i }));
    const fetch = vi.fn().mockResolvedValueOnce(response({ data: items, total: 101 }))
      .mockResolvedValueOnce(response({ data: [{ code: "last" }], total: 101 }));
    const service = createRolePermissionService({ fetch, getAccessToken: () => null });
    expect(await service.permissions()).toHaveLength(101);
    expect(fetch.mock.calls[1][0]).toBe("/api/v1/permissions?page=2&limit=100");
  });
  it("fails instead of using an incomplete catalog", async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ data: [{ code: "first" }], total: 2 }))
      .mockResolvedValueOnce(response({ data: [], total: 2 }));
    await expect(createRolePermissionService({ fetch, getAccessToken: () => null }).permissions()).rejects.toThrow("chưa tải đầy đủ");
  });
  it("sends the role configuration and encodes delete scope", async () => {
    const input = { companyCode: "A&B", role: "hr/team", level: 4, displayName: "Nhân sự", permissions: ["hr:read"] };
    const fetch = vi.fn().mockResolvedValueOnce(response({ data: input })).mockResolvedValueOnce(response({ status: "success" }));
    const service = createRolePermissionService({ fetch, getAccessToken: () => null });
    expect(await service.save(input)).toEqual(input);
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/role-permissions");
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "POST", body: JSON.stringify(input) });
    await service.remove(input.role, input.companyCode);
    expect(fetch.mock.calls[1][0]).toBe("/api/v1/role-permissions/hr%2Fteam?companyCode=A%26B");
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
  });
  it("surfaces server denial without treating the save as successful", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ message: "Không được cấp vai trò Admin." }, 403));
    await expect(createRolePermissionService({ fetch, getAccessToken: () => null })
      .save({ role: "admin", companyCode: "A", level: 2, permissions: ["*"] })).rejects.toThrow("Không được cấp vai trò Admin.");
  });
});
