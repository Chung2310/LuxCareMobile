import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

// Evaluate the actual transpiled modules: native packages must never be evaluated
// in Expo Go, including while Expo Router imports the provider's route dependencies.
function evaluate(file: string, requireModule: (name: string) => unknown) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 },
  });
  const exports: Record<string, any> = {};
  runInNewContext(outputText, { exports, require: requireModule });
  return exports;
}

describe("native notification module loading", () => {
  it.each([
    ["android", true, false], ["ios", true, false], ["web", false, false],
    ["android", false, true], ["ios", false, true],
  ])("loads safely on %s with Expo Go=%s", (platform, expoGo, supported) => {
    const native = { setNotificationHandler: vi.fn() };
    const loadNative = vi.fn(() => {
      if (!supported) throw new Error("Native push must not be loaded in this runtime");
      return native;
    });
    const runtimeRequire = (name: string) => {
      if (name === "expo") return { isRunningInExpoGo: () => expoGo };
      if (name === "react-native") return { Platform: { OS: platform }, StyleSheet: { create: (s: any) => s } };
      if (name === "expo-notifications") return loadNative();
      throw new Error(`Unexpected dependency: ${name}`);
    };
    const runtime = evaluate("./nativeNotifications.ts", runtimeRequire);
    expect(runtime.nativeNotifications).toBe(supported ? native : null);
    expect(runtime.nativeNotificationsUnavailableReason !== null).toBe(expoGo && platform !== "web");

    const provider = evaluate("./NotificationProvider.tsx", name => {
      if (name === "./nativeNotifications") return runtime;
      if (name === "react") return { createContext: () => ({}) };
      if (name === "react-native" || name === "expo-notifications") return runtimeRequire(name);
      return {};
    });
    expect(provider.NotificationProvider).toBeTypeOf("function");
    expect(loadNative).toHaveBeenCalledTimes(supported ? 1 : 0);
    expect(native.setNotificationHandler).toHaveBeenCalledTimes(supported ? 1 : 0);
  });
});
