import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { expect, it, vi } from "vitest";
import * as syncModel from "./syncAttendanceModel";
import * as lockModel from "./lockAttendanceModel";
import * as calculationModel from "./calculationModel";
import * as reviewModel from "./reviewModel";
import * as reopenModel from "./reopenModel";
import type { PayrollRun } from "../../../../src/types/payrollRun";
const ts = createRequire(import.meta.url)("typescript");
const user = {
  uid: "u",
  companyCode: "C",
  branchId: "b",
  enabledModules: ["hr"],
  permissions: ["payroll-period:read", "payroll-period:manage"],
};
function mount(component: string, api: any, props: () => any) {
  const source = ts.transpileModule(
    readFileSync(new URL("./" + component + ".tsx", import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText;
  const slots: any[] = [];
  let cursor = 0;
  let effects: (() => void)[] = [];
  const showAlert = vi.fn();
  const jsx = (type: any, props: any) => ({ type, props: props || {} });
  const react = {
    useState(initial: any) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (next: any) => {
          slots[index] = typeof next === "function" ? next(slots[index]) : next;
        },
      ];
    },
    useRef(initial: any) {
      const index = cursor++;
      return (slots[index] ||= { current: initial });
    },
    useCallback(fn: any, deps: any[]) {
      const index = cursor++;
      if (
        !slots[index] ||
        deps.some((value, i) => value !== slots[index].deps[i])
      )
        slots[index] = { fn, deps };
      return slots[index].fn;
    },
  };
  const module = { exports: {} as any };
  const models: Record<string, any> = {
    "./syncAttendanceModel": syncModel,
    "./lockAttendanceModel": lockModel,
    "./calculationModel": calculationModel,
    "./reviewModel": reviewModel,
    "./reopenModel": reopenModel,
  };
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require(name: string) {
      if (models[name]) return models[name];
      if (name === "react") return react;
      if (name === "react/jsx-runtime")
        return { jsx, jsxs: jsx, Fragment: "Fragment" };
      if (name === "expo-crypto") return { randomUUID: () => "key" };
      if (name === "expo-router")
        return {
          useFocusEffect(fn: any) {
            const index = cursor++;
            if (slots[index]?.fn !== fn) {
              slots[index]?.cleanup?.();
              const entry = { fn, cleanup: undefined as any };
              slots[index] = entry;
              effects.push(() => {
                entry.cleanup = fn();
              });
            }
          },
        };
      if (name === "../../api/services") return { payroll: api };
      if (name === "../../auth/SessionProvider")
        return {
          useSession: () => ({ user, selectedBranch: { _id: "b" } }),
          messageOf: (err: Error) => err.message,
        };
      if (name === "../../components/AppAlert")
        return { useAppAlert: () => ({ showAlert, alertView: null }) };
      if (name === "./formulaModel")
        return { canReadFormulas: () => false, policyForDate: () => undefined };
      if (name === "./model")
        return { payslipMoney: (value: number) => String(value) };
      return new Proxy(
        {},
        { get: (_, key) => (key === "styles" ? {} : String(key)) },
      );
    },
  });
  const render = () => {
    cursor = 0;
    const tree = module.exports[component](props());
    const queued = effects;
    effects = [];
    queued.forEach((fn) => fn());
    return tree;
  };
  const nodes = (tree: any): any[] =>
    !tree || typeof tree !== "object"
      ? []
      : Array.isArray(tree)
        ? tree.flatMap(nodes)
        : [tree, ...nodes(tree.props?.children)];
  const press = (title: string) => {
    const node = nodes(render()).find(
      (node) => node.type === "Button" && node.props.title === title,
    );
    if (!node) throw Error("Button not found: " + title);
    if (node.props.disabled) throw Error("Button disabled: " + title);
    node.props.onPress();
  };
  render();
  return {
    render,
    press,
    showAlert,
    unmount: () => slots.forEach((slot) => slot?.cleanup?.()),
  };
}
function scenario() {
  let server: PayrollRun = {
    _id: "r",
    periodKey: "2026-09",
    status: "draft",
    version: 0,
    effectiveLines: [],
  };
  let current = { ...server };
  const advance = (version: number, status = "draft") => {
    if (version !== server.version) throw Error("Version mismatch");
    server = { ...server, version: version + 1, status };
    return server;
  };
  const api = {
    getRun: vi.fn(async () => ({ ...server })),
    syncRunAttendance: vi.fn(async (id, version, key) => ({
      runVersion: advance(version).version,
      job: {
        runId: id,
        operation: "sync-attendance",
        idempotencyKey: key,
        status: "succeeded",
        payload: { expectedVersion: version },
        result: { employeeCount: 0, blockingIssueCount: 0 },
      },
    })),
    lockRunAttendance: vi.fn(async (id, version) => ({
      run: advance(version),
      snapshot: {
        _id: "s",
        runId: id,
        periodKey: server.periodKey,
        lockedAt: "2026-09-01T00:00:00Z",
        employees: [],
      },
    })),
    calculateOperationalRun: vi.fn(async (id, version) => {
      server = {
        ...server,
        activeRevisionId: "rev",
        activeRevisionChecksum: "checksum",
      };
      return {
        runVersion: advance(version).version,
        revision: {
          _id: "rev",
          runId: id,
          status: "completed",
          effectiveLines: [],
        },
      };
    }),
    reviewRun: vi.fn(async (_id, version) => advance(version, "review")),
    closeRun: vi.fn(async (_id, version) => advance(version, "closed")),
  };
  const onChanged = vi.fn();
  const onUpdated = vi.fn(async (minimum: number) => {
    current = await api.getRun();
    expect(current.version).toBeGreaterThanOrEqual(minimum);
  });
  return {
    api,
    onUpdated,
    onChanged,
    props: () => ({ run: current, onUpdated, onChanged }),
  };
}
it("syncs, locks, calculates, reviews and closes with each new version without acknowledging alerts", async () => {
  const flow = scenario();
  const sync = mount("SyncRunAttendance", flow.api, flow.props);
  sync.press("Đồng bộ dữ liệu công");
  sync.press("Xác nhận đồng bộ công");
  await vi.waitFor(() => expect(sync.showAlert).toHaveBeenCalledTimes(1));
  expect(flow.onUpdated).toHaveBeenLastCalledWith(1);
  sync.press("Khóa bản công vừa đồng bộ");
  sync.press("Xác nhận khóa công");
  await vi.waitFor(() => expect(sync.showAlert).toHaveBeenCalledTimes(2));
  expect(flow.api.lockRunAttendance).toHaveBeenCalledWith("r", 1);
  sync.unmount();
  const calculate = mount("CalculatePayrollRun", flow.api, flow.props);
  calculate.press("Tính / tính lại lương");
  calculate.press("Xác nhận tính lương");
  await vi.waitFor(() => expect(calculate.showAlert).toHaveBeenCalledTimes(1));
  expect(flow.api.calculateOperationalRun).toHaveBeenCalledWith("r", 2, "key");
  calculate.unmount();
  const review = mount("ReviewPayrollRun", flow.api, flow.props);
  review.press("Duyệt / chuyển sang kiểm tra");
  review.press("Xác nhận duyệt kỳ");
  await vi.waitFor(() => expect(review.showAlert).toHaveBeenCalledTimes(1));
  expect(flow.api.reviewRun).toHaveBeenCalledWith("r", 3);
  expect(review.render()).not.toBeNull();
  review.unmount();
  const close = mount("ReviewPayrollRun", flow.api, () => ({
    ...flow.props(),
    close: true,
  }));
  close.press("Chốt kỳ lương");
  close.press("Xác nhận chốt kỳ");
  await vi.waitFor(() => expect(close.showAlert).toHaveBeenCalledTimes(1));
  expect(flow.api.closeRun).toHaveBeenCalledWith("r", 4);
  expect(flow.props().run).toMatchObject({ status: "closed", version: 5 });
  expect(flow.onChanged).not.toHaveBeenCalled();
  expect(flow.api.getRun).toHaveBeenCalledTimes(5);
});
it("still refreshes the parent when the sync dialog is closed before the response arrives", async () => {
  const flow = scenario();
  const original = flow.api.syncRunAttendance.getMockImplementation()!;
  let resolve!: (value: unknown) => void;
  const response = new Promise((done) => {
    resolve = done;
  });
  flow.api.syncRunAttendance.mockImplementationOnce(() => response as any);
  const sync = mount("SyncRunAttendance", flow.api, flow.props);
  sync.press("Đồng bộ dữ liệu công");
  sync.press("Xác nhận đồng bộ công");
  sync.unmount();
  resolve(await original("r", 0, "key"));
  await vi.waitFor(() => expect(flow.onUpdated).toHaveBeenCalledWith(1));
  expect(flow.props().run.version).toBe(1);
  expect(sync.showAlert).not.toHaveBeenCalled();
});
it("does not advance the local version after a rejected synchronization", async () => {
  const flow = scenario();
  flow.api.syncRunAttendance.mockRejectedValueOnce(Error("Refused"));
  const sync = mount("SyncRunAttendance", flow.api, flow.props);
  sync.press("Đồng bộ dữ liệu công");
  sync.press("Xác nhận đồng bộ công");
  await vi.waitFor(() => expect(sync.showAlert).toHaveBeenCalledTimes(1));
  expect(flow.onUpdated).not.toHaveBeenCalled();
  expect(flow.props().run.version).toBe(0);
});

it("requires calculation before review and offers the calculation step without mutating the run", () => {
  const flow = scenario();
  const onCalculate = vi.fn();
  const review = mount("ReviewPayrollRun", flow.api, () => ({
    ...flow.props(),
    onCalculate,
  }));
  expect(() => review.press("Duyệt / chuyển sang kiểm tra")).toThrow(
    "Button not found",
  );
  review.press("Đi đến bước tính lương");
  expect(onCalculate).toHaveBeenCalledOnce();
  expect(flow.api.reviewRun).not.toHaveBeenCalled();
});
it("offers reopening for a review run without a calculation instead of attempting to close it", () => {
  const flow = scenario();
  const onReopen = vi.fn();
  const close = mount("ReviewPayrollRun", flow.api, () => ({
    ...flow.props(),
    run: { ...flow.props().run, status: "review" },
    close: true,
    onReopen,
  }));
  expect(() => close.press("Chốt kỳ lương")).toThrow("Button not found");
  close.press("Mở lại kỳ để tính lương");
  expect(onReopen).toHaveBeenCalledOnce();
  expect(flow.api.closeRun).not.toHaveBeenCalled();
});
it("offers recovery when the server reports that the active revision is unavailable", async () => {
  const flow = scenario();
  const onReopen = vi.fn();
  flow.api.closeRun.mockRejectedValueOnce(
    Object.assign(Error("Missing revision"), {
      code: "PAYROLL_REVISION_MISSING",
    }),
  );
  const close = mount("ReviewPayrollRun", flow.api, () => ({
    ...flow.props(),
    run: {
      ...flow.props().run,
      status: "review",
      activeRevisionId: "rev",
      activeRevisionChecksum: "checksum",
    },
    close: true,
    onReopen,
  }));
  close.press("Chốt kỳ lương");
  close.press("Xác nhận chốt kỳ");
  await vi.waitFor(() => expect(close.showAlert).toHaveBeenCalledOnce());
  close.press("Mở lại kỳ để tính lương");
  expect(onReopen).toHaveBeenCalledOnce();
  expect(flow.api.closeRun).toHaveBeenCalledOnce();
});
