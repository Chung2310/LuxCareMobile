import { describe, expect, it, vi } from "vitest";
import { runReviewPreflight } from "../../scripts/review-preflight.mjs";
const base = "https://review.example.test";
const capabilities = { registrationEnabled: true, companyWalletEnabled: false, aiQuotaEnabled: true };
const setup = (change?: (path: string, response: Response) => Response) => {
  const send = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const path = new URL(String(input)).pathname;
    const protectedRoute = path.includes("/ai/") || path.endsWith("/blocks");
    const creditRoute = path.includes("/wallet/") || path.includes("/company-wallet/");
    const body = path.endsWith("/capabilities")
      ? capabilities
      : creditRoute ? { code: "FEATURE_DISABLED" } : { message: protectedRoute ? "Unauthorized" : "ok" };
    const response = new Response(JSON.stringify(body), {
      status: creditRoute ? 410 : protectedRoute ? 401 : 200,
      headers: { "content-type": "application/json" },
    });
    return change ? change(path, response) : response;
  });
  return { send, log: vi.fn(), errorLog: vi.fn() };
};
describe("App Review preflight", () => {
  it("checks public, protected and disabled routes with anonymous GET requests only", async () => {
    const options = setup();
    expect(await runReviewPreflight({ base, fetchImpl: options.send, ...options })).toBe(true);
    expect(options.send.mock.calls).toHaveLength(10);
    const paths = options.send.mock.calls.map(([url]) => new URL(String(url)).pathname);
    expect(paths).toContain("/api/v1/ai/consent/company");
    expect(paths).toContain("/api/v1/ai/status");
    expect(paths).toContain("/api/v1/wallet/balance");
    expect(paths).toContain("/api/v1/company-wallet/status");
    for (const [, init] of options.send.mock.calls) {
      expect(init?.method).toBe("GET");
      expect(new Headers(init?.headers).has("authorization")).toBe(false);
      expect(init?.body).toBeUndefined();
    }
  });
  it.each(["/api/v1/ai/consent/company", "/api/v1/ai/status"])("fails a missing protected route %s", async (route) => {
    const options = setup((path, response) =>
      path === route ? new Response("Missing", { status: 404 }) : response,
    );
    expect(await runReviewPreflight({ base, fetchImpl: options.send, ...options })).toBe(false);
    expect(options.errorLog).toHaveBeenCalledWith(expect.stringContaining("expected 401"));
  });
  it("fails when the proxy returns the SPA instead of the API", async () => {
    const options = setup((path, response) =>
      path.includes("/ai/")
        ? new Response("<html></html>", { status: 401, headers: { "content-type": "text/html" } })
        : response,
    );
    expect(await runReviewPreflight({ base, fetchImpl: options.send, ...options })).toBe(false);
  });
  it.each([
    ["registrationEnabled", false],
    ["companyWalletEnabled", true],
    ["companyWalletEnabled", undefined],
    ["aiQuotaEnabled", false],
    ["aiQuotaEnabled", undefined],
  ])("rejects incomplete or unsafe capability %s=%s", async (key, value) => {
    const options = setup((path, response) =>
      path.endsWith("/capabilities")
        ? new Response(JSON.stringify({ ...capabilities, [key]: value }), {
            headers: { "content-type": "application/json" },
          })
        : response,
    );
    expect(await runReviewPreflight({ base, fetchImpl: options.send, ...options })).toBe(false);
  });
  it.each(["/api/v1/wallet/balance", "/api/v1/company-wallet/status"])("rejects Credit route %s still accessible", async (route) => {
    const options = setup((path, response) => path === route
      ? new Response(JSON.stringify({ message: "Unauthorized" }), {
          status: 401, headers: { "content-type": "application/json" },
        }) : response);
    expect(await runReviewPreflight({ base, fetchImpl: options.send, ...options })).toBe(false);
    expect(options.errorLog).toHaveBeenCalledWith(expect.stringContaining("expected 410"));
  });
  it("requires FEATURE_DISABLED rather than an unrelated 410 response", async () => {
    const options = setup((path, response) => path === "/api/v1/wallet/balance"
      ? new Response(JSON.stringify({ code: "OTHER_ERROR" }), {
          status: 410, headers: { "content-type": "application/json" },
        }) : response);
    expect(await runReviewPreflight({ base, fetchImpl: options.send, ...options })).toBe(false);
  });
  it("refuses a HTTP API before making requests", async () => {
    const options = setup();
    expect(await runReviewPreflight({ base: "http://review.example.test", fetchImpl: options.send, ...options })).toBe(false);
    expect(options.send).not.toHaveBeenCalled();
  });
});
