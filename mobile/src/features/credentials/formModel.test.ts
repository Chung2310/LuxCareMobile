import { expect, it, vi } from "vitest";
import type { Credential } from "../../../../src/types/hrCredential";
import type { UserProfile } from "../../../../src/types/common";
import { createHrCredentialService } from "../../../../src/services/hrCredentialService";
import { credentialDraft, credentialPayload, credentialChanges } from "./formModel";
import { canManageCredentials } from "./model";
const original = {
  _id: "id",
  employeeId: "a".repeat(24),
  employeeName: "An",
  name: "Chứng chỉ",
  type: "practice_certificate",
  issuingOrganization: "Nơi cấp",
  issueDate: "2026-01-01T08:00:00.000Z",
  expiryDate: "2027-01-01T08:00:00.000Z",
  reminderDays: 30,
  fileUrl: "https://files.example/scan",
  status: "active",
} as Credential;
it("preserves timestamps and attachments when updating only a note", () => {
  const payload = credentialPayload({ ...credentialDraft(original), note: "ghi chú" }, [], original);
  expect(payload.issueDate).toBe(original.issueDate);
  expect(credentialChanges(payload, original)).toEqual({ note: "ghi chú" });
  expect(payload).not.toHaveProperty("fileUrl");
  expect(payload).not.toHaveProperty("status");
});
it("allows explicitly removing expiry and validates reminder limits and dates", () => {
  const draft = credentialDraft(original);
  expect(credentialChanges(credentialPayload({ ...draft, expiryDate: "" }, [], original), original)).toEqual({
    expiryDate: null,
  });
  for (const change of [
    { issueDate: "2026-02-30" },
    { expiryDate: "2025-12-31" },
    { reminderDays: "0" },
    { reminderDays: "366" },
    { reminderDays: "1.5" },
    { name: "x" },
    { employeeId: "b".repeat(24) },
  ])
    expect(() => credentialPayload({ ...draft, ...change }, [], original)).toThrow();
});
it("requires read and one supported manage permission", () => {
  const user = { uid: "u", companyCode: "A", enabledModules: ["hr"], permissions: ["credentials:read"] } as UserProfile;
  expect(canManageCredentials(user)).toBe(false);
  expect(canManageCredentials({ ...user, permissions: ["credentials:read", "credentials:manage"] })).toBe(true);
  expect(canManageCredentials({ ...user, permissions: ["hr:read", "hr:manage"] })).toBe(true);
  expect(canManageCredentials({ ...user, permissions: ["hr:manage"] })).toBe(false);
});
it("creates and updates through authenticated JSON requests with encoded IDs", async () => {
  const fetch = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ data: original })));
  const service = createHrCredentialService({ fetch, getAccessToken: () => "token" });
  const payload = credentialPayload(credentialDraft(original), [], original);
  expect(await service.create("A&B", payload)).toEqual(original);
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/hr-credentials?companyCode=A%26B");
  expect(fetch.mock.calls[0][1]).toMatchObject({
    method: "POST",
    headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
  });
  await service.update("A", "id/1", { expiryDate: null });
  expect(fetch.mock.calls[1][0]).toBe("/api/v1/hr-credentials/id%2F1?companyCode=A");
  expect(fetch.mock.calls[1][1]).toMatchObject({ method: "PATCH", body: '{"expiryDate":null}' });
});
