import { describe, expect, it, vi } from "vitest";
import { createAiSharingService } from "../../../src/services/aiSharingService";
import type { ServiceTransport } from "../../../src/services/serviceTransport";
const setup = (body: unknown, status = 200) => {
  const send = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
  return { send, service: createAiSharingService({ fetch: send as typeof fetch, getAccessToken: () => "account-token" } as ServiceTransport) };
};
describe("AI sharing API", () => {
  it("reads disclosure without sending user content or granting permission", async () => {
    const { service, send } = setup({ status: "success", data: { accepted: false } });
    expect(await service.status("personal")).toEqual({ accepted: false });
    expect(send.mock.calls[0][0]).toBe("/api/v1/ai/consent/personal");
    const init = send.mock.calls[0][1];
    if (!init) throw new Error("Expected a request init");
    expect(init.method).toBe("GET"); expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer account-token");
  });
  it("sends explicit acceptance for the currently displayed disclosure and scope", async () => {
    const { service, send } = setup({ status: "success", data: { accepted: true } });
    await service.accept("company", "disclosure-key");
    expect(send.mock.calls[0][0]).toBe("/api/v1/ai/consent/company");
    expect(JSON.parse(send.mock.calls[0][1]?.body as string)).toEqual({ accepted: true, disclosureKey: "disclosure-key" });
  });
  it("revokes consent without sending a prompt or using an outdated disclosure key", async () => {
    const { service, send } = setup({ status: "success", data: { accepted: false } });
    await service.revoke("personal");
    expect(JSON.parse(send.mock.calls[0][1]?.body as string)).toEqual({ accepted: false });
  });
  it("preserves changed-permission codes so the UI can ask again", async () => {
    const { service } = setup({ code: "AI_DISCLOSURE_CHANGED", message: "Read again" }, 409);
    await expect(service.accept("company", "old-key")).rejects.toMatchObject({ code: "AI_DISCLOSURE_CHANGED", status: 409 });
  });
});
