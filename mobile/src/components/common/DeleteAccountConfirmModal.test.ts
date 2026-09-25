import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const source = ts.transpileModule(
  readFileSync(new URL("./DeleteAccountConfirmModal.tsx", import.meta.url), "utf8"),
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
    "TextInput",
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

const DeleteAccountConfirmModal = module.exports.DeleteAccountConfirmModal;

describe("DeleteAccountConfirmModal", () => {
  it("renders empty when visible is false", () => {
    const html = renderToStaticMarkup(
      React.createElement(DeleteAccountConfirmModal, {
        visible: false,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        user: null,
      }),
    );
    expect(html).toBe("");
  });

  it("renders modal content correctly when visible is true", () => {
    const html = renderToStaticMarkup(
      React.createElement(DeleteAccountConfirmModal, {
        visible: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        user: {
          displayName: "Nguyễn Văn B",
          email: "nguyenvanb@luxcare.vn",
          role: "user",
        },
      }),
    );

    expect(html).toContain("Xác nhận xóa tài khoản");
    expect(html).toContain("Nguyễn Văn B");
    expect(html).toContain("nguyenvanb@luxcare.vn");
    expect(html).toContain("Nhập mật khẩu để xác nhận");
    expect(html).toContain("Ở lại");
    expect(html).toContain("Xóa tài khoản");
  });

  it("renders error message when errorMessage prop is provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(DeleteAccountConfirmModal, {
        visible: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        user: {
          displayName: "Nguyễn Văn B",
          email: "nguyenvanb@luxcare.vn",
        },
        errorMessage: "Mật khẩu xác nhận không chính xác",
      }),
    );

    expect(html).toContain("Mật khẩu xác nhận không chính xác");
  });

  it("shows activity indicator when busy is true", () => {
    const html = renderToStaticMarkup(
      React.createElement(DeleteAccountConfirmModal, {
        visible: true,
        onClose: vi.fn(),
        onConfirm: vi.fn(),
        user: {
          displayName: "Test User",
        },
        busy: true,
      }),
    );

    expect(html).toContain("Xác nhận xóa tài khoản");
  });
});
