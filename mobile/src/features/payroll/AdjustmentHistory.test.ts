import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { expect, it, vi } from "vitest";
import * as adjustmentModel from "./adjustmentModel";
import type { PayrollAdjustment } from "../../../../src/types/payrollAdjustment";

const ts = createRequire(import.meta.url)("typescript");
const source = ts.transpileModule(readFileSync(new URL("./AdjustmentHistory.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const pending: PayrollAdjustment = { _id: "a", periodKey: "2026-09", employeeId: "e", employeeName: "An", kind: "bonus", amount: 500000, reason: "Thưởng", status: "pending" };

// Execute the component's callbacks and focus reloads without native rendering.
function mount() {
  let cursor = 0;
  const slots: any[] = [];
  let effects: (() => void)[] = [];
  let records = [pending];
  const getAdjustments = vi.fn(async () => records);
  const onChanged = vi.fn();
  const jsx = (type: any, props: any) => ({ type, props: props || {} });
  const react = {
    useState(initial: any) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next: any) => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }];
    },
    useRef(initial: any) { const index = cursor++; return slots[index] ||= { current: initial }; },
    useCallback(fn: any, deps: any[]) {
      const index = cursor++;
      if (!slots[index] || deps.some((value, i) => value !== slots[index].deps[i])) slots[index] = { fn, deps };
      return slots[index].fn;
    },
  };
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, exports: module.exports, require(name: string) {
    if (name === "react") return react;
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (name === "expo-router") return { useFocusEffect(fn: any) {
      const index = cursor++;
      if (slots[index]?.fn !== fn) {
        slots[index]?.cleanup?.();
        const entry = { fn, cleanup: undefined as any }; slots[index] = entry;
        effects.push(() => { entry.cleanup = fn(); });
      }
    } };
    if (name === "../../api/services") return { payroll: { getAdjustments } };
    if (name === "../../auth/SessionProvider") return { useSession: () => ({ user: { uid: "u", companyCode: "c", branchId: "b" } }), messageOf: (err: Error) => err.message };
    if (name === "../../auth/access") return { hasPermission: () => true };
    if (name === "./runModel") return { canReadPayrollRuns: () => true };
    if (name === "./adjustmentModel") return { ...adjustmentModel, canDecideAdjustment: (_: unknown, item: PayrollAdjustment) => item.status === "pending" };
    if (name === "./model") return { payslipMoney: (value: number) => String(value) };
    if (name === "../contracts/model") return { contractDate: (value: string) => value };
    if (name === "react-native") return { Platform: { OS: "ios" }, ...Object.fromEntries(["Modal", "View", "Text", "TextInput", "Pressable", "KeyboardAvoidingView"].map(key => [key, key])) };
    return new Proxy({}, { get: (_, key) => key === "styles" || key === "adjustmentStyles" ? {} : String(key) });
  } });
  const render = () => {
    cursor = 0;
    const tree = module.exports.AdjustmentHistory({ period: pending.periodKey, initialStatus: "pending", onChanged });
    const queued = effects; effects = []; queued.forEach(fn => fn());
    return tree;
  };
  const settle = async () => { render(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); return render(); };
  return { render, settle, getAdjustments, onChanged, records: (value: PayrollAdjustment[]) => { records = value; } };
}
function nodes(tree: any): any[] {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function find(tree: any, type: string, predicate: (props: any) => boolean = () => true) {
  const node = nodes(tree).find(node => node.type === type && predicate(node.props));
  if (!node) throw new Error("Missing " + type);
  return node.props;
}
function text(tree: any): string {
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  if (tree && typeof tree === "object") return text(tree.props?.children);
  return tree == null || typeof tree === "boolean" ? "" : String(tree);
}

it.each(["approved", "rejected"] as const)("keeps the list open and shows %s after saving and reloading", async (status) => {
  const host = mount();
  let tree = await host.settle();
  find(tree, "AdjustmentAction", p => p.title === "Duyệt điều chỉnh").onPress();
  const saved = { ...pending, status };
  host.records([saved]);
  find(host.render(), "AdjustmentDecision").onSaved(saved);
  tree = await host.settle();
  expect(find(tree, "Modal").visible).toBe(false);
  expect(host.onChanged).toHaveBeenCalledOnce();
  expect(host.getAdjustments).toHaveBeenCalledTimes(2);
  expect(text(find(tree, "Pressable", p => p.accessibilityRole === "tab" && p.accessibilityState.selected).children)).toContain(status === "approved" ? "Đã duyệt" : "Từ chối");
  expect(nodes(tree).filter(node => node.type === "Card")).toHaveLength(1);
  expect(text(tree)).toContain("An");
  expect(nodes(tree).some(node => node.type === "AdjustmentAction" && node.props.title === "Duyệt điều chỉnh")).toBe(false);
});
it("clears search and kind filters so a newly created item is visible", async () => {
  const host = mount();
  let tree = await host.settle();
  find(tree, "TextInput").onChangeText("does not match");
  find(tree, "ChoiceField").onChange("deduction");
  find(tree, "AdjustmentAction", p => p.title === "+ Thêm điều chỉnh").onPress();
  const created = { ...pending, _id: "new" };
  host.records([pending, created]);
  find(host.render(), "AdjustmentForm").onSaved(created);
  tree = await host.settle();
  expect(find(tree, "TextInput").value).toBe("");
  expect(find(tree, "ChoiceField").value).toBe("");
  expect(nodes(tree).filter(node => node.type === "Card")).toHaveLength(2);
});
it("keeps the selected status when reloading or cancelling a form", async () => {
  const host = mount();
  let tree = await host.settle();
  find(tree, "Pressable", p => p.accessibilityRole === "tab" && text(p.children).includes("Đã duyệt")).onPress();
  find(tree, "AdjustmentAction", p => p.title === "+ Thêm điều chỉnh").onPress();
  find(host.render(), "AdjustmentForm").onClose();
  tree = await host.settle();
  expect(text(find(tree, "Pressable", p => p.accessibilityRole === "tab" && p.accessibilityState.selected).children)).toContain("Đã duyệt");
  expect(find(tree, "Modal").visible).toBe(false);
});
