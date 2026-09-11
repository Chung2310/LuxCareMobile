import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useSession } from "../auth/SessionProvider";
import { chat } from "../api/services";
import { socketService } from "../api/socketService";

interface ChatUnreadContextValue {
  totalUnread: number;
  unreadByRoom: Record<string, number>;
  markRoomRead: (roomId: string) => void;
  refreshUnread: () => Promise<void>;
}

const ChatUnreadContext = createContext<ChatUnreadContextValue>({
  totalUnread: 0,
  unreadByRoom: {},
  markRoomRead: () => {},
  refreshUnread: async () => {},
});

export function useChatUnread() {
  return useContext(ChatUnreadContext);
}

const getSenderIdString = (senderId: any): string => {
  if (!senderId) return "";
  if (typeof senderId === "string") return senderId;
  if (senderId._id) return String(senderId._id);
  if (senderId.uid) return String(senderId.uid);
  if (typeof senderId.toString === "function") return senderId.toString();
  return String(senderId);
};

export function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const currentUserId = (user as any)?._id || user?.uid || "";
  const currentUserIdRef = useRef(currentUserId);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});

  const refreshUnread = useCallback(async () => {
    if (!currentUserIdRef.current) return;
    try {
      const rooms = await chat.getRooms();
      const initial: Record<string, number> = {};
      rooms.forEach((room) => {
        if (room._id && room.unreadCount && room.unreadCount > 0) {
          initial[room._id] = room.unreadCount;
        }
      });
      setUnreadByRoom(initial);
    } catch {
      // Bỏ qua lỗi ngầm
    }
  }, []);

  const markRoomRead = useCallback((roomId: string) => {
    if (!roomId) return;
    setUnreadByRoom((prev) => {
      if (!prev[roomId]) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
  }, []);

  // Tải ban đầu khi đăng nhập
  useEffect(() => {
    if (!user || !currentUserId) {
      setUnreadByRoom({});
      return;
    }
    void refreshUnread();
  }, [user?.uid, currentUserId, refreshUnread]);

  // Lắng nghe WebSocket thời gian thực (real-time)
  useEffect(() => {
    if (!user || !currentUserId) return;

    const handleNewMessage = (payload: any) => {
      const roomId = payload?.roomId as string | undefined;
      const msg = payload?.message;
      if (!roomId || !msg) return;

      const senderId = getSenderIdString(msg.senderId);
      const isFromMe = senderId === currentUserIdRef.current;

      if (isFromMe) {
        // Tin nhắn của tôi không tính vào chưa đọc
        return;
      }

      setUnreadByRoom((prev) => ({
        ...prev,
        [roomId]: (prev[roomId] || 0) + 1,
      }));
    };

    const handleMessagesRead = (payload: { roomId: string; userId: string }) => {
      if (payload?.userId === currentUserIdRef.current && payload?.roomId) {
        setUnreadByRoom((prev) => {
          if (!prev[payload.roomId]) return prev;
          const next = { ...prev };
          delete next[payload.roomId];
          return next;
        });
      }
    };

    const handleRoomDeleted = (payload: { roomId: string }) => {
      if (payload?.roomId) {
        setUnreadByRoom((prev) => {
          if (!(payload.roomId in prev)) return prev;
          const next = { ...prev };
          delete next[payload.roomId];
          return next;
        });
      }
    };

    const handleRoomUpdated = () => {
      void refreshUnread();
    };

    socketService.on("internal_new_message", handleNewMessage);
    socketService.on("internal_messages_read", handleMessagesRead);
    socketService.on("internal_room_deleted", handleRoomDeleted);
    socketService.on("internal_room_updated", handleRoomUpdated);

    return () => {
      socketService.off("internal_new_message", handleNewMessage);
      socketService.off("internal_messages_read", handleMessagesRead);
      socketService.off("internal_room_deleted", handleRoomDeleted);
      socketService.off("internal_room_updated", handleRoomUpdated);
    };
  }, [user, currentUserId, refreshUnread]);

  // Làm mới khi mở lại app từ background
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status: AppStateStatus) => {
      if (status === "active") {
        void refreshUnread();
      }
    });
    return () => subscription.remove();
  }, [refreshUnread]);

  // Polling dự phòng mỗi 12 giây nếu đang mở app
  useEffect(() => {
    if (!user || !currentUserId) return;
    const interval = setInterval(() => {
      void refreshUnread();
    }, 12000);
    return () => clearInterval(interval);
  }, [user, currentUserId, refreshUnread]);

  const totalUnread = useMemo(() => {
    return Object.values(unreadByRoom).reduce((acc, count) => acc + (count || 0), 0);
  }, [unreadByRoom]);

  return (
    <ChatUnreadContext.Provider
      value={{
        totalUnread,
        unreadByRoom,
        markRoomRead,
        refreshUnread,
      }}
    >
      {children}
    </ChatUnreadContext.Provider>
  );
}
