import { expect, it, vi } from "vitest";
import { createScreenProtection, isProtectedPath } from "./screenProtection";

function setup() {
  const adapter = {
    prevent: vi.fn(async () => {}), allow: vi.fn(async () => {}),
    enablePrivacy: vi.fn(async () => {}), disablePrivacy: vi.fn(async () => {}),
  };
  const error = vi.fn();
  return { adapter, error, set: createScreenProtection(adapter, error) };
}

it("protects only blog and chat routes including nested viewers", () => {
  for (const path of ["/blog", "/chat", "/blog/123", "/chat/room/image"]) expect(isProtectedPath(path)).toBe(true);
  for (const path of ["/", "/login", "/profile", "/chat-settings", "/blogger"]) expect(isProtectedPath(path)).toBe(false);
});

it("keeps protection between protected tabs and releases on exit", async () => {
  const { adapter, set } = setup();
  await set(false);
  expect(adapter.allow).not.toHaveBeenCalled();
  await set(true);
  await set(true);
  expect(adapter.prevent).toHaveBeenCalledTimes(1);
  expect(adapter.enablePrivacy).toHaveBeenCalledTimes(1);
  await set(false);
  expect(adapter.allow).toHaveBeenCalledTimes(1);
  expect(adapter.disablePrivacy).toHaveBeenCalledTimes(1);
});

it("discards an obsolete rapid tab change", async () => {
  const { adapter, set } = setup();
  await set(true);
  await Promise.all([set(false), set(true)]);
  expect(adapter.allow).not.toHaveBeenCalled();
});

it("waits for activation before releasing on unmount", async () => {
  const { adapter, set } = setup();
  let finish!: () => void;
  adapter.prevent.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  const entering = set(true);
  await Promise.resolve();
  await Promise.resolve();
  const leaving = set(false);
  expect(adapter.allow).not.toHaveBeenCalled();
  finish();
  await Promise.all([entering, leaving]);
  expect(adapter.allow).toHaveBeenCalledTimes(1);
});

it("reports native failures and still performs cleanup", async () => {
  const { adapter, error, set } = setup();
  adapter.prevent.mockRejectedValueOnce(new Error("native failure"));
  await set(true);
  expect(error).toHaveBeenCalledTimes(1);
  expect(adapter.enablePrivacy).toHaveBeenCalledTimes(1);
  await set(false);
  expect(adapter.allow).toHaveBeenCalledTimes(1);
  expect(adapter.disablePrivacy).toHaveBeenCalledTimes(1);
});
