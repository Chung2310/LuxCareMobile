import { expect, it, vi } from "vitest";
import type { BranchRecord } from "../../../../src/services/branchService";
import { completeBranchCreation } from "./creation";
import { branchDraft } from "./model";
const branch = { _id: "pending", companyCode: "LUX", code: "LUX_NEW", name: "New", isActive: true } as BranchRecord;
const draft = { ...branchDraft(), name: "New" };
const owner = { displayName: "Owner", email: "owner@example.com", password: "secret123" };
it("retries owner creation without creating a duplicate branch", async () => {
  const service = {
    create: vi.fn().mockResolvedValue(branch),
    createOwner: vi.fn().mockRejectedValueOnce(Error("Email đã tồn tại")).mockResolvedValue({ branch: { ...branch, managerId: "owner" }, owner: { _id: "owner" } }),
  };
  let pending: BranchRecord | null = null;
  const remember = (value: BranchRecord) => { pending = value; };
  await expect(completeBranchCreation(service, draft, owner, "LUX", pending, remember)).rejects.toThrow("Email đã tồn tại");
  expect(pending).toEqual(branch);
  const result = await completeBranchCreation(service, draft, { ...owner, email: "new@example.com" }, "LUX", pending, remember);
  expect(result.managerId).toBe("owner");
  expect(service.create).toHaveBeenCalledTimes(1);
  expect(service.createOwner).toHaveBeenLastCalledWith(branch._id, expect.objectContaining({ email: "new@example.com" }));
});
it("validates both forms before creating anything", async () => {
  const service = { create: vi.fn(), createOwner: vi.fn() };
  await expect(completeBranchCreation(service, draft, { ...owner, password: "" }, "LUX", null, vi.fn())).rejects.toThrow();
  await expect(completeBranchCreation(service, { ...draft, name: "" }, owner, "LUX", null, vi.fn())).rejects.toThrow();
  expect(service.create).not.toHaveBeenCalled();
  expect(service.createOwner).not.toHaveBeenCalled();
});
it("does not attempt owner creation if branch creation fails", async () => {
  const service = { create: vi.fn().mockRejectedValue(Error("Mã chi nhánh đã tồn tại")), createOwner: vi.fn() };
  const remember = vi.fn();
  await expect(completeBranchCreation(service, draft, owner, "LUX", null, remember)).rejects.toThrow("Mã chi nhánh đã tồn tại");
  expect(remember).not.toHaveBeenCalled();
  expect(service.createOwner).not.toHaveBeenCalled();
});
