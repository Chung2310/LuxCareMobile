import type { ChatRoom } from "../../../../src/services/chatService";

export function chatNotificationsMuted(room: ChatRoom, uid: string): boolean {
  const member = room.members?.find(m => String(typeof m.userId === "object" ? m.userId._id : m.userId) === uid);
  return !member || member.notificationsMuted === true;
}

export type ChatPush = { kind: "chat"; roomId: string; messageId: string; recipientUid: string; companyCode: string };
export function parseChatPush(value: unknown): ChatPush | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (data.kind !== "chat" || !["roomId", "messageId", "recipientUid"].every(k =>
    typeof data[k] === "string" && /^[a-f0-9]{24}$/i.test(data[k] as string)) ||
    typeof data.companyCode !== "string" || !data.companyCode) return null;
  return data as ChatPush;
}
