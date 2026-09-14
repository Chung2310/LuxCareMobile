import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { expect, it, vi } from "vitest";
import * as formModel from "./payrollPolicyForm";
import * as formulaModel from "./formulaModel";
const ts = createRequire(import.meta.url)("typescript");
function mount(failure?: { status?: number; code?: string }) {
  const initial = { ...formModel.payrollPolicyFormToDefinition({ ...formModel.createDefaultPayrollPolicyForm(), code: "policy", name: "Công thức", effectiveFrom: "2026-01-01" }), _id: "p", companyCode: "C", status: "active" as const, version: 4 };
  const saved = { ...initial, version: 5 };
  const updatePolicy = vi.fn().mockResolvedValue(saved);
  if (failure) updatePolicy.mockRejectedValueOnce(Object.assign(Error("Không lưu được"), failure));
  const onSaved = vi.fn(), setLocked = vi.fn();
  const slots: any[] = []; let cursor = 0;
  const module = { exports: {} as any };
  const jsx = (type: any, props: any) => ({ type, props });
  const source = ts.transpileModule(readFileSync(new URL("./PayrollFormulaEditor.tsx", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require(name: string) {
    if (name === "react") return {
      useState(value: any) { const i = cursor++; if (!(i in slots)) slots[i] = typeof value === "function" ? value() : value; return [slots[i], (next: any) => { slots[i] = typeof next === "function" ? next(slots[i]) : next; }]; },
      useRef(value: any) { const i = cursor++; return slots[i] ||= { current: value }; },
      useEffect(fn: any) { const i = cursor++; if (!slots[i]) { slots[i] = true; fn(); } },
    };
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "Fragment" };
    if (name === "./payrollPolicyForm") return formModel;
    if (name === "./formulaModel") return formulaModel;
    if (name === "../../api/services") return { payroll: { updatePolicy } };
    if (name === "../../auth/SessionProvider") return { messageOf: (err: Error) => err.message, useSession: () => ({ user: { uid: "u", companyCode: "C", enabledModules: ["hr"], permissions: ["payroll-policy:read", "payroll-policy:manage"] } }) };
    return new Proxy({}, { get: (_, key) => key === "styles" || key === "adjustmentStyles" ? {} : String(key) });
  } });
  const render = () => { cursor = 0; return module.exports.PayrollFormulaEditor({ initial, mode: "edit", existing: [initial], onSaved, onClose: vi.fn(), setLocked }); };
  const nodes = (tree: any): any[] => !tree || typeof tree !== "object" ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
  const button = (title: string) => nodes(render()).find(node => node.props?.title === title);
  const press = (title: string) => { const node = button(title); if (!node || node.props.disabled) throw Error("Unavailable: " + title); node.props.onPress(); };
  const editName = (name: string) => nodes(render()).find(node => node.props?.label === "Tên phiên bản").props.onChangeText(name);
  const review = () => { for (let i=0; i<4; i++) press("Tiếp tục"); };
  return { initial, saved, updatePolicy, onSaved, setLocked, press, review, button, editName };
}
it("saves the active policy with its expected version and percentage rates in API units", async () => {
  const ui = mount(); ui.review(); ui.press("Lưu phiên bản công thức");
  await vi.waitFor(() => expect(ui.onSaved).toHaveBeenCalledOnce());
  expect(ui.updatePolicy).toHaveBeenCalledWith("p", expect.objectContaining({ expectedVersion: 4, funds: expect.arrayContaining([expect.objectContaining({ code: "health", employeeRate: 0.015 })]) }));
  expect(ui.setLocked).toHaveBeenLastCalledWith(false);
});
it.each([{ status: 400 }, { status: 422 }, { status: 409, code: "PAYROLL_POLICY_DUPLICATE" }])("preserves the form and permits correction after a rejected save: %j", async failure => {
  const ui = mount(failure); ui.review(); ui.press("Lưu phiên bản công thức");
  await vi.waitFor(() => expect(ui.setLocked).toHaveBeenLastCalledWith(false));
  expect(ui.onSaved).not.toHaveBeenCalled();
  for (let i=0; i<4; i++) ui.press("Bước trước");
  ui.editName("Tên đã sửa");
  ui.updatePolicy.mockResolvedValueOnce({ ...ui.saved, name: "Tên đã sửa" });
  ui.review(); ui.press("Lưu phiên bản công thức");
  await vi.waitFor(() => expect(ui.onSaved).toHaveBeenCalledOnce());
  expect(ui.updatePolicy).toHaveBeenLastCalledWith("p", expect.objectContaining({ name: "Tên đã sửa", expectedVersion: 4 }));
});
it.each([{ status: 409, code: "PAYROLL_POLICY_VERSION_CONFLICT" }, { status: 500 }, {}])("does not resubmit a stale or uncertain save: %j", async failure => {
  const ui = mount(failure); ui.review(); ui.press("Lưu phiên bản công thức");
  await vi.waitFor(() => expect(ui.setLocked).toHaveBeenLastCalledWith(false));
  expect(ui.button("Lưu phiên bản công thức").props.disabled).toBe(true);
  expect(ui.button("Đóng và tải lại").props.disabled).toBe(false);
  expect(ui.updatePolicy).toHaveBeenCalledOnce();
});
