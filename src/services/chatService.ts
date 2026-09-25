import type { ServiceTransport } from "./serviceTransport";
import { browserTransport } from "./serviceTransport";

export interface ChatAttachment {
  url: string;
  name?: string;
  type?: string;
  size?: number;
  uploadToken?: string;
}

export interface LinkPreview {
  url: string;
  title: string;
  description: string;
  image: string;
  siteName: string;
}

export interface ChatMessage {
  _id: string;
  roomId: string;
  senderId: string | { _id: string; displayName: string; photoURL?: string; email: string };
  senderName: string;
  senderDeleted?: boolean;
  senderPhoto?: string;
  content: string;
  attachments?: ChatAttachment[];
  readBy: string[];
  reactions?: { emoji: string; userId: string }[];
  replyTo?: any;
  isDeleted?: boolean;
  editedAt?: string | null;
  status?: "sending" | "sent" | "failed";
  createdAt: string;
}

export interface ChatRoomMember {
  userId: {
    _id: string;
    uid?: string;
    displayName: string;
    isDeleted?: boolean;
    photoURL?: string;
    email: string;
    role: string;
    status?: "online" | "offline";
  };
  role: "admin" | "deputy" | "member";
  joinedAt: string;
  isPinned?: boolean;
  notificationsMuted?: boolean;
  notificationsChangedAt?: string;
}

export interface ChatRoom {
  _id: string;
  name?: string;
  isGroup: boolean;
  companyCode: string;
  creatorId: string;
  members: ChatRoomMember[];
  lastMessage?: ChatMessage;
  avatarURL?: string;
  isChatbot?: boolean;
  pinnedMessageIds?: (string | ChatMessage)[];
  unreadCount?: number;
  onlyAdminsCanMessage?: boolean;
  isPinned?: boolean;
  createdAt: string;
  updatedAt: string;
}

export function createChatService(transport: ServiceTransport = browserTransport) {
  return {
    async setNotificationsMuted(roomId: string, muted: boolean): Promise<ChatRoom> {
      const res = await transport.fetch(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/notifications`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ muted }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Không thể cập nhật thông báo.");
      return json.data;
    },
    /**
     * Lấy danh sách các phòng chat của user
     */
    async getRooms(): Promise<ChatRoom[]> {
      const res = await transport.fetch("/api/v1/chat/rooms");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Không thể tải danh sách cuộc trò chuyện.");
      }
      const json = await res.json();
      return json.data || [];
    },

    /**
     * Lấy thông tin phòng chat theo ID
     */
    async getRoomById(roomId: string): Promise<ChatRoom> {
      const res = await transport.fetch(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Không thể tải thông tin phòng trò chuyện.");
      }
      const json = await res.json();
      return json.data;
    },

    /**
     * Tạo phòng chat mới (1-1 hoặc Nhóm)
     */
    async createRoom(payload: {
      isGroup: boolean;
      memberIds: string[];
      name?: string;
      avatarURL?: string;
    }): Promise<ChatRoom> {
      const res = await transport.fetch("/api/v1/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Không thể tạo cuộc trò chuyện mới.");
      }
      const json = await res.json();
      return json.data;
    },

    /**
     * Cập nhật thông tin phòng chat nhóm
     */
    async updateRoom(
      roomId: string,
      updateData: { name?: string; avatarURL?: string; onlyAdminsCanMessage?: boolean },
    ): Promise<ChatRoom> {
      const res = await transport.fetch(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Cập nhật thông tin phòng thất bại.");
      }
      const json = await res.json();
      return json.data;
    },

    /**
     * Ghim / Bỏ ghim cuộc trò chuyện
     */
    async togglePinRoom(roomId: string): Promise<ChatRoom> {
      const res = await transport.fetch(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/toggle-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Không thể ghim/bỏ ghim cuộc trò chuyện.");
      }
      const json = await res.json();
      return json.data;
    },

    /**
     * Thêm thành viên vào nhóm
     */
    async addMembers(roomId: string, memberIds: string[]): Promise<ChatRoom> {
      const res = await transport.fetch(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Thêm thành viên thất bại.");
      }
      const json = await res.json();
      return json.data;
    },

    /**
     * Xóa thành viên khỏi nhóm
     */
    async removeMember(roomId: string, userId: string): Promise<ChatRoom> {
      const res = await transport.fetch(
        `/api/v1/chat/rooms/${encodeURIComponent(roomId)}/members/${encodeURIComponent(userId)}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Xóa thành viên thất bại.");
      }
      const json = await res.json();
      return json.data;
    },

    /**
     * Rời khỏi nhóm
     */
    async leaveRoom(roomId: string): Promise<void> {
      const res = await transport.fetch(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/leave`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Rời nhóm thất bại.");
      }
    },

    /**
     * Giải tán nhóm
     */
    async deleteRoom(roomId: string): Promise<void> {
      const res = await transport.fetch(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Giải tán nhóm thất bại.");
      }
    },

    /**
     * Lấy lịch sử tin nhắn trong phòng
     */
    async getMessages(roomId: string, limit: number = 50, beforeDate?: string): Promise<ChatMessage[]> {
      let url = `/api/v1/chat/rooms/${encodeURIComponent(roomId)}/messages?limit=${limit}`;
      if (beforeDate) {
        url += `&beforeDate=${encodeURIComponent(beforeDate)}`;
      }
      const res = await transport.fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Không thể tải lịch sử tin nhắn.");
      }
      const json = await res.json();
      return json.data || [];
    },

    /**
     * Gửi tin nhắn mới
     */
    async sendMessage(
      roomId: string,
      content: string,
      attachments?: ChatAttachment[],
      replyTo?: string,
    ): Promise<ChatMessage> {
      const res = await transport.fetch(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, attachments, replyTo }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Không thể gửi tin nhắn.");
      }
      const json = await res.json();
      return json.data;
    },

    /**
     * Đánh dấu đã đọc
     */
    async markAsRead(roomId: string): Promise<void> {
      await transport.fetch(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/read`, {
        method: "POST",
      }).catch(() => {});
    },

    /**
     * Thu hồi / Xóa tin nhắn
     */
    async deleteMessage(roomId: string, messageId: string): Promise<ChatMessage> {
      const res = await transport.fetch(
        `/api/v1/chat/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}`,
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Thu hồi tin nhắn thất bại.");
      }
      const json = await res.json();
      return json.data;
    },

    /**
     * Thả / gỡ reaction emoji
     */
    async reactToMessage(roomId: string, messageId: string, emoji: string): Promise<ChatMessage> {
      const res = await transport.fetch(
        `/api/v1/chat/rooms/${encodeURIComponent(roomId)}/messages/${encodeURIComponent(messageId)}/react`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Thả cảm xúc thất bại.");
      }
      const json = await res.json();
      return json.data;
    },

    /**
     * Ghim tin nhắn
     */
    async pinMessage(roomId: string, messageId: string): Promise<ChatRoom> {
      const res = await transport.fetch(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Ghim tin nhắn thất bại.");
      }
      const json = await res.json();
      return json.data;
    },

    /**
     * Bỏ ghim tin nhắn
     */
    async unpinMessage(roomId: string, messageId: string): Promise<ChatRoom> {
      const res = await transport.fetch(`/api/v1/chat/rooms/${encodeURIComponent(roomId)}/unpin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Bỏ ghim tin nhắn thất bại.");
      }
      const json = await res.json();
      return json.data;
    },

    /**
     * Xem trước liên kết
     */
    async getLinkPreview(url: string): Promise<LinkPreview> {
      const res = await transport.fetch(`/api/v1/chat/link-preview?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Không lấy được xem trước liên kết.");
      }
      const json = await res.json();
      return json.data as LinkPreview;
    },
    /**
     * Báo cáo nội dung hoặc người dùng vi phạm (UGC Guideline 1.2)
     */
    async reportContent(data: {
      reportedUserId: string;
      roomId: string;
      messageId?: string;
      reason: "spam" | "harassment" | "inappropriate" | "fraud" | "other";
      details?: string;
    }): Promise<{ message: string }> {
      const res = await transport.fetch("/api/v1/chat/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Không thể gửi báo cáo vi phạm.");
      }
      return await res.json();
    },

    /**
     * Chặn người dùng (UGC Guideline 1.2)
     */
    async blockUser(blockedUserId: string, reason?: string): Promise<{ message: string }> {
      const res = await transport.fetch("/api/v1/chat/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockedUserId, reason }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Không thể chặn người dùng.");
      }
      return await res.json();
    },

    /**
     * Bỏ chặn người dùng
     */
    async unblockUser(targetUserId: string): Promise<{ message: string }> {
      const res = await transport.fetch(`/api/v1/chat/blocks/${encodeURIComponent(targetUserId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Không thể bỏ chặn người dùng.");
      }
      return await res.json();
    },

    /**
     * Lấy danh sách người dùng đã chặn
     */
    async getBlockedUsers(): Promise<{ blockId: string; blockedUser: any; reason: string; createdAt: string }[]> {
      const res = await transport.fetch("/api/v1/chat/blocks");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Không thể lấy danh sách chặn.");
      }
      const json = await res.json();
      return json.data || [];
    },
  };
}
