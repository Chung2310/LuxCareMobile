import { expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { createHrCredentialService } from "../../../../src/services/hrCredentialService";
import { canReadCredentials } from "./model";
import { availableModules } from "../navigation/modules";
it("accepts either read permission while requiring HR and company", () => {
  const user = { uid: "u", role: "user", companyCode: "COMP", enabledModules: ["hr"], permissions: [] } as UserProfile;
  expect(canReadCredentials(user)).toBe(false);
  for (const permission of ["credentials:read", "hr:read", "*"]) {
    const allowed = { ...user, permissions: [permission] };
    expect(canReadCredentials(allowed)).toBe(true);
    expect(availableModules(allowed).some((item) => item.href === "/(tabs)/credentials")).toBe(true);
  }
  expect(canReadCredentials({ ...user, permissions: ["credentials:manage"] })).toBe(false);
  expect(canReadCredentials({ ...user, permissions: ["credentials:read"], companyCode: "" })).toBe(false);
  expect(canReadCredentials({ ...user, permissions: ["credentials:read"], enabledModules: ["chat"] })).toBe(false);
});
it("uses server filters and pagination without requesting every record", async () => {
  const data = {
    credentials: [],
    employees: [],
    total: 0,
    page: 2,
    limit: 20,
    summary: { total: 10, active: 5, expiring: 2, expired: 3 },
  };
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data })));
  const service = createHrCredentialService({ fetch, getAccessToken: () => "token" });
  expect(
    await service.list({
      companyCode: "A&B",
      branchId: "branch",
      search: "An + Bình",
      status: "expired",
      type: "practice_certificate",
      page: 2,
      limit: 20,
    }),
  ).toEqual(data);
  const url = new URL(fetch.mock.calls[0][0], "https://api.example");
  expect(url.pathname).toBe("/api/v1/hr-credentials");
  expect(Object.fromEntries(url.searchParams)).toEqual({
    companyCode: "A&B",
    branchId: "branch",
    search: "An + Bình",
    status: "expired",
    type: "practice_certificate",
    page: "2",
    limit: "20",
  });
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer token");
});
it("propagates permission errors and omits unused filters", async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Không có quyền" }), { status: 403 }));
  const service = createHrCredentialService({ fetch, getAccessToken: () => null });
  await expect(service.list({ companyCode: "A", type: "", page: 1, limit: 20 })).rejects.toMatchObject({ status: 403 });
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/hr-credentials?companyCode=A&page=1&limit=20");
});
