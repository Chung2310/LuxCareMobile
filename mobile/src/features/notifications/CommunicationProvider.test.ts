import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { afterEach, expect, it, vi } from "vitest";
import * as communicationState from "./communicationState";

const ts = createRequire(import.meta.url)("typescript");
const source = ts.transpileModule(readFileSync(new URL("./CommunicationProvider.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;

function mount() {
  const hooks: any[] = [];
  let cursor = 0;
  let pending: (() => void)[] = [];
  let user: any = { uid: "me", companyCode: "A", enabledModules: ["chat"] };
  const listeners = new Map<string, Set<(event: any) => void>>();
  const rooms = [{ _id: "room", unreadCount: 2, companyCode: "A" }];
  const getRooms = vi.fn().mockResolvedValue(rooms);
  const same = (a: any[], b: any[]) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const memo = (fn: any, deps: any[]) => {
    const i = cursor++;
    if (!hooks[i] || !same(hooks[i].deps, deps)) hooks[i] = { deps, value: fn() };
    return hooks[i].value;
  };
  const react = {
    createContext: () => ({ Provider: "provider" }),
    createElement: (_type: any, props: any) => props,
    useState: (initial: any) => {
      const i = cursor++;
      hooks[i] ??= { value: initial };
      return [hooks[i].value, (next: any) => { hooks[i].value = typeof next === "function" ? next(hooks[i].value) : next; }];
    },
    useRef: (initial: any) => hooks[cursor++] ||= { current: initial },
    useMemo: memo,
    useCallback: (fn: any, deps: any[]) => memo(() => fn, deps),
    useEffect: (fn: any, deps: any[]) => {
      const i = cursor++;
      if (!hooks[i] || !same(hooks[i].deps, deps)) {
        const old = hooks[i];
        hooks[i] = { deps };
        pending.push(() => { old?.cleanup?.(); hooks[i].cleanup = fn(); });
      }
    },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, exports: module.exports, setTimeout, clearTimeout,
    require: (name: string) => {
      if (name === "react") return react;
      if (name === "react-native") return { Platform: { OS: "android" }, AppState: { currentState: "active", addEventListener: () => ({ remove() {} }) } };
      if (name === "expo-router") return { router: { push() {} }, usePathname: () => "/chat", useRootNavigationState: () => ({ key: "ready" }) };
      if (name === "./nativeNotifications") return { nativeNotifications: null };
      if (name === "./chatNotificationState") return { chatNotificationsMuted: () => false };
      if (name === "expo-secure-store") return { getItemAsync: async () => "[]", setItemAsync: async () => {} };
      if (name === "react-native-safe-area-context") return { useSafeAreaInsets: () => ({ top: 0 }) };
      if (name === "../../api/services") return { api: { getOrigin: () => "https://example.com" }, blog: { getPosts: async () => [] }, chat: { getRooms } };
      if (name === "../../api/socketService") return { socketService: { subscribe: (event: string, fn: any) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(fn);
        return () => listeners.get(event)!.delete(fn);
      } } };
      if (name === "../../auth/SessionProvider") return { useSession: () => ({ user, loading: false }) };
      if (name === "../../auth/access") return { canUseModule: (value: any) => !!value?.enabledModules.includes("chat") };
      if (name === "./communicationState") return communicationState;
      if (name === "./RealtimeNotificationToast") return { RealtimeNotificationToast: "toast" };
      if (name === "./notificationSound") return { playNotificationSound() {} };
      throw Error(name);
    },
  });
  const render = () => {
    cursor = 0;
    const value = module.exports.CommunicationProvider({ children: null }).value;
    const effects = pending; pending = [];
    effects.forEach(fn => fn());
    return value;
  };
  return { render, getRooms, rooms, setUser: (next: any) => { user = next; },
    emit: (name: string, event: any) => listeners.get(name)?.forEach(fn => fn(event)) };
}

afterEach(() => vi.useRealTimers());
it("shares one room response between the screen snapshot and unread badge", async () => {
  vi.useFakeTimers();
  const host = mount();
  expect(host.render().chatRooms).toBeNull();
  await vi.advanceTimersByTimeAsync(150);
  const value = host.render();
  expect(value.chatRooms).toBe(host.rooms);
  expect(value.chatUnread).toBe(2);
  expect(host.getRooms).toHaveBeenCalledTimes(1);
});
it("coalesces realtime bursts and keeps the previous rooms when refresh fails", async () => {
  vi.useFakeTimers();
  const host = mount();
  host.render();
  await vi.advanceTimersByTimeAsync(150);
  host.render();
  host.getRooms.mockRejectedValueOnce(Error("offline"));
  for (let i = 0; i < 3; i++) {
    host.emit("internal_messages_read", {});
    host.render();
    await vi.advanceTimersByTimeAsync(20);
  }
  await vi.advanceTimersByTimeAsync(150);
  expect(host.getRooms).toHaveBeenCalledTimes(2);
  expect(host.render().chatRooms).toBe(host.rooms);
  expect(host.render().chatUnread).toBe(2);
});
it("does not expose a previous account's rooms or a late response after logout", async () => {
  vi.useFakeTimers();
  const host = mount();
  let resolve!: (value: any) => void;
  host.getRooms.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  host.render();
  await vi.advanceTimersByTimeAsync(150);
  host.setUser(null);
  expect(host.render().chatRooms).toBeNull();
  resolve(host.rooms);
  await vi.advanceTimersByTimeAsync(1);
  expect(host.render().chatRooms).toBeNull();
  expect(host.render().chatUnread).toBe(0);
});
it("ends initial loading when fetching rooms fails", async () => {
  vi.useFakeTimers();
  const host = mount();
  host.getRooms.mockRejectedValueOnce(Error("offline"));
  host.render();
  await vi.advanceTimersByTimeAsync(150);
  expect(host.render().chatRooms).toEqual([]);
});
