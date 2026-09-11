import { describe, it, expect } from "vitest";
import { chatNotificationsMuted, parseChatPush } from "./chatNotificationState";
import { createChatService, type ChatRoom } from "../../../../src/services/chatService";
describe("chat notification preferences", () => {
  it("fails closed for non-members and respects only the current user's mute", () => {
    const room = { members: [{ userId: { _id: "a" }, notificationsMuted: true }, { userId: { _id: "b" } }] } as ChatRoom;
    expect(chatNotificationsMuted(room, "a")).toBe(true);
    expect(chatNotificationsMuted(room, "b")).toBe(false);
    expect(chatNotificationsMuted(room, "c")).toBe(true);
  });
  it("accepts only scoped chat payloads with valid identifiers", () => {
    const data = { kind: "chat", roomId: "a".repeat(24), messageId: "b".repeat(24), recipientUid: "c".repeat(24), companyCode: "C" };
    expect(parseChatPush(data)).toEqual(data);
    for (const invalid of [null, {}, { ...data, roomId: "/admin" }, { ...data, companyCode: "" }, { ...data, kind: "task" }])
      expect(parseChatPush(invalid)).toBeNull();
  });
  it("saves a boolean preference through the authenticated transport", async () => {
    const calls: any[] = [];
    const service = createChatService({ fetch: async (...args: any[]) => {
      calls.push(args); return { ok: true, json: async () => ({ data: { _id: "room" } }) } as Response;
    } } as any);
    expect(await service.setNotificationsMuted("room", true)).toEqual({ _id: "room" });
    expect(calls[0]).toEqual(["/api/v1/chat/rooms/room/notifications", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: '{"muted":true}',
    }]);
  });
});
