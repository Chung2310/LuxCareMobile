import { describe, expect, it, vi } from "vitest";
import type { UserProfile } from "../../../../src/types/common";
import { createBranchService, type BranchRecord } from "../../../../src/services/branchService";
import { attendanceNetwork, branchDraft, branchPayload, canCreateBranch, canEditBranch, canReadBranches, generateBranchCode, newLocation, ownerPayload } from "./model";
const admin = { uid: "admin", role: "admin", companyCode: "LUX" } as UserProfile;
const branch = { _id: "b1", companyCode: "LUX", code: "MAIN", name: "Main", isActive: true } as BranchRecord;
const location = { ...newLocation("l1"), name: "Văn phòng", latitude: "10.77", longitude: "106.69", allowedPublicIps: "1.2.3.4" };
describe("branch management", () => {
  it("gates creation and edits by role, tenant and assigned branch", () => {
    expect(canReadBranches(null)).toBe(false);
    expect(canCreateBranch(admin)).toBe(true);
    expect(canEditBranch(admin, branch)).toBe(true);
    expect(canEditBranch(admin, { ...branch, companyCode: "OTHER" })).toBe(false);
    const owner = { ...admin, role: "branch_owner", branchId: "b1", permissions: ["user:read", "user:manage"] } as UserProfile;
    expect(canCreateBranch(owner)).toBe(false);
    expect(canEditBranch(owner, branch)).toBe(true);
    expect(canEditBranch(owner, { ...branch, _id: "b2" })).toBe(false);
    expect(canEditBranch({ ...owner, permissions: ["user:read"] }, branch)).toBe(false);
  });
  it("generates codes using LuxCare Vietnamese name normalization", () => {
    expect(generateBranchCode("LUX", "Chi nhánh Đà Nẵng")).toBe("LUX_CHI_NHANH_DA_NANG");
    expect(generateBranchCode("LUX", " ")).toBe("");
    expect(generateBranchCode("LUX", "Chi nhánh rất dài ".repeat(5)).length).toBeLessThanOrEqual(32);
  });
  it("preserves legacy locations and explicit empty location lists", () => {
    const config = { latitude: 0, longitude: 0, allowedRadius: 100, allowedPublicIps: ["1.2.3.4"] };
    expect(branchDraft({ ...branch, locationConfig: config }).locations[0]).toMatchObject({ id: "legacy", latitude: "0", longitude: "0" });
    expect(branchDraft({ ...branch, locationConfig: config, attendanceLocations: [] }).locations).toEqual([]);
  });
  it("validates GPS, radius and office IP without converting blanks to zero", () => {
    const draft = { ...branchDraft(branch), locations: [location] };
    expect(branchPayload(draft, "LUX").attendanceLocations?.[0]).toMatchObject({ latitude: 10.77, longitude: 106.69, allowedRadius: 100 });
    for (const patch of [{ latitude: "" }, { latitude: "91" }, { longitude: "181" }, { allowedRadius: "0" }, { allowedPublicIps: "" }, { allowedPublicIps: "999.2.3.4" }]) {
      expect(() => branchPayload({ ...draft, locations: [{ ...location, ...patch }] }, "LUX")).toThrow();
    }
    expect(branchPayload({ ...draft, locations: [{ ...location, latitude: "0", longitude: "0" }] }, "LUX").attendanceLocations?.[0].latitude).toBe(0);
  });
  it("deduplicates office networks and excludes IP checks for business trips", () => {
    const draft = { ...branchDraft(branch), locations: [{ ...location, allowedPublicIps: "1.2.3.4\n1.2.3.4,2001:db8::/64" }] };
    expect(branchPayload(draft, "LUX").attendanceLocations?.[0].allowedPublicIps).toEqual(["1.2.3.4", "2001:db8::/64"]);
    expect(branchPayload({ ...draft, locations: [{ ...location, type: "business_trip" }] }, "LUX").attendanceLocations?.[0].allowedPublicIps).toEqual([]);
    expect(attendanceNetwork("2001:db8:1234:5678:9abc::1")).toBe("2001:db8:1234:5678::/64");
    expect(attendanceNetwork("1.2.3.4")).toBe("1.2.3.4");
  });
  it("validates owner input before creating a pending branch", () => {
    const owner = { displayName: " Chủ chi nhánh ", email: "owner@example.com", password: "secret123" };
    expect(ownerPayload(owner).displayName).toBe("Chủ chi nhánh");
    for (const patch of [{ email: "bad" }, { password: "123" }, { displayName: " " }, { phone: "123" }]) expect(() => ownerPayload({ ...owner, ...patch })).toThrow();
  });
  it("uses authenticated branch endpoints and reports field validation errors", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: branch })));
    const service = createBranchService({ fetch, getAccessToken: () => "token" });
    await service.create({ code: "B", name: "Branch" });
    await service.createOwner("b/1", { displayName: "Owner", email: "owner@example.com", password: "secret123" });
    await service.update("b/1", { isActive: false });
    await service.removePending("b/1");
    expect(fetch.mock.calls.map(call => [call[0], call[1].method])).toEqual([
      ["/api/v1/auth/branches", "POST"], ["/api/v1/auth/branches/b%2F1/owner", "POST"], ["/api/v1/auth/branches/b%2F1", "PATCH"], ["/api/v1/auth/branches/b%2F1/pending", "DELETE"],
    ]);
    expect(fetch.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer token");
    fetch.mockResolvedValue(new Response(JSON.stringify({ errors: { email: ["Email đã tồn tại"] } }), { status: 400 }));
    await expect(service.createOwner("b1", { displayName: "Owner", email: "owner@example.com", password: "secret123" })).rejects.toThrow("Email đã tồn tại");
  });
});
