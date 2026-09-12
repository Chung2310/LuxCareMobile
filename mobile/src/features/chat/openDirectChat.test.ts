import { expect, it, vi } from "vitest";
import { createDirectChatOpener } from "./openDirectChat";
import { createChatService, type ChatRoom } from "../../../../src/services/chatService";

it.each(["existing-room", "new-room"])("opens the server's existing or newly created private room (%s)", async id => {
  const room = { _id: id, isGroup: false } as ChatRoom;
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: room }), { status: 201 }));
  const service = createChatService({ fetch, getAccessToken: () => null });
  const open = createDirectChatOpener(input => service.createRoom(input));
  expect(await open("company:me", " colleague ")).toEqual(room);
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/chat/rooms");
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ isGroup: false, memberIds: ["colleague"] });
});
it("shares concurrent requests for the same recipient", async () => {
  let resolve!: (room: ChatRoom) => void;
  const create = vi.fn(() => new Promise<ChatRoom>(done => { resolve = done; }));
  const open = createDirectChatOpener(create);
  const first = open("scope", "peer");
  const second = open("scope", "peer");
  expect(first).toBe(second);
  await Promise.resolve();
  expect(create).toHaveBeenCalledOnce();
  resolve({ _id: "room", isGroup: false } as ChatRoom);
  await expect(first).resolves.toMatchObject({ _id: "room" });
});
it("keeps distinct recipients and sessions separate", async () => {
  const create = vi.fn().mockResolvedValue({ _id: "room", isGroup: false });
  const open = createDirectChatOpener(create);
  await Promise.all([open("sessionA", "peer1"), open("sessionA", "peer2"), open("sessionB", "peer1")]);
  expect(create).toHaveBeenCalledTimes(3);
});
it("allows retry after failure and does not cache stale rooms", async () => {
  const create = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValue({ _id: "room", isGroup: false });
  const open = createDirectChatOpener(create);
  await expect(open("scope", "peer")).rejects.toThrow("Offline");
  await expect(open("scope", "peer")).resolves.toMatchObject({ _id: "room" });
  await open("scope", "peer");
  expect(create).toHaveBeenCalledTimes(3);
});
it("rejects missing recipients and invalid room responses", async () => {
  const create = vi.fn().mockResolvedValue({ _id: "group", isGroup: true });
  const open = createDirectChatOpener(create);
  await expect(open("scope", " ")).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
  await expect(open("scope", "peer")).rejects.toThrow();
});
