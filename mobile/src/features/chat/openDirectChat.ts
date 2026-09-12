import type { ChatRoom } from "../../../../src/services/chatService";

// POST /chat/rooms reuses the private room on the server; share concurrent opens locally.
export function createDirectChatOpener(createRoom: (input: { isGroup: boolean; memberIds: string[] }) => Promise<ChatRoom>) {
  const pending = new Map<string, Promise<ChatRoom>>();
  return (scope: string, peerId: string): Promise<ChatRoom> => {
    const peer = peerId.trim();
    if (!peer) return Promise.reject(new Error("Chưa xác định được người nhận."));
    const key = JSON.stringify([scope, peer]);
    const existing = pending.get(key);
    if (existing) return existing;
    const request = Promise.resolve().then(() => createRoom({ isGroup: false, memberIds: [peer] }))
      .then(room => {
        if (!room?._id || room.isGroup) throw new Error("Không thể mở cuộc trò chuyện với nhân sự này.");
        return room;
      }).finally(() => pending.delete(key));
    pending.set(key, request);
    return request;
  };
}
