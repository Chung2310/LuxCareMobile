import { beforeEach, expect, it, vi } from "vitest";
const { io, sockets } = vi.hoisted(() => ({ io: vi.fn(), sockets: [] as any[] }));
vi.mock("socket.io-client", () => ({ io }));
import { socketService } from "./socketService";
beforeEach(() => {
  socketService.disconnect(); sockets.length = 0; io.mockReset();
  io.mockImplementation(() => {
    const socket = { connected: true, on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn(), disconnect: vi.fn() };
    sockets.push(socket); return socket;
  });
  socketService.configure({ origin: "https://luxcare.example", onSessionReplaced: vi.fn() });
});
it("preserves notification subscribers across token rotation and removes them on unsubscribe", () => {
  const handler = vi.fn();
  const off = socketService.subscribe("new_notification", handler);
  socketService.connect("first");
  socketService.connect("second");
  expect(sockets[0].disconnect).toHaveBeenCalledOnce();
  expect(sockets[1].on).toHaveBeenCalledWith("new_notification", handler);
  off();
  expect(sockets[1].off).toHaveBeenCalledWith("new_notification", handler);
  socketService.connect("third");
  expect(sockets[2].on).not.toHaveBeenCalledWith("new_notification", handler);
});
