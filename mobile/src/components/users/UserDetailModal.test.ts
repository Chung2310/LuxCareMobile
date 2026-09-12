import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");
const source = ts.transpileModule(readFileSync(new URL("./UserDetailModal.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
}).outputText;
const View = ({ children }: any) => React.createElement("div", null, children);
const native = Object.fromEntries([
  "ActivityIndicator", "Image", "KeyboardAvoidingView", "Modal", "ScrollView",
  "Switch", "Text", "TextInput", "TouchableOpacity", "View",
].map(name => [name, View]));
const module = { exports: {} as any };
vm.runInNewContext(source, {
  exports: module.exports, module,
  require: (name: string) => {
    if (name === "react") return React;
    if (name === "react-native") return { ...native, StyleSheet: { create: (styles: any) => styles }, Platform: { OS: "android" }, Linking: { openURL: vi.fn() } };
    if (name === "react-native-safe-area-context") return { SafeAreaView: View };
    if (name === "lucide-react-native") return new Proxy({}, { get: () => View });
    if (name === "@expo/vector-icons") return { Ionicons: View };
    if (name === "../common/AppButton") return { AppButton: View };
    if (name === "../common/DropdownSelectField") return { DropdownSelectField: View };
    if (name === "../AppAlert") return { useAppAlert: () => ({ showAlert: vi.fn(), alertView: null }) };
    if (name === "../../auth/SessionProvider") return { useSession: () => ({ user: { uid: "actor", role: "admin" } }) };
    if (name === "../../features/roles/useRoleOptions") return { useRoleOptions: () => ({ roles: [], assignable: [], error: "" }) };
    if (name === "../../features/roles/model") return { roleTitle: (role: any) => role.role };
    if (name === "./UserCard") return { ROLE_MAP: { user: { label: "Employee", icon: "person", color: "green", bg: "white", border: "green" } } };
    throw new Error("Unexpected import: " + name);
  },
});
const UserDetailModal = module.exports.UserDetailModal;
const base = { onClose: vi.fn(), onUpdate: vi.fn(), onDelete: vi.fn(), branches: [], departments: [] };
const employee = { uid: "employee", displayName: "Employee One", email: "one@example.com", role: "user" };

describe("user detail modal rendering", () => {
  it("keeps the visibility boundary free of hooks when closed, opened, and closed again", () => {
    expect(UserDetailModal({ ...base, visible: false, user: null })).toBeNull();
    const opened = UserDetailModal({ ...base, visible: true, user: employee });
    expect(React.isValidElement(opened)).toBe(true);
    expect(opened.key).toBe(employee.uid);
    expect(UserDetailModal({ ...base, visible: false, user: employee })).toBeNull();
    expect(UserDetailModal({ ...base, visible: true, user: null })).toBeNull();
  });
  it("renders the profile and organization icons without undefined references", () => {
    const html = renderToStaticMarkup(React.createElement(UserDetailModal, { ...base, visible: true, user: employee }));
    expect(html).toContain(employee.displayName);
    expect(html).toContain(employee.email);
  });
  it("opens another employee with fresh component identity", () => {
    const another = { ...employee, uid: "second", displayName: "Employee Two" };
    const opened = UserDetailModal({ ...base, visible: true, user: another });
    expect(opened.key).toBe(another.uid);
    expect(renderToStaticMarkup(opened)).toContain(another.displayName);
  });
});
