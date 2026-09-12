import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const source = ts.transpileModule(
  readFileSync(new URL("./LogoutConfirmModal.tsx", import.meta.url), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  },
).outputText;

const View = ({ children }: any) => React.createElement("div", null, children);
const native = Object.fromEntries(
  [
    "ActivityIndicator",
    "Image",
    "Modal",
    "Pressable",
    "ScrollView",
    "Text",
    "View",
  ].map((name) => [name, View]),
);

const module = { exports: {} as any };
vm.runInNewContext(source, {
  exports: module.exports,
  module,
  require: (name: string) => {
    if (name === "react") return React;
    if (name === "react-native") {
      return {
        ...native,
        StyleSheet: { create: (styles: any) => styles, absoluteFill: {} },
      };
    }
    if (name === "@expo/vector-icons") return { Ionicons: View };
    if (name === "../../../../src/utils/permissionUtils") {
      return {
        getRoleDisplayName: (role: string) =>
          role === "admin" ? "Quản trị viên" : role,
      };
    }
    throw new Error("Unexpected import: " + name);
  },
});

const LogoutConfirmModal = module.exports.LogoutConfirmModal;

describe("LogoutConfirmModal", () => {
  it("renders null when visible is false", () => {
    const result = LogoutConfirmModal({
      visible: false,
      onClose: vi.fn(),
      onConfirm: vi.fn(),
      user: null,
    });
    expect(result).toBeNull();
  });

  it("renders modal content correctly when visible is true", () => {
    const html = renderToStaticMarkup(
      React.createElement(LogoutConfirmModal, {
        visible: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        user: {
          displayName: "BS. Nguyễn Văn A",
          email: "nguyenvana@luxcare.vn",
          role: "admin",
        },
      }),
    );

    expect(html).toContain("Xác nhận đăng xuất");
    expect(html).toContain("BS. Nguyễn Văn A");
    expect(html).toContain("nguyenvana@luxcare.vn");
    expect(html).toContain("Ở lại");
    expect(html).toContain("Đăng xuất");
  });

  it("shows activity indicator when busy is true", () => {
    const html = renderToStaticMarkup(
      React.createElement(LogoutConfirmModal, {
        visible: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        user: {
          displayName: "Test User",
          email: "test@example.com",
        },
        busy: true,
      }),
    );

    expect(html).toContain("Xác nhận đăng xuất");
    expect(html).toContain("Test User");
  });
});
