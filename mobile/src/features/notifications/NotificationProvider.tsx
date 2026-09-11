import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState, Linking, Platform, Pressable, Text, View } from "react-native";
import type { NotificationPermissionsStatus } from "expo-notifications";
import { nativeNotifications as Notifications, nativeNotificationsUnavailableReason } from "./nativeNotifications";
import Constants from "expo-constants";
import { router, useRootNavigationState } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, notifications } from "../../api/services";
import { socketService } from "../../api/socketService";
import { useSession } from "../../auth/SessionProvider";
import { notificationTarget } from "../navigation/notificationTarget";
import { belongsToUser, parseNoticePayload, type NoticePayload } from "./payload";
import { RealtimeNotificationToast } from "./RealtimeNotificationToast";

// Foreground presentation is owned by the same banner for socket and push events.
if (Notifications) Notifications.setNotificationHandler({ handleNotification: async () => ({
  shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false,
}) });

type State = { revision: number; unreadCount: number; refresh: () => void; permissionDenied: boolean; pushError: string | null };
const Context = createContext<State>({ revision: 0, unreadCount: 0, refresh: () => {}, permissionDenied: false, pushError: null });
export const useNotifications = () => useContext(Context);
let permissionRequest: Promise<NotificationPermissionsStatus> | undefined;
async function initialPermission() {
  if (!Notifications) throw new Error("Native notifications are unavailable in this runtime");
  if (!permissionRequest) permissionRequest = (async () => {
    if (Platform.OS === "android") await Notifications.setNotificationChannelAsync("default", {
      name: "Thông báo LuxCare", importance: Notifications.AndroidImportance.HIGH,
    });
    const permission = await Notifications.getPermissionsAsync();
    return permission.status === "undetermined" && permission.canAskAgain
      ? Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } })
      : permission;
  })().catch(error => { permissionRequest = undefined; throw error; });
  return permissionRequest;
}
const allowed = (p: NotificationPermissionsStatus) => p.granted || (Notifications !== null && p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);

export function NotificationProvider({ children }: React.PropsWithChildren) {
  const { user, loading } = useSession();
  const navigation = useRootNavigationState();
  const insets = useSafeAreaInsets();
  const [revision, setRevision] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permissionDenied, setDenied] = useState(false);
  const [pushError, setPushError] = useState<string | null>(nativeNotificationsUnavailableReason);
  const [pending, setPending] = useState<NoticePayload | null>(null);
  const [banner, setBanner] = useState<{ data: NoticePayload; title: string; body: string } | null>(null);
  const currentUser = useRef(user);
  currentUser.current = user;
  const seen = useRef(new Set<string>());
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => {
    if (Notifications) void initialPermission().then(p => setDenied(!allowed(p)))
      .catch(() => setPushError("Không thể kiểm tra quyền thông báo. Hãy thử mở lại ứng dụng."));
  }, []);

  useEffect(() => {
    let active = true;
    if (!user) { setUnreadCount(0); return; }
    const timer = setTimeout(() => void notifications.getNotifications({ limit: 1 }).then(result => {
      if (active) setUnreadCount(result.unreadCount);
    }).catch(() => {}), 150);
    return () => { active = false; clearTimeout(timer); };
  }, [user?.uid, user?.companyCode, revision]);

  useEffect(() => {
    if (Notifications) void Notifications.setBadgeCountAsync(unreadCount).catch(() => {});
  }, [unreadCount]);

  useEffect(() => {
    seen.current.clear();
    setUnreadCount(0);
    setBanner(null);
    setPushError(nativeNotificationsUnavailableReason);
    let active = true;
    let registering = false;
    let registeredToken: string | null = null;
    if (!user && !loading && Notifications) {
      void Notifications.dismissAllNotificationsAsync().catch(() => {});
    }
    async function register() {
      if (!Notifications || !user || registering) return;
      registering = true;
      try {
        await initialPermission();
        const permission = await Notifications.getPermissionsAsync();
        if (!active) return;
        setDenied(!allowed(permission));
        if (!allowed(permission)) {
          if (registeredToken) {
            await api.transport.fetch("/api/v1/push/devices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: registeredToken }) });
            registeredToken = null;
          }
          return;
        }
        const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) { setPushError("Thông báo nền chưa được cấu hình cho bản ứng dụng này."); return; }
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        if (!active) return;
        const response = await api.transport.fetch("/api/v1/push/devices", { method: "POST",
          headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, platform: Platform.OS }) });
        if (!response.ok) throw new Error("registration failed");
        const previousToken = registeredToken;
        registeredToken = token;
        if (active && previousToken && previousToken !== token) {
          await api.transport.fetch("/api/v1/push/devices", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: previousToken }) });
        }
        if (active) setPushError(null);
      } catch { if (active) setPushError("Chưa đăng ký được thông báo nền. Ứng dụng sẽ thử lại khi kết nối lại."); }
      finally { registering = false; }
    }
    void register();
    const removeConnect = socketService.subscribe("connect", () => { refresh(); void register(); });
    const stateListener = AppState.addEventListener("change", state => {
      if (state === "active") {
        const token = api.getAccessToken();
        if (token && user) socketService.connect(token);
        refresh(); void register();
      } else if (state === "background") {
        socketService.disconnect();
      }
    });
    const tokenListener = Notifications ? Notifications.addPushTokenListener(() => void register()) : null;
    return () => { active = false; removeConnect(); stateListener.remove(); tokenListener?.remove(); };
  }, [user?.uid, user?.companyCode, refresh]);

  useEffect(() => {
    const receive = (raw: unknown, title: unknown, body: unknown) => {
      const data = parseNoticePayload(raw);
      if (!data || !belongsToUser(data, currentUser.current)) return;
      refresh();
      if (seen.current.has(data.notificationId)) return;
      seen.current.add(data.notificationId);
      if (seen.current.size > 200) seen.current.delete(seen.current.values().next().value!);
      if (AppState.currentState === "active") setBanner({ data,
        title: typeof title === "string" ? title : "Thông báo LuxCare", body: typeof body === "string" ? body : "" });
    };
    const off = socketService.subscribe("new_notification", raw => receive(raw, raw?.title, raw?.body));
    const offChanged = socketService.subscribe("notifications:changed", refresh);
    if (!Notifications) return () => { off(); offChanged(); };
    const received = Notifications.addNotificationReceivedListener(n => receive(n.request.content.data, n.request.content.title, n.request.content.body));
    const response = Notifications.addNotificationResponseReceivedListener(r => setPending(parseNoticePayload(r.notification.request.content.data)));
    const initial = Notifications.getLastNotificationResponse();
    if (initial) setPending(parseNoticePayload(initial.notification.request.content.data));
    return () => { off(); offChanged(); received.remove(); response.remove(); };
  }, [refresh]);

  useEffect(() => {
    if (!pending || loading || !user || !navigation?.key) return;
    setPending(null);
    if (Notifications) void Notifications.clearLastNotificationResponseAsync().catch(() => {});
    if (!belongsToUser(pending, user)) return;
    const target = notificationTarget(pending, user);
    router.push(target.target?.href || "/(tabs)/notifications");
    void notifications.markAsRead(pending.notificationId).then(refresh).catch(() => {});
  }, [pending, loading, user, navigation?.key, refresh]);

  useEffect(() => {
    if (!banner) return;
    const timer = setTimeout(() => setBanner(null), 12000);
    return () => clearTimeout(timer);
  }, [banner]);

  return <Context.Provider value={{ revision, unreadCount, refresh, permissionDenied, pushError }}>
    {children}
    {banner && user && (
      <RealtimeNotificationToast
        banner={banner}
        topInset={insets.top}
        onPress={() => {
          setPending(banner.data);
          setBanner(null);
        }}
        onDismiss={() => setBanner(null)}
      />
    )}
  </Context.Provider>;
}

export function NotificationPermissionNotice() {
  const { permissionDenied, pushError } = useNotifications();
  if (!permissionDenied && !pushError) return null;
  return <View style={{ padding: 12, backgroundColor: "#fffbeb" }}>
    <Text>{permissionDenied ? "Thông báo đang tắt. Bật trong Cài đặt để nhận thông báo khi không mở ứng dụng." : pushError}</Text>
    {permissionDenied && <Pressable onPress={() => void Linking.openSettings()}><Text style={{ color: "#065f46", marginTop: 8 }}>Mở Cài đặt</Text></Pressable>}
  </View>;
}
