import { describe, expect, it, vi } from "vitest";
import { runReviewPreflight } from "../../scripts/review-preflight.mjs";
const base = "https://review.example.test";
const setup = (change?: (path: string, response: Response) => Response) => {
  const send = vi.fn(async (input: RequestInfo | URL) => {
    const path = new URL(String(input)).pathname;
    const protectedRoute = path.includes("/ai/") || path.endsWith("/blocks");
    const body = path.endsWith("/capabilities")
      ? { registrationEnabled: true, personalAiEnabled: true }
      : { message: protectedRoute ? "Unauthorized" : "ok" };
    const response = new Response(JSON.stringify(body), {
      status: protectedRoute ? 401 : 200,
      headers: { "content-type": "application/json" },
    });
    return change ? change(path, response) : response;
  });
  return { send, log: vi.fn(), errorLog: vi.fn() };
};
describe("App Review preflight", () => {
  it("checks AI and Blog routes using GET without authentication or paid requests", async () => {
    const options = setup();
    expect(await runReviewPreflight({ base, fetchImpl: options.send, ...options })).toBe(true);
    expect(options.send.mock.calls).toHaveLength(9);
    expect(options.send.mock.calls.map(([url]) => new URL(String(url)).pathname)).toContain(
      "/api/v1/ai/consent/personal",
    );
  });
  it("fails a missing AI route even while the website is available", async () => {
    const options = setup((path, response) =>
      path === "/api/v1/ai/personal/status" ? new Response("Missing", { status: 404 }) : response,
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
  it.each(["registrationEnabled", "personalAiEnabled"])("requires %s enabled", async (key) => {
    const options = setup((path, response) =>
      path.endsWith("/capabilities")
        ? new Response(JSON.stringify({ registrationEnabled: true, personalAiEnabled: true, [key]: false }), {
            headers: { "content-type": "application/json" },
          })
        : response,
    );
    expect(await runReviewPreflight({ base, fetchImpl: options.send, ...options })).toBe(false);
  });
  it("refuses a HTTP API before making requests", async () => {
    const options = setup();
    expect(await runReviewPreflight({ base: "http://review.example.test", fetchImpl: options.send, ...options })).toBe(
      false,
    );
    expect(options.send).not.toHaveBeenCalled();
  });
});
