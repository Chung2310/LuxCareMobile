// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useEquipmentRequests } from "./useEquipmentRequests";

const { listRequests } = vi.hoisted(() => ({ listRequests: vi.fn() }));
vi.mock("../../api/services", () => ({ equipment: { listRequests } }));
vi.mock("expo-router", async () => {
  const { useEffect } = await import("react");
  return { useFocusEffect: (callback: () => any) => useEffect(callback, [callback]) };
});
let container: HTMLDivElement, root: Root;
let state: ReturnType<typeof useEquipmentRequests>;
function Probe({ scope = "one", revision = 0 }) { state = useEquipmentRequests(scope, revision); return null; }
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  listRequests.mockReset();
  container = document.createElement("div"); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); delete (globalThis as any).IS_REACT_ACT_ENVIRONMENT; });
function deferred() { let resolve!: (value: any) => void; const promise = new Promise(res => { resolve = res; }); return { promise, resolve }; }
const row = (id: string) => ({ _id: id, equipmentName: "Máy " + id, equipmentId: id, status: "pending" });

it("shows no fabricated requests when the server has no data or rejects loading", async () => {
  listRequests.mockResolvedValueOnce({ items: [], total: 0 }).mockRejectedValueOnce(new Error("Không có quyền"));
  await act(async () => root.render(React.createElement(Probe, {})));
  expect(state.requests).toEqual([]);
  expect(state.loading).toBe(false);
  await act(async () => root.render(React.createElement(Probe, { revision: 1 })));
  expect(state.requests).toEqual([]);
  expect(state.error).toBe("Không có quyền");
});
it("ignores a late response belonging to a previous account or branch", async () => {
  const old = deferred();
  listRequests.mockReturnValueOnce(old.promise).mockResolvedValueOnce({ items: [row("new")], total: 1 });
  await act(async () => root.render(React.createElement(Probe, { scope: "old-account" })));
  await act(async () => root.render(React.createElement(Probe, { scope: "new-account" })));
  await act(async () => old.resolve({ items: [row("old")], total: 99 }));
  expect(state.requests.map(item => item._id)).toEqual(["new"]);
  expect(state.total).toBe(1);
});
it("preserves loaded rows when the next page fails and retries the same page", async () => {
  listRequests.mockResolvedValueOnce({ items: [row("one")], total: 125 }).mockRejectedValueOnce(new Error("Mất mạng"))
    .mockResolvedValueOnce({ items: [{ ...row("one"), status: "approved" }, row("two")], total: 125 });
  await act(async () => root.render(React.createElement(Probe, {})));
  await act(async () => state.loadMore());
  expect(state.requests.map(item => item._id)).toEqual(["one"]);
  expect(state.error).toBe("Mất mạng");
  await act(async () => state.loadMore());
  expect(listRequests.mock.calls.map(call => call[0])).toEqual([1, 2, 2]);
  expect(state.requests.map(item => item._id)).toEqual(["one", "two"]);
  expect(state.requests[0].status).toBe("approved");
  expect(state.hasMore).toBe(false);
});
it("blocks duplicate load-more requests and ignores an old page after a refresh", async () => {
  const next = deferred();
  listRequests.mockResolvedValueOnce({ items: [row("one")], total: 125 }).mockReturnValueOnce(next.promise)
    .mockResolvedValueOnce({ items: [row("fresh")], total: 1 });
  await act(async () => root.render(React.createElement(Probe, {})));
  await act(async () => { state.loadMore(); state.loadMore(); });
  expect(listRequests).toHaveBeenCalledTimes(2);
  await act(async () => root.render(React.createElement(Probe, { revision: 1 })));
  await act(async () => next.resolve({ items: [row("stale")], total: 125 }));
  expect(state.requests.map(item => item._id)).toEqual(["fresh"]);
});
