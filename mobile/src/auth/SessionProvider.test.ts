import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = ts.transpileModule(readFileSync(new URL("./SessionProvider.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;

// Execute the actual provider with a small hook host; no native runtime or copied auth logic.
function mount(restore: (api: any) => Promise<boolean>, getMe = vi.fn().mockResolvedValue({ uid: "user" })) {
  const values: any[] = [];
  const refs: any[] = [];
  const effects: (() => void)[] = [];
  let stateIndex = 0, refIndex = 0, initial = true;
  const api: any = {
    restore: () => restore(api), getOrigin: () => "https://example.com", getAccessToken: () => "access",
    clear: vi.fn().mockResolvedValue(undefined), setBranchId: vi.fn(), logout: vi.fn().mockResolvedValue(undefined),
  };
  const socket = { configure: vi.fn(), connect: vi.fn(), disconnect: vi.fn() };
  const react = {
    createContext: () => ({ Provider: "provider" }),
    createElement: (_type: any, props: any) => props,
    useContext: () => null,
    useState: (value: any) => {
      const index = stateIndex++;
      if (!(index in values)) values[index] = value;
      return [values[index], (next: any) => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
    },
    useRef: (value: any) => refs[refIndex++] ||= { current: value },
    useEffect: (effect: () => void) => { if (initial) effects.push(effect); },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(source, { exports: module.exports, module, Error, require: (name: string) => {
    if (name === "react") return react;
    if (name === "react-native") return { AppState: { addEventListener: () => ({ remove() {} }) } };
    if (name === "../api/services") return { api, getMe, configurationError: null };
    if (name === "../api/socketService") return { socketService: socket };
    throw new Error(name);
  } });
  const render = () => {
    stateIndex = refIndex = 0;
    const result = module.exports.SessionProvider({ children: null }).value;
    initial = false;
    return result;
  };
  render();
  effects.forEach(effect => effect());
  return { api, render, getMe, socket };
}

describe("autologin state and login fallback", () => {
  it("opens login without a global error when no stored session exists", async () => {
    const host = mount(async () => false);
    await vi.waitFor(() => expect(host.render().loading).toBe(false));
    expect(host.render()).toMatchObject({ user: null, error: null });
    expect(host.getMe).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403])("does not mask login with the rejected refresh error (%s)", async status => {
    const host = mount(async api => {
      api.onSessionExpired();
      throw Object.assign(new Error("Expired"), { status });
    });
    await vi.waitFor(() => expect(host.render().loading).toBe(false));
    await Promise.resolve();
    expect(host.render()).toMatchObject({ user: null, error: null });
  });
  it("restores a valid session", async () => {
    const host = mount(async () => true);
    await vi.waitFor(() => expect(host.render().user?.uid).toBe("user"));
    expect(host.render()).toMatchObject({ loading: false, error: null });
  });
  it("keeps temporary errors retryable without deleting credentials", async () => {
    let offline = true;
    const host = mount(async () => { if (offline) throw new Error("Network unavailable"); return true; });
    await vi.waitFor(() => expect(host.render().error).toBe("Network unavailable"));
    expect(host.api.clear).not.toHaveBeenCalled();
    offline = false;
    await host.render().retry();
    expect(host.render()).toMatchObject({ user: { uid: "user" }, error: null, loading: false });
  });
  it("does not revive a replaced session when a profile request resolves late", async () => {
    let resolve!: (value: any) => void;
    const profile = vi.fn(() => new Promise(done => { resolve = done; }));
    const host = mount(async () => true, profile);
    await vi.waitFor(() => expect(profile).toHaveBeenCalled());
    host.socket.configure.mock.calls[0][0].onSessionReplaced();
    resolve({ uid: "old-user" });
    await Promise.resolve();
    expect(host.render()).toMatchObject({ user: null, error: null, loading: false });
  });
  it("returns to login if /me rejects the restored session", async () => {
    let host: ReturnType<typeof mount>;
    const profile = vi.fn(async () => { host.api.onSessionExpired(); throw new Error("Invalid session"); });
    host = mount(async () => true, profile);
    await vi.waitFor(() => expect(profile).toHaveBeenCalled());
    expect(host.render()).toMatchObject({ user: null, error: null, loading: false });
  });
});
