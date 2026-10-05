import { describe, expect, it, vi } from "vitest";
import { createOnboardingService } from "../../../src/services/onboardingService";
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
function setup(data: unknown = {}, status = 200) {
  const fetch = vi.fn(async (_path: string, _init: RequestInit) => json({ status: "success", data }, status));
  const service = createOnboardingService({
    fetch: fetch as typeof globalThis.fetch,
    getAccessToken: () => "native-token",
  });
  return { fetch, service };
}
describe("onboarding contract on native transport", () => {
  it("uses public basic signup with explicit consent and no company/role fields", async () => {
    const { fetch, service } = setup();
    await service.register("person@example.com", "password123", "Person");
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/auth/register");
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({
      email: "person@example.com",
      password: "password123",
      displayName: "Person",
      termsAccepted: true,
    });
  });
  it("preserves revision when sending requested corrections", async () => {
    const { fetch, service } = setup();
    const input = {
      companyName: "Company",
      address: "Hanoi",
      phone: "0987654321",
      businessType: "general" as const,
      purpose: "Company use",
    };
    await service.submit(input, { _id: "app-id", revision: 3 } as any);
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/onboarding/applications/app-id");
    expect(fetch.mock.calls[0][1].method).toBe("PATCH");
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toMatchObject({ revision: 3 });
  });
  it("does not grant roles in the invitation acceptance request", async () => {
    const { fetch, service } = setup();
    await service.answerInvite("invitation-id", true);
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({ accept: true });
    expect(new Headers(fetch.mock.calls[0][1].headers).get("Authorization")).toBe("Bearer native-token");
  });
  it("returns business errors without hiding them behind a login failure", async () => {
    const fetch = vi.fn(async () =>
      json({ ok: false, error: { code: "EMAIL_CODE_INVALID", message: "Mã không hợp lệ.", requestId: "req-1" } }, 400),
    );
    const service = createOnboardingService({
      fetch: fetch as typeof globalThis.fetch,
      getAccessToken: () => "native-token",
    });
    await expect(service.verifyEmail("000000")).rejects.toMatchObject({
      code: "EMAIL_CODE_INVALID",
      message: "Mã không hợp lệ.",
    });
  });
});
