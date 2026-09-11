import { describe, expect, it, vi } from "vitest";
import { MobileApi, type TokenStorage } from "./client";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
function setup(network: typeof fetch) {
  let stored: string | null = null;
  const storage: TokenStorage = {
    read: async () => stored,
    write: async (token) => {
      stored = token;
    },
    clear: async () => {
      stored = null;
    },
  };
  const api = new MobileApi("https://luxcare.example", storage, network);
  return { api, storage };
}
describe("native API sessions", () => {
  it("retains refresh credentials on a 503 during autologin", async () => {
    const { api, storage } = setup(async () => json({ code: "AUTH_TEMPORARILY_UNAVAILABLE", message: "Retry later" }, 503));
    const expired = vi.fn();
    api.onSessionExpired = expired;
    await api.setSession("access", "refresh");
    await expect(api.restore()).rejects.toMatchObject({ status: 503 });
    expect(await storage.read()).toBe("refresh");
    expect(expired).not.toHaveBeenCalled();
  });
  it("does not restore credentials read before a concurrent logout", async () => {
    let resolveRead!: (value: string) => void;
    const network = vi.fn();
    const api = new MobileApi("https://example.com", {
      read: () => new Promise(resolve => { resolveRead = resolve; }),
      write: async () => {}, clear: async () => {},
    }, network);
    const pending = api.restore();
    await api.clear();
    resolveRead("old-refresh");
    await expect(pending).rejects.toThrow("Phiên đăng nhập đã thay đổi.");
    expect(network).not.toHaveBeenCalled();
    expect(api.getAccessToken()).toBeNull();
  });
  it("explains attendance gate errors that only contain a reason code", async () => {
    const { api } = setup(async () => json({ reasonCode: "outside_radius" }, 403));
    await expect(api.transport.fetch("/api/v1/timekeeping/check-in", { method: "POST" })).rejects.toMatchObject({
      status: 403,
      code: "outside_radius",
      message: "Bạn đang ngoài khu vực chấm công của chi nhánh.",
    });
  });
  it("allows file transfer time while still timing out ordinary API requests", async () => {
    vi.useFakeTimers();
    try {
      const { api } = setup(
        async (_path, init) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("Timed out")));
          }),
      );
      const standard = api.transport.fetch("/api/v1/auth/me").catch((error) => error.message);
      let uploadSettled = false;
      const upload = api.transport.fetch("/api/v1/hr/leave-files/upload", { method: "POST" }).catch((error) => {
        uploadSettled = true;
        return error.message;
      });
      await vi.advanceTimersByTimeAsync(20000);
      expect(await standard).toBe("Timed out");
      expect(uploadSettled).toBe(false);
      await vi.advanceTimersByTimeAsync(100000);
      expect(await upload).toBe("Timed out");
    } finally {
      vi.useRealTimers();
    }
  });
  it("discards a response when the branch changes and sends the new scope on subsequent requests", async () => {
    let resolve!: (response: Response) => void;
    const network = vi
      .fn<typeof fetch>()
      .mockImplementationOnce(
        async () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      )
      .mockImplementation(async () => json({ ok: true }));
    const { api } = setup(network);
    await api.setSession("access", "refresh");
    api.setBranchId("aaaaaaaaaaaaaaaaaaaaaaaa");
    const pending = api.transport.fetch("/api/v1/hr/leave-applications");
    api.setBranchId("bbbbbbbbbbbbbbbbbbbbbbbb");
    resolve(json({ data: ["old branch"] }));
    await expect(pending).rejects.toThrow("Chi nhánh đã thay đổi");
    await api.transport.fetch("/api/v1/hr/leave-applications");
    expect(new Headers(network.mock.calls[0][1]?.headers).get("x-branch-id")).toBe("aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(new Headers(network.mock.calls[1][1]?.headers).get("x-branch-id")).toBe("bbbbbbbbbbbbbbbbbbbbbbbb");
    await api.clear();
    expect(api.getBranchId()).toBeNull();
  });
  it("does not retry a mutation under a newly selected branch after refreshing", async () => {
    let resolveRefresh!: (response: Response) => void;
    const network = vi.fn<typeof fetch>(async (path) =>
      String(path).endsWith("refresh-token")
        ? new Promise<Response>((resolve) => {
            resolveRefresh = resolve;
          })
        : json({}, 401),
    );
    const { api } = setup(network);
    await api.setSession("old", "refresh");
    api.setBranchId("aaaaaaaaaaaaaaaaaaaaaaaa");
    const pending = api.transport.fetch("/api/v1/hr/leave-applications", { method: "POST", body: "{}" });
    await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf("function"));
    api.setBranchId("bbbbbbbbbbbbbbbbbbbbbbbb");
    resolveRefresh(json({ accessToken: "fresh" }));
    await expect(pending).rejects.toThrow("Chi nhánh đã thay đổi");
    expect(network).toHaveBeenCalledTimes(2);
  });
  it("handles a malformed API error body without crashing the error parser", async () => {
    const { api } = setup(async () => json(null, 500));
    await expect(api.transport.fetch("/api/v1/auth/me")).rejects.toMatchObject({
      status: 500,
      code: "UNKNOWN_API_ERROR",
    });
  });
  it("shares one refresh across concurrent requests, retries with the fresh token", async () => {
    let refreshes = 0;
    const network = vi.fn<typeof fetch>(async (url, init) => {
      if (String(url).endsWith("refresh-token")) {
        refreshes++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        expect(JSON.parse(String(init?.body))).toEqual({ refreshToken: "refresh" });
        return json({ accessToken: "fresh" });
      }
      return new Headers(init?.headers).get("Authorization") === "Bearer fresh"
        ? json({ ok: true })
        : json({ message: "expired" }, 401);
    });
    const { api } = setup(network);
    await api.setSession("old", "refresh");
    await Promise.all([api.transport.fetch("/api/v1/auth/me"), api.transport.fetch("/api/v1/notifications")]);
    expect(refreshes).toBe(1);
    expect(network).toHaveBeenCalledTimes(5);
  });
  it("settles all pending requests and clears storage when refresh is rejected", async () => {
    const { api, storage } = setup(async () => json({ message: "expired" }, 401));
    await api.setSession("old", "refresh");
    const results = await Promise.allSettled([
      api.transport.fetch("/api/v1/auth/me"),
      api.transport.fetch("/api/v1/notifications"),
    ]);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect(await storage.read()).toBeNull();
  });
  it("does not refresh a replaced session", async () => {
    const network = vi.fn<typeof fetch>(async () => json({ code: "SESSION_REPLACED", message: "Replaced" }, 401));
    const { api, storage } = setup(network);
    await api.setSession("old", "refresh");
    await expect(api.transport.fetch("/api/v1/auth/me")).rejects.toMatchObject({ code: "SESSION_REPLACED" });
    expect(network).toHaveBeenCalledTimes(1);
    expect(await storage.read()).toBeNull();
  });
  it("retains refresh credentials during a temporary network outage", async () => {
    const { api, storage } = setup(async () => {
      throw new TypeError("Network unavailable");
    });
    await api.setSession("old", "refresh");
    await expect(api.restore()).rejects.toThrow("Network unavailable");
    expect(await storage.read()).toBe("refresh");
  });
  it("cannot revive a session after logout while a refresh is in flight", async () => {
    let resolveRefresh!: (value: Response) => void;
    const { api, storage } = setup(
      async () =>
        new Promise<Response>((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    await api.setSession("old", "refresh");
    const restore = api.restore();
    await vi.waitFor(() => expect(resolveRefresh).toBeTypeOf("function"));
    await api.clear();
    resolveRefresh(json({ accessToken: "late" }));
    await expect(restore).rejects.toThrow("Phiên đăng nhập đã thay đổi");
    expect(api.transport.getAccessToken()).toBeNull();
    expect(await storage.read()).toBeNull();
  });
  it("does not attach tokens to an external URL", async () => {
    const network = vi.fn<typeof fetch>();
    const { api } = setup(network);
    await api.setSession("secret", "refresh");
    await expect(api.transport.fetch("https://other.example/")).rejects.toThrow("Chỉ cho phép");
    expect(network).not.toHaveBeenCalled();
  });
  it("does not retry permission failures", async () => {
    const network = vi.fn<typeof fetch>(async () => json({ message: "Denied" }, 403));
    const { api } = setup(network);
    await api.setSession("old", "refresh");
    await expect(api.transport.fetch("/api/v1/departments")).rejects.toMatchObject({ status: 403 });
    expect(network).toHaveBeenCalledTimes(1);
  });
  it("does not accept a Super Admin challenge as a logged-in session", async () => {
    const { api, storage } = setup(async () => json({ status: "challenge_required", challengeId: "challenge" }, 202));
    await expect(api.login("admin@example.com", "password")).rejects.toThrow("xác thực Super Admin");
    expect(await storage.read()).toBeNull();
  });
  it("requests native token delivery and stores only the refresh token", async () => {
    const network = vi.fn<typeof fetch>(async (_url, init) => {
      expect(new Headers(init?.headers).get("x-luxcare-client")).toBe("native");
      expect(init?.credentials).toBe("omit");
      return json({ accessToken: "access", refreshToken: "refresh" });
    });
    const { api, storage } = setup(network);
    await api.login("staff@example.com", "password");
    expect(await storage.read()).toBe("refresh");
    expect(api.transport.getAccessToken()).toBe("access");
  });
  it("clears local tokens when logout cannot reach the server", async () => {
    const { api, storage } = setup(async () => {
      throw new Error("Offline");
    });
    await api.setSession("access", "refresh");
    await expect(api.logout()).rejects.toThrow("Offline");
    expect(await storage.read()).toBeNull();
    expect(api.transport.getAccessToken()).toBeNull();
  });
});
