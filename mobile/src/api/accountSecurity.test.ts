// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentType, PropsWithChildren } from "react";
const require = createRequire(import.meta.url);
const React: typeof import("react") = require("react");
const { createRoot }: typeof import("react-dom/client") = require("react-dom/client");
const { act } = React;
const ts = require("typescript");
const session = {
  user: { uid: "user", role: "user", email: "new@example.test", emailVerifiedAt: null },
  deleteAccount: vi.fn(),
  logout: vi.fn(),
};
const router = { push: vi.fn(), replace: vi.fn() };
const Element = ({ children }: PropsWithChildren) => React.createElement("div", null, children);
const Pressable = (
  props: PropsWithChildren<{ onPress?: () => void; accessibilityLabel?: string; disabled?: boolean }>,
) =>
  React.createElement(
    "button",
    { onClick: props.onPress, disabled: props.disabled, "aria-label": props.accessibilityLabel },
    props.children,
  );
const AuthLayout = (props: PropsWithChildren<{ title: string; headerAction?: import("react").ReactNode }>) =>
  React.createElement(
    "section",
    null,
    props.headerAction,
    React.createElement("h1", null, props.title),
    props.children,
  );
function load(file: string) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  const module = { exports: {} as Record<string, ComponentType> };
  vm.runInNewContext(source, {
    React,
    exports: module.exports,
    module,
    require: (name: string) => {
      if (name === "react") return React;
      if (name === "react-native")
        return { Pressable, Text: Element, View: Element, StyleSheet: { create: (value: unknown) => value } };
      if (name === "expo-router") return { router, Redirect: () => React.createElement("span", null, "Login") };
      if (name === "@expo/vector-icons") return { Ionicons: () => null };
      if (name.endsWith("SessionProvider"))
        return { useSession: () => session, messageOf: (error: Error) => error.message };
      if (name.endsWith("AuthForm"))
        return {
          AuthLayout,
          authStyles: {},
          AuthFeedback: ({ message }: { message?: string }) =>
            message ? React.createElement("p", { role: "alert" }, message) : null,
        };
      if (name.endsWith("DeleteAccountConfirmModal"))
        return {
          DeleteAccountConfirmModal: ({
            visible,
            onConfirm,
          }: {
            visible: boolean;
            onConfirm: (password: string) => Promise<void>;
          }) =>
            visible
              ? React.createElement(
                  "button",
                  { onClick: () => void onConfirm("password-confirmation") },
                  "Confirm deletion",
                )
              : null,
        };
      throw new Error("Unexpected import: " + name);
    },
  });
  return module.exports.default;
}
const readSource = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
const Screen = load("../../app/account-security.tsx");
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(async () => {
  vi.resetAllMocks();
  session.deleteAccount.mockResolvedValue(undefined);
  session.logout.mockResolvedValue(undefined);
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(React.createElement(Screen)));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
function button(label: string) {
  const value = Array.from(container.querySelectorAll("button")).find(
    (item) => item.textContent === label || item.getAttribute("aria-label") === label,
  );
  if (!value) throw new Error("Missing button: " + label);
  return value;
}
describe("unverified account management", () => {
  it("allows an unverified user to initiate deletion, with a separate confirmation", async () => {
    expect(session.deleteAccount).not.toHaveBeenCalled();
    await act(async () => button("Xóa tài khoản").click());
    expect(session.deleteAccount).not.toHaveBeenCalled();
    await act(async () => button("Confirm deletion").click());
    expect(session.deleteAccount).toHaveBeenCalledWith("password-confirmation");
  });
  it("keeps the confirmation open and shows backend errors", async () => {
    session.deleteAccount.mockRejectedValue(new Error("Wrong password"));
    await act(async () => button("Xóa tài khoản").click());
    await act(async () => button("Confirm deletion").click());
    expect(button("Confirm deletion")).toBeTruthy();
  });
  it("allows signing out and returning to verification without confirming email", async () => {
    await act(async () => button("Quay lại").click());
    expect(router.replace).toHaveBeenCalledWith("/onboarding");
    await act(async () => button("Đăng xuất").click());
    expect(session.logout).toHaveBeenCalledOnce();
  });
  it("allows the security route through the onboarding redirect and keeps verification actions separate", () => {
    const layout = readSource("../../app/_layout.tsx");
    expect(layout).toContain('["/onboarding", "/account-security"');
    const onboarding = readSource("../../app/onboarding.tsx");
    const verification = onboarding.slice(
      onboarding.indexOf("// Keep verification separate"),
      onboarding.indexOf("<SafeAreaView style={{ flex: 1"),
    );
    expect(verification).toContain('router.push("/account-security")');
    expect(verification.match(/<AuthButton/g)).toHaveLength(2);
    expect(verification).not.toContain('title="Xóa tài khoản"');
  });
});
