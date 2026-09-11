import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Platform, Pressable, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, blog, chat } from "../../api/services";
import { socketService } from "../../api/socketService";
import { useSession } from "../../auth/SessionProvider";
import { canUseModule } from "../../auth/access";
import type { BlogPost } from "../../../../src/services/blogService";
import { countBlogUnread, mergeBlogSeen } from "./communicationState";
export { communicationBadge } from "./communicationState";

type State = { blogUnread: number; chatUnread: number; blogRevision: number; chatRevision: number;
  markBlogSeen: (ids: string[]) => void; setActiveChatRoom: (id: string | null) => void; refreshChat: () => void };
const Context = createContext<State>({ blogUnread: 0, chatUnread: 0, blogRevision: 0, chatRevision: 0,
  markBlogSeen: () => {}, setActiveChatRoom: () => {}, refreshChat: () => {} });
export const useCommunication = () => useContext(Context);

export function CommunicationProvider({ children }: React.PropsWithChildren) {
  const { user } = useSession();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const scope = user ? `${api.getOrigin()}|${user.companyCode}|${user.uid}` : "";
  const key = `luxcare.blog.seen.${encodeURIComponent(scope).replace(/%/g, "_")}`;
  const [blogRevision, setBlogRevision] = useState(0);
  const [chatRevision, setChatRevision] = useState(0);
  const [chatRefresh, setChatRefresh] = useState(0);
  const [chatCount, setChatCount] = useState({ scope: "", count: 0 });
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
    if (seen?.scope !== scope) return;
    if (ids.every(id => seen.ids?.includes(id))) return;
    save([...(seen.ids || []), ...ids]);
  }, [seen, scope, save]);

  useEffect(() => {
    let active = true;
    activeRoom.current = null; delivered.current.clear(); setBanner(null);
    if (!scope) return;
    void (async () => {
      try {
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
      if (active) setChatCount({ scope, count: rooms.reduce((sum, room) => sum + (room.unreadCount || 0), 0) });
    }).catch(() => {}), 150);
    return () => { active = false; clearTimeout(timer); };
  }, [scope, chatRefresh, user?.enabledModules]);

  useEffect(() => {
    if (!user) return;
    const show = (id: string, title: string, body: string, roomId?: string) => {
      if (delivered.current.has(id)) return;
      delivered.current.add(id);
      if (delivered.current.size > 200) delivered.current.delete(delivered.current.values().next().value!);
      if (AppState.currentState === "active") setBanner({ scope, title, body, roomId });
    };
    const removers = [socketService.subscribe("internal_new_message", event => {
      if (!canUseModule(user, "chat")) return;
      refreshChat(); setChatRevision(v => v + 1);
      const message = event?.message;
      const sender = typeof message?.senderId === "string" ? message.senderId : message?.senderId?._id;
      if (!message?._id || sender === user.uid || activeRoom.current === event.roomId) return;
      if (event.roomUpdate?.companyCode && event.roomUpdate.companyCode !== user.companyCode) return;
      show(`chat:${message._id}`, message.senderName || "Tin nhắn mới", message.content || "Đã gửi tệp đính kèm", event.roomId);
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
    const sync = () => { refreshChat(); setChatRevision(v => v + 1); setBlogRevision(v => v + 1); };
    removers.push(socketService.subscribe("connect", sync));
    const state = AppState.addEventListener("change", value => { if (value === "active") sync(); });
    return () => { removers.forEach(off => off()); state.remove(); };
  }, [scope, user?.enabledModules, refreshChat]);
  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(timer);
  }, [banner]);
  const blogUnread = snapshot?.scope === scope && seen?.scope === scope && seen.ids !== null
    ? countBlogUnread(snapshot.posts, seen.ids, user?.uid || "") : 0;
  const chatUnread = chatCount.scope === scope && canUseModule(user, "chat") ? chatCount.count : 0;
  return <Context.Provider value={{ blogUnread, chatUnread, blogRevision, chatRevision, markBlogSeen, setActiveChatRoom, refreshChat }}>
    {children}
    {banner?.scope === scope && user && <View style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, borderRadius: 16, padding: 16, backgroundColor: "#065f46", zIndex: 2100, elevation: 21 }}>
      <Pressable onPress={() => {
        router.push(banner.roomId ? { pathname: "/(tabs)/chat", params: { roomId: banner.roomId } } : "/(tabs)/blog"); setBanner(null);
      }}><Text style={{ color: "white", fontWeight: "700" }}>{banner.title}</Text><Text numberOfLines={2} style={{ color: "white" }}>{banner.body}</Text></Pressable>
      <Pressable accessibilityLabel="Đóng thông báo" onPress={() => setBanner(null)}><Text style={{ color: "white", marginTop: 8 }}>Đóng</Text></Pressable>
    </View>}
  </Context.Provider>;
}
