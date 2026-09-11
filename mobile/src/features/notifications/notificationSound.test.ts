import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const source = ts.transpileModule(readFileSync(new URL("./notificationSound.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
function setup(loaded = true) {
  const player = { isLoaded: loaded, volume: 1, play: vi.fn(), remove: vi.fn(), addListener: vi.fn() };
  const statusRemoved = vi.fn(), stateRemoved = vi.fn();
  let status: (value: any) => void = () => {};
  let state: (value: string) => void = () => {};
  player.addListener.mockImplementation((_event, callback) => { status = callback; return { remove: statusRemoved }; });
  const appState = { currentState: "active", addEventListener: (_event: string, callback: typeof state) => {
    state = callback; return { remove: stateRemoved };
  } };
  const platform = { OS: "android" };
  const create = vi.fn(() => player);
  const module = { exports: {} as any };
  vm.runInNewContext(source, { exports: module.exports, module, Date, setTimeout, clearTimeout,
    require: (name: string) => {
      if (name === "react-native") return { AppState: appState, Platform: platform };
      if (name === "expo-audio") return { createAudioPlayer: create };
      if (name === "../../../assets/notification_sound/universfield-new-notification-051-494246.mp3") return 42;
      throw new Error(name);
    },
  });
  return { sound: module.exports, player, create, appState, platform, statusRemoved, stateRemoved,
    status: (value: any) => status(value), background: () => { appState.currentState = "background"; state("background"); } };
}
afterEach(() => vi.useRealTimers());
describe("notification audio", () => {
  it("bundles the supplied MP3 and does not cut it off at two seconds", () => {
    vi.useFakeTimers();
    expect(readFileSync(new URL("../../../assets/notification_sound/universfield-new-notification-051-494246.mp3", import.meta.url)).length).toBeGreaterThan(0);
    const host = setup();
    host.sound.playNotificationSound();
    expect(host.create).toHaveBeenCalledWith(42, { updateInterval: 100 });
    vi.advanceTimersByTime(2500);
    expect(host.player.remove).not.toHaveBeenCalled();
    host.status({ didJustFinish: true });
    expect(host.player.remove).toHaveBeenCalledTimes(1);
  });
  it("plays once for an event burst and releases all native resources on completion", () => {
    vi.useFakeTimers();
    const host = setup();
    host.sound.playNotificationSound();
    host.sound.playNotificationSound();
    expect(host.player.play).toHaveBeenCalledTimes(1);
    host.status({ didJustFinish: true });
    expect(host.player.remove).toHaveBeenCalledTimes(1);
    expect(host.statusRemoved).toHaveBeenCalled();
    expect(host.stateRemoved).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("never plays in the background or after backgrounding while loading", () => {
    vi.useFakeTimers();
    const host = setup(false);
    host.sound.playNotificationSound();
    host.background();
    host.status({ isLoaded: true });
    expect(host.player.play).not.toHaveBeenCalled();
    expect(host.player.remove).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1100);
    host.sound.playNotificationSound();
    expect(host.create).toHaveBeenCalledTimes(1);
  });
  it("waits for loading and times out cleanly", () => {
    vi.useFakeTimers();
    const host = setup(false);
    host.sound.playNotificationSound();
    expect(host.player.play).not.toHaveBeenCalled();
    host.status({ isLoaded: true });
    host.status({ isLoaded: true });
    expect(host.player.play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10000);
    expect(host.player.remove).toHaveBeenCalledTimes(1);
  });
  it("can be cancelled at logout and does not throw on decoder failures", () => {
    vi.useFakeTimers();
    const host = setup();
    host.player.play.mockImplementation(() => { throw new Error("decoder failed"); });
    expect(() => host.sound.playNotificationSound()).not.toThrow();
    host.sound.stopNotificationSound();
    expect(host.player.remove).toHaveBeenCalledTimes(1);
  });
});
