// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EquipmentDepartmentField } from "./EquipmentDepartmentField";

// Exercise the real ChoiceField interactions with native primitives represented in the DOM.
vi.mock("react-native", async () => {
  const { createElement, Fragment } = await import("react");
  return {
    View: ({ children }: any) => createElement("div", null, children),
    Text: ({ children }: any) => createElement("span", null, children),
    Pressable: ({ children, onPress, disabled, accessibilityRole, accessibilityState }: any) =>
      createElement("button", { onClick: onPress, disabled, role: accessibilityRole, "aria-checked": accessibilityState?.checked }, children),
    Modal: ({ children, visible }: any) => visible ? createElement("div", { role: "dialog" }, children) : null,
    TextInput: ({ onChangeText, value, placeholder }: any) => createElement("input", { value, placeholder, onChange: (event: any) => onChangeText(event.target.value) }),
    FlatList: ({ data, renderItem, ListEmptyComponent }: any) => data.length
      ? data.map((item: any) => createElement(Fragment, { key: item.value }, renderItem({ item })))
      : ListEmptyComponent,
    StyleSheet: { create: (styles: unknown) => styles },
  };
});
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: ({ children }: any) => React.createElement("div", null, children) }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));

const departments = [
  { _id: "active", name: "Khoa Khám", code: "KK", companyCode: "COMP", sortOrder: 0, isActive: true },
  { _id: "inactive", name: "Khoa Cũ", code: "KC", companyCode: "COMP", sortOrder: 1, isActive: false },
];
let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT;
});
function button(label: string) {
  const element = [...container.querySelectorAll("button")].find(item => item.textContent === label);
  expect(element, `button ${label}`).toBeDefined();
  return element!;
}
const click = async (element: HTMLButtonElement) => act(async () => element.click());

it("retains an inactive assignment, selects by ID, and allows clearing it", async () => {
  const changed = vi.fn();
  function Form() {
    const [value, setValue] = useState("inactive");
    return React.createElement(EquipmentDepartmentField, {
      value, departments, loading: false, error: null, onRetry: vi.fn(),
      onChange: id => { changed(id); setValue(id); },
    });
  }
  await act(async () => root.render(React.createElement(Form)));
  await click(button("Khoa Cũ (KC) · Ngừng hoạt động"));
  await click(button("Khoa Khám (KK)"));
  expect(changed).toHaveBeenLastCalledWith("active");
  expect(container.querySelector('[role="dialog"]')).toBeNull();

  await click(button("Khoa Khám (KK)"));
  expect(container.textContent).not.toContain("Khoa Cũ");
  await click(button("Chưa chọn phòng ban"));
  expect(changed).toHaveBeenLastCalledWith("");
  expect(button("Chưa chọn phòng ban")).toBeDefined();
});

it("keeps the saved label on a catalogue error and offers retry without changing the assignment", async () => {
  const onChange = vi.fn(), onRetry = vi.fn();
  await act(async () => root.render(React.createElement(EquipmentDepartmentField, {
    value: "saved", selectedName: "Khoa Khám", departments: [], loading: false,
    error: "Không tải được phòng ban", onRetry, onChange,
  })));
  expect(button("Khoa Khám").disabled).toBe(true);
  expect(container.textContent).toContain("Không tải được phòng ban");
  await click(button("Tải lại phòng ban"));
  expect(onRetry).toHaveBeenCalledTimes(1);
  expect(onChange).not.toHaveBeenCalled();
});

it("shows refreshed names for the same ID and blocks changes while loading or saving", async () => {
  const props = { value: "active", selectedName: "Tên cũ", departments, loading: true, error: null, onRetry: vi.fn(), onChange: vi.fn() };
  await act(async () => root.render(React.createElement(EquipmentDepartmentField, props)));
  expect(button("Khoa Khám (KK)").disabled).toBe(true);
  await act(async () => root.render(React.createElement(EquipmentDepartmentField, {
    ...props, loading: false, disabled: true, departments: [{ ...departments[0], name: "Tên mới" }],
  })));
  expect(button("Tên mới (KK)").disabled).toBe(true);
  expect(container.textContent).not.toContain("Tên cũ");
});
