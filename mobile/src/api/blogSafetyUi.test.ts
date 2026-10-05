// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import type { ComponentType, PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BLOG_REPORT_REASONS } from "../../../shared/blog-moderation";
const require = createRequire(import.meta.url);
const React: typeof import("react") = require("react");
const { createRoot }: typeof import("react-dom/client") = require("react-dom/client");
const ts = require("typescript");
const { act } = React;
const api = { report: vi.fn(), blockAuthor: vi.fn(), blocks: vi.fn(), unblock: vi.fn() };
const Element = ({ children }: PropsWithChildren) => React.createElement("div", null, children);
const Pressable = (props: PropsWithChildren<{ onPress?: () => void; accessibilityLabel?: string; accessibilityRole?: string; disabled?: boolean }>) => React.createElement("button", { onClick: props.onPress, disabled: props.disabled, "aria-label": props.accessibilityLabel, role: props.accessibilityRole }, props.children);
function load(file: string) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  const module = { exports: {} as Record<string, ComponentType<Record<string, unknown>>> };
  vm.runInNewContext(source, { React, exports: module.exports, module, require: (name: string) => {
    if (name === "react") return React;
    if (name === "react-native") return { Pressable, Text: Element, View: Element, Modal: Element, ScrollView: Element, ActivityIndicator: Element, KeyboardAvoidingView: Element, Platform: { OS: "ios" }, StyleSheet: { create: (value: unknown) => value }, TextInput: ({ onChangeText, value }: { onChangeText: (value: string) => void; value: string }) => React.createElement("textarea", { value, onChange: (event: import("react").ChangeEvent<HTMLTextAreaElement>) => onChangeText(event.target.value) }) };
    if (name === "react-native-safe-area-context") return { SafeAreaView: Element };
    if (name === "@expo/vector-icons") return { Ionicons: () => null };
    if (name.endsWith("api/services")) return { blogModeration: api };
    if (name.endsWith("SessionProvider")) return { messageOf: (error: Error) => error.message };
    if (name.endsWith("blog-moderation")) return { BLOG_REPORT_REASONS };
    throw new Error("Unexpected import: " + name);
  } });
  return module.exports.BlogSafetyPanel;
}
const Panel = load("../features/blog/BlogSafetyPanel.tsx");
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.resetAllMocks(); api.report.mockResolvedValue({}); api.blockAuthor.mockResolvedValue({ authorId: "author" }); api.blocks.mockResolvedValue([]); api.unblock.mockResolvedValue({});
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
function button(label: string) {
  const value = Array.from(container.querySelectorAll("button")).find(item => item.textContent === label || item.getAttribute("aria-label") === label);
  if (!value) throw new Error("Missing button: " + label); return value;
}
async function mount(mode: string, props: Record<string, unknown> = {}) {
  await act(async () => root.render(React.createElement(Panel, { mode, post: { id: "post", authorName: "Author" }, onClose: vi.fn(), onBlocked: vi.fn(), onUnblocked: vi.fn(), ...props })));
}
describe("native Blog safety UI", () => {
  it("reports the selected reason only after submitting", async () => {
    await mount("report"); expect(api.report).not.toHaveBeenCalled();
    await act(async () => button("Spam / Tin rác").click());
    await act(async () => button("Gửi báo cáo").click());
    expect(api.report).toHaveBeenCalledWith("post", "spam", ""); expect(container.textContent).toContain("Đã gửi báo cáo");
  });
  it("waits for block confirmation before hiding the author", async () => {
    const onBlocked = vi.fn(); await mount("block", { onBlocked }); expect(api.blockAuthor).not.toHaveBeenCalled();
    await act(async () => button("Xác nhận chặn").click()); expect(onBlocked).toHaveBeenCalledWith("author");
  });
  it("retains the post and displays a rejected block", async () => {
    api.blockAuthor.mockRejectedValue(new Error("Không có quyền")); const onBlocked = vi.fn(); await mount("block", { onBlocked });
    await act(async () => button("Xác nhận chặn").click()); expect(onBlocked).not.toHaveBeenCalled(); expect(container.textContent).toContain("Không có quyền");
  });
  it("allows restoring an author from the blocked list", async () => {
    api.blocks.mockResolvedValue([{ authorId: "author", authorName: "Author" }]); const onUnblocked = vi.fn(); await mount("blocks", { onUnblocked });
    await act(async () => button("Bỏ chặn").click()); expect(api.unblock).toHaveBeenCalledWith("author"); expect(onUnblocked).toHaveBeenCalledWith("author");
  });
});
