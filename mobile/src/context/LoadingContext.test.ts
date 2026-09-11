import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { afterEach, expect, it, vi } from "vitest";

const ts = createRequire(import.meta.url)("typescript");
const source = ts.transpileModule(readFileSync(new URL("./LoadingContext.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;

function mount() {
  let state: any;
  const refs: any[] = [];
  let index = 0;
  const cleanups: (() => void)[] = [];
  const router = { push: vi.fn(), replace: vi.fn() };
  const react = {
    createContext: () => ({ Provider: "provider" }),
    createElement: (type: any, props: any, ...children: any[]) => ({ type, props, children }),
    useState: (initial: any) => {
      state ??= initial;
      return [state, (next: any) => { state = typeof next === "function" ? next(state) : next; }];
    },
    useRef: (initial: any) => refs[index++] ||= { current: initial },
    useCallback: (fn: any) => fn,
    useMemo: (fn: any) => fn(),
    useEffect: (fn: any) => { cleanups.push(fn()); },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, exports: module.exports, setTimeout, clearTimeout,
    require: (name: string) => {
      if (name === "react") return react;
      if (name === "expo-router") return { router };
      if (name === "../components/common/LoadingScreen") return { NavigationLoadingOverlay: "overlay" };
      throw Error(name);
    },
  });
  const render = () => { index = 0; return module.exports.LoadingProvider({ children: null }); };
  return { render, router, unmount: () => cleanups.forEach(fn => fn?.()) };
}

afterEach(() => vi.useRealTimers());
it("navigates without an artificial timer or blocking overlay", () => {
  vi.useFakeTimers();
  const host = mount();
  host.render().props.value.navigateWithLoading("/blog", { title: "Blog" });
  expect(host.router.push).toHaveBeenCalledWith("/blog");
  expect(host.render().children[1].props.visible).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});
it("retains explicitly requested loading and cleans up its timer", () => {
  vi.useFakeTimers();
  const host = mount();
  host.render().props.value.navigateWithLoading("/chat", { durationMs: 100 });
  expect(host.render().children[1].props.visible).toBe(true);
  vi.advanceTimersByTime(100);
  expect(host.render().children[1].props.visible).toBe(false);
  host.render().props.value.navigateWithLoading("/chat", { durationMs: 100 });
  host.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
it("clears an existing overlay and retains the router fallback", () => {
  const host = mount();
  host.render().props.value.showLoading();
  host.router.push.mockImplementationOnce(() => { throw Error("push failed"); });
  host.render().props.value.navigateWithLoading("/blog");
  expect(host.router.replace).toHaveBeenCalledWith("/blog");
  expect(host.render().children[1].props.visible).toBe(false);
});
