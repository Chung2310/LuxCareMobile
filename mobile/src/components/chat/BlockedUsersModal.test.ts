import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const source = ts.transpileModule(
  readFileSync(new URL("./BlockedUsersModal.tsx", import.meta.url), "utf8"),
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
    "FlatList",
    "Image",
    "Modal",
    "Pressable",
    "RefreshControl",
    "SafeAreaView",
    "ScrollView",
    "Text",
    "TextInput",
    "TouchableOpacity",
    "View",
  ].map((name) => [name, View]),
);

const mockChat = {
  getBlockedUsers: vi.fn().mockResolvedValue([]),
  unblockUser: vi.fn().mockResolvedValue({ message: "OK" }),
};

const module = { exports: {} as any };
vm.runInNewContext(source, {
  exports: module.exports,
  module,
  require: (name: string) => {
    if (name === "react") return React;
    if (name === "react-native") {
      return {
        ...native,
        StyleSheet: { create: (styles: any) => styles },
        Platform: { OS: "ios" },
        Alert: { alert: vi.fn() },
      };
    }
    if (name === "@expo/vector-icons") return { Ionicons: View };
    if (name === "../../api/services") {
      return {
        chat: mockChat,
      };
    }
    throw new Error("Unexpected import: " + name);
  },
});

const BlockedUsersModal = module.exports.BlockedUsersModal;

describe("BlockedUsersModal", () => {
  it("renders modal when visible is true", () => {
    const html = renderToStaticMarkup(
      React.createElement(BlockedUsersModal, {
        visible: true,
        onClose: vi.fn(),
      }),
    );

    expect(html).toContain("Danh sách chặn");
    expect(html).toContain("Chưa có ai bị chặn");
  });
});
