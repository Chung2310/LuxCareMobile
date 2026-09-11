import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Platform, Pressable, Text, View } from "react-native";
import { router, usePathname, useRootNavigationState } from "expo-router";
import { nativeNotifications as Notifications } from "./nativeNotifications";
import { chatNotificationsMuted, parseChatPush, type ChatPush } from "./chatNotificationState";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, blog, chat } from "../../api/services";
import { socketService } from "../../api/socketService";
import { useSession } from "../../auth/SessionProvider";
import { canUseModule } from "../../auth/access";
import type { BlogPost } from "../../../../src/services/blogService";
import { countBlogUnread, mergeBlogSeen } from "./communicationState";
import { RealtimeNotificationToast } from "./RealtimeNotificationToast";
import { playNotificationSound } from "./notificationSound";
export { communicationBadge } from "./communicationState";

import type { ChatRoom } from "../../../../src/services/chatService";

type State = { chatRooms: ChatRoom[] | null; blogUnread: number; chatUnread: number; blogRevision: number; chatRevision: number;
  markBlogSeen: (ids: string[]) => void; setActiveChatRoom: (id: string | null) => void; refreshChat: () => void };
const Context = createContext<State>({ chatRooms: null, blogUnread: 0, chatUnread: 0, blogRevision: 0, chatRevision: 0,
  markBlogSeen: () => {}, setActiveChatRoom: () => {}, refreshChat: () => {} });
export const useCommunication = () => useContext(Context);

export function CommunicationProvider({ children }: React.PropsWithChildren) {
  const { user, loading } = useSession();
  const navigation = useRootNavigationState();
  const [pendingChat, setPendingChat] = useState<ChatPush | null>(null);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const scope = user ? `${api.getOrigin()}|${user.companyCode}|${user.uid}` : "";
  const key = `luxcare.blog.seen.${encodeURIComponent(scope).replace(/%/g, "_")}`;
  const [blogRevision, setBlogRevision] = useState(0);
  const [chatRevision, setChatRevision] = useState(0);
  const [chatRefresh, setChatRefresh] = useState(0);
  const [chatCount, setChatCount] = useState<{ scope: string; count: number; rooms: ChatRoom[] }>({ scope: "", count: 0, rooms: [] });
  const [snapshot, setSnapshot] = useState<{ scope: string; posts: BlogPost[] } | null>(null);
  const [seen, setSeen] = useState<{ scope: string; ids: string[] | null } | null>(null);
  const [banner, setBanner] = useState<{ scope: string; title: string; body: string; roomId?: string } | null>(null);
  const activeRoom = useRef<string | null>(null);
  const path = useRef(pathname); path.current = pathname;
  const delivered = useRef(new Set<string>());
  const writes = useRef(Promise.resolve());
  const refreshChat = useCallback(() => setChatRefresh(v => v + 1), []);
  const setActiveChatRoom = useCallback((id: string | null) => { activeRoom.current = id; }, []);
  const save = useCallback((ids: string[]) => {
    if (!scope) return;
    const unique = mergeBlogSeen([], ids);
    setSeen({ scope, ids: unique });
    writes.current = writes.current.catch(() => {}).then(async () => {
      if (Platform.OS === "web") globalThis.localStorage?.setItem(key, JSON.stringify(unique));
      else await SecureStore.setItemAsync(key, JSON.stringify(unique));
    }).catch(() => {});
  }, [scope, key]);
  const markBlogSeen = useCallback((ids: string[]) => {
    if (seen?.scope !== scope || snapshot?.scope !== scope || ids.length === 0) return;
    // Retain the read state of the badge's current feed, even when viewing an older channel.
    const feedIds = new Set(snapshot.posts.map(post => post.id));
    const next = [...new Set([...(seen.ids || []), ...ids])].filter(id => feedIds.has(id));
    if (next.length === seen.ids?.length && next.every(id => seen.ids!.includes(id))) return;
    save(next);
  }, [seen, snapshot, scope, save]);

  useEffect(() => {
    let active = true;
    activeRoom.current = null; delivered.current.clear(); setBanner(null);
    if (!scope) return;
    void (async () => {
      try {
        await writes.current;
        const raw = Platform.OS === "web" ? globalThis.localStorage?.getItem(key) : await SecureStore.getItemAsync(key);
        const parsed = raw ? JSON.parse(raw) : null;
        if (active) setSeen({ scope, ids: Array.isArray(parsed) ? parsed.filter(id => typeof id === "string").slice(-50) : null });
      } catch { if (active) setSeen({ scope, ids: null }); }
    })();
    return () => { active = false; };
  }, [scope, key]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const timer = setTimeout(() => void blog.getPosts("all", true).then(posts => {
      if (active) setSnapshot({ scope, posts });
    }).catch(() => {}), 150);
    return () => { active = false; clearTimeout(timer); };
  }, [scope, blogRevision]);
  useEffect(() => {
    if (scope && seen?.scope === scope && seen.ids === null && snapshot?.scope === scope) save(snapshot.posts.map(p => p.id));
  }, [scope, seen, snapshot, save]);
  useEffect(() => {
    if (!canUseModule(user, "chat")) return;
    let active = true;
    const timer = setTimeout(() => void chat.getRooms().then(rooms => {
      if (active) setChatCount({ scope, rooms, count: rooms.reduce((sum, room) => sum + (room.unreadCount || 0), 0) });
    }).catch(() => {
      // End the initial loading state on failure, but preserve a valid snapshot on refresh.
      if (active) setChatCount(previous => previous.scope === scope ? previous : { scope, count: 0, rooms: [] });
    }), 150);
    return () => { active = false; clearTimeout(timer); };
  }, [scope, chatRefresh, user?.enabledModules]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const showChat = async (messageId: string, roomId: string, title: string, body: string) => {
      try {
        const room = await chat.getRoomById(roomId);
        if (!active || room.companyCode !== user.companyCode || chatNotificationsMuted(room, user.uid) ||
            activeRoom.current === roomId) return;
        if (room.lastMessage?._id === messageId && room.lastMessage.readBy?.includes(user.uid)) return;
        show(`chat:${messageId}`, room.isGroup ? room.name || title : title, body, roomId);
      } catch { /* Missing membership or offline: never expose an unverified alert. */ }
    };
    const show = (id: string, title: string, body: string, roomId?: string) => {
      if (delivered.current.has(id)) return;
      delivered.current.add(id);
      if (delivered.current.size > 200) delivered.current.delete(delivered.current.values().next().value!);
      if (AppState.currentState === "active") {
        setBanner({ scope, title, body, roomId });
        playNotificationSound();
      }
    };
    const removers = [socketService.subscribe("internal_new_message", event => {
      if (!canUseModule(user, "chat")) return;
      refreshChat(); setChatRevision(v => v + 1);
      const message = event?.message;
      const sender = typeof message?.senderId === "string" ? message.senderId : message?.senderId?._id;
      if (!message?._id || sender === user.uid || activeRoom.current === event.roomId) return;
      if (event.roomUpdate?.companyCode && event.roomUpdate.companyCode !== user.companyCode) return;
      void showChat(message._id, event.roomId, message.senderName || "Tin nhắn mới", message.content || "Đã gửi tệp đính kèm");
    }), socketService.subscribe("blog_post_created", post => {
      if (post?.companyCode !== user.companyCode && post?.companyCode !== "SYSTEM") return;
      setBlogRevision(v => v + 1);
      if (post?.authorId !== user.uid && post?.id && !path.current.endsWith("/blog"))
        show(`blog:${post.id}`, "Blog có bài viết mới", post.title || "Có nội dung mới trong Blog");
    })];
    for (const event of ["blog_post_deleted", "blog_post_pinned", "blog_post_liked"]) removers.push(socketService.subscribe(event, () => setBlogRevision(v => v + 1)));
    for (const event of ["internal_room_updated", "internal_room_deleted", "internal_message_deleted", "internal_message_edited", "internal_message_reaction"])
      removers.push(socketService.subscribe(event, () => { refreshChat(); setChatRevision(v => v + 1); }));
    removers.push(socketService.subscribe("internal_messages_read", refreshChat));
    removers.push(socketService.subscribe("internal_room_updated", room => {
      if (room?.members && chatNotificationsMuted(room, user.uid))
        setBanner(previous => previous?.roomId === room._id ? null : previous);
    }));
    const nativeReceived = Notifications?.addNotificationReceivedListener((notification: any) => {
      const content = notification.request.content;
      const data = parseChatPush(content.data);
      if (!data || data.recipientUid !== user.uid || data.companyCode !== user.companyCode || !canUseModule(user, "chat")) return;
      refreshChat(); setChatRevision(v => v + 1);
      void showChat(data.messageId, data.roomId, content.title || "Tin nhắn mới", content.body || "");
    });
    const sync = () => { refreshChat(); setChatRevision(v => v + 1); setBlogRevision(v => v + 1); };
    removers.push(socketService.subscribe("connect", sync));
    const state = AppState.addEventListener("change", value => { if (value === "active") sync(); });
    return () => { active = false; nativeReceived?.remove(); removers.forEach(off => off()); state.remove(); };
  }, [scope, user?.enabledModules, refreshChat]);
  useEffect(() => {
    if (!Notifications) return;
    const response = Notifications.getLastNotificationResponse();
    if (response) setPendingChat(parseChatPush(response.notification.request.content.data));
    const listener = Notifications.addNotificationResponseReceivedListener((event: any) => {
      const data = parseChatPush(event.notification.request.content.data);
      if (data) setPendingChat(data);
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (!pendingChat || loading || !user || !navigation?.key) return;
    let active = true;
    if (pendingChat.recipientUid !== user.uid || pendingChat.companyCode !== user.companyCode || !canUseModule(user, "chat")) {
      setPendingChat(null);
      return;
    }
    void chat.getRoomById(pendingChat.roomId).then(room => {
      if (active && room.companyCode === user.companyCode)
        router.push({ pathname: "/(tabs)/chat", params: { roomId: room._id } });
    }).catch(() => {}).finally(() => {
      if (active) {
        setPendingChat(null);
        void Notifications?.clearLastNotificationResponseAsync().catch(() => {});
      }
    });
    return () => { active = false; };
  }, [pendingChat, loading, scope, navigation?.key, user?.enabledModules]);
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(timer);
  }, [banner]);
  const blogUnread = snapshot?.scope === scope && seen?.scope === scope && seen.ids !== null
    ? countBlogUnread(snapshot.posts, seen.ids, user?.uid || "") : 0;
  const chatUnread = chatCount.scope === scope && canUseModule(user, "chat") ? chatCount.count : 0;
  const chatRooms = chatCount.scope === scope && canUseModule(user, "chat") ? chatCount.rooms : null;
  const value = useMemo(() => ({ chatRooms, blogUnread, chatUnread, blogRevision, chatRevision, markBlogSeen, setActiveChatRoom, refreshChat }),
    [chatRooms, blogUnread, chatUnread, blogRevision, chatRevision, markBlogSeen, setActiveChatRoom, refreshChat]);
  return <Context.Provider value={value}>
    {children}
    {banner?.scope === scope && user && (
      <RealtimeNotificationToast
        banner={{
          title: banner.title,
          body: banner.body,
          data: {
            action: {
              tab: banner.roomId ? "chat" : "blog",
              subTab: banner.roomId ? "Trò chuyện" : "Bản tin",
            },
          },
        }}
        topInset={insets.top}
        onPress={() => {
          router.push(
            banner.roomId
              ? { pathname: "/(tabs)/chat", params: { roomId: banner.roomId } }
              : "/(tabs)/blog"
          );
          setBanner(null);
        }}
        onDismiss={() => setBanner(null)}
      />
    )}
  </Context.Provider>;
}
