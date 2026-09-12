import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import { expect, it, vi } from "vitest";

const ts = createRequire(import.meta.url)("typescript");
const source = ts.transpileModule(readFileSync(new URL("./socketService.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

// vi.mock does not intercept CommonJS require. Execute the actual service with
// an injected require so tests never load a real socket or open network connections.
function createHost() {
  const sockets: any[] = [];
  const io = vi.fn(() => {
    const listeners = new Map<string, Set<(...args: any[]) => void>>();
    const socket = {
      connected: true,
      on: vi.fn((event: string, fn: (...args: any[]) => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(fn);
      }),
      off: vi.fn((event: string, fn: (...args: any[]) => void) => listeners.get(event)?.delete(fn)),
      removeAllListeners: vi.fn(() => listeners.clear()),
      disconnect: vi.fn(() => { socket.connected = false; }),
      emit: (event: string, data?: any) => [...(listeners.get(event) || [])].forEach(fn => fn(data)),
      listenerCount: (event: string) => listeners.get(event)?.size || 0,
    };
    sockets.push(socket);
    return socket;
  });
  const requireModule = vi.fn((name: string) => {
    if (name === "socket.io-client") {
      return { io };
    }
    throw Error("Unexpected dependency: " + name);
  });
  const module = { exports: {} as typeof import("./socketService") };
  vm.runInNewContext(source, { module, exports: module.exports, require: requireModule, process: { env: {} } });
  const socketService = module.exports.socketService;
  const onSessionReplaced = vi.fn();
  socketService.configure({ origin: "https://luxcare.example/", onSessionReplaced });
  return { socketService, sockets, io, requireModule, onSessionReplaced };
}

it("preserves notification subscribers across token rotation and removes them on unsubscribe", () => {
  const { socketService, sockets } = createHost();
  const handler = vi.fn();
  const off = socketService.subscribe("new_notification", handler);
  socketService.connect("first");
  socketService.connect("second");
  expect(sockets).toHaveLength(2);
  expect(sockets[0].disconnect).toHaveBeenCalledOnce();
  expect(sockets[1].on).toHaveBeenCalledWith("new_notification", handler);
  sockets[1].emit("new_notification", { id: "notification" });
  expect(handler).toHaveBeenCalledExactlyOnceWith({ id: "notification" });
  off();
  expect(sockets[1].off).toHaveBeenCalledWith("new_notification", handler);
  socketService.connect("third");
  expect(sockets[2].on).not.toHaveBeenCalledWith("new_notification", handler);
});

it("connects using the named io export and passes the access token", () => {
  const { socketService, io } = createHost();
  socketService.connect("token");
  expect(io).toHaveBeenCalledExactlyOnceWith("https://luxcare.example", expect.objectContaining({
    auth: { token: "token" },
  }));
  expect(socketService.isConnected).toBe(true);
});

it("does not reconnect an already connected socket with the same token", () => {
  const { socketService, io } = createHost();
  socketService.connect("token");
  socketService.connect("token");
  expect(io).toHaveBeenCalledOnce();
});

it("rebinds listeners once on reconnect and respects unsubscribe afterwards", () => {
  const { socketService, sockets } = createHost();
  const handler = vi.fn();
  const off = socketService.subscribe("internal_new_message", handler);
  socketService.connect("token");
  sockets[0].emit("connect");
  sockets[0].emit("connect");
  expect(sockets[0].listenerCount("internal_new_message")).toBe(1);
  off();
  sockets[0].emit("connect");
  expect(sockets[0].listenerCount("internal_new_message")).toBe(0);
});

it("clears subscriptions when the server replaces the session", () => {
  const { socketService, sockets, onSessionReplaced } = createHost();
  const handler = vi.fn();
  socketService.subscribe("new_notification", handler);
  socketService.connect("first");
  const event = { code: "SESSION_REPLACED", message: "New login" };
  sockets[0].emit("auth:session-replaced", event);
  expect(onSessionReplaced).toHaveBeenCalledExactlyOnceWith(event);
  expect(socketService.isConnected).toBe(false);
  expect(sockets[0].removeAllListeners).toHaveBeenCalledOnce();
  socketService.connect("second");
  expect(sockets[1].on).not.toHaveBeenCalledWith("new_notification", handler);
});
