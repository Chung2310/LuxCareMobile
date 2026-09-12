import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type {
  GetNotificationsResponse,
  NotifType,
  WebNotification,
} from "../../../src/services/notificationService";
import { notifications } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { notificationTarget } from "../../src/features/navigation/notificationTarget";
import { useNotifications, NotificationPermissionNotice } from "../../src/features/notifications/NotificationProvider";
import { detectNotificationCategory } from "../../src/features/notifications/category";

function formatNotificationTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return isoString;
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays === 1) {
      const hours = String(date.getHours()).padStart(2, "0");
      const mins = String(date.getMinutes()).padStart(2, "0");
      return `Hôm qua ${hours}:${mins}`;
    }
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const mins = String(date.getMinutes()).padStart(2, "0");
    if (year === now.getFullYear()) {
      return `${day}/${month} ${hours}:${mins}`;
    }
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return isoString;
  }
}

export default function Notifications() {
  const notificationState = useNotifications();
  const { user } = useSession();
  const lock = useRef(false);

  const [type, setType] = useState<"" | NotifType>("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [data, setData] = useState<GetNotificationsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);

      void notifications
        .getNotifications({
          page,
          limit: 20,
          ...(unreadOnly ? { read: false } : {}),
          ...(type ? { type } : {}),
        })
        .then((value) => {
          if (active) setData(value);
        })
        .catch((err) => {
          if (active) setError(messageOf(err));
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, unreadOnly, type, revision, user?.uid, notificationState.revision]),
  );

  const mutate = async (action: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      notificationState.refresh();
      setRevision((v) => v + 1);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const openNotification = async (item: WebNotification) => {
    const destination = notificationTarget(item, user);
    if (!destination.target) {
      if (!item.read) {
        await mutate(() => notifications.markAsRead(item._id));
      } else if (destination.reason) {
        Alert.alert("Thông báo", destination.reason);
      }
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!item.read) {
        await notifications.markAsRead(item._id);
        notificationState.refresh();
        setRevision((v) => v + 1);
      }
      router.push(destination.target.href);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const handleMarkAllRead = () => {
    if (busy || !data?.unreadCount) return;
    Alert.alert(
      "Đánh dấu đã đọc",
      `Bạn có muốn đánh dấu toàn bộ ${data.unreadCount} thông báo chưa đọc thành đã đọc?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đồng ý",
          onPress: () => void mutate(() => notifications.markAllAsRead()),
        },
      ],
    );
  };

  const totalPages = data ? Math.ceil(data.total / data.limit) || 1 : 1;
  const unreadCount = data?.unreadCount || 0;

  const filterTabs: Array<{
    id: string;
    label: string;
    icon: React.ComponentProps<typeof Ionicons>["name"];
    badge?: number;
  }> = [
    { id: "all", label: "Tất cả", icon: "grid-outline" },
    { id: "unread", label: "Chưa đọc", icon: "mail-unread-outline", badge: unreadCount },
    { id: "task", label: "Công việc", icon: "briefcase-outline" },
    { id: "training", label: "Đào tạo", icon: "school-outline" },
    { id: "kho", label: "Vật tư & Dược phẩm", icon: "cube-outline" },
    { id: "he-thong", label: "Hệ thống", icon: "settings-outline" },
  ];

  const currentTab = unreadOnly ? "unread" : type || "all";

  const handleSelectTab = (tabId: string) => {
    if (busy) return;
    setPage(1);
    if (tabId === "all") {
      setUnreadOnly(false);
      setType("");
    } else if (tabId === "unread") {
      setUnreadOnly(true);
      setType("");
    } else {
      setUnreadOnly(false);
      setType(tabId as NotifType);
    }
  };

  const renderItem = ({ item }: { item: WebNotification }) => {
    const categoryInfo = detectNotificationCategory(item.title, item.body, item.action);
    const destination = item.action ? notificationTarget(item, user) : null;
    const isUnread = !item.read;

    return (
      <Pressable
        style={({ pressed }) => [
          styles.card,
          isUnread ? styles.cardUnread : styles.cardRead,
          pressed && styles.cardPressed,
        ]}
        onPress={() => void openNotification(item)}
      >
        <View style={styles.cardRow}>
          {/* Left: Category Icon */}
          <View
            style={[
              styles.typeIconBox,
              { backgroundColor: categoryInfo.bg },
            ]}
          >
            <Ionicons name={categoryInfo.iconName} size={16} color={categoryInfo.color} />
          </View>

          {/* Right: Main Content */}
          <View style={styles.cardMain}>
            {/* Row 1: Title + Unread dot & Delete */}
            <View style={styles.cardTitleRow}>
              <Text
                style={[styles.itemTitle, isUnread && styles.itemTitleUnread]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <View style={styles.titleActions}>
                {isUnread && <View style={styles.unreadDot} />}
                <Pressable
                  style={({ pressed }) => [styles.deleteIconBtn, pressed && { opacity: 0.5 }]}
                  hitSlop={8}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    Alert.alert(
                      "Xóa thông báo",
                      `Bạn có chắc muốn xóa thông báo "${item.title}"?`,
                      [
                        { text: "Hủy", style: "cancel" },
                        {
                          text: "Xóa",
                          style: "destructive",
                          onPress: () => void mutate(() => notifications.deleteNotification(item._id)),
                        },
                      ],
                    );
                  }}
                >
                  <Ionicons name="trash-outline" size={13} color="#94a3b8" />
                </Pressable>
              </View>
            </View>

            {/* Row 2: Body text */}
            {!!item.body && (
              <Text style={styles.itemBody} numberOfLines={2}>
                {item.body}
              </Text>
            )}

            {/* Row 3: Category • Time and Quick Action */}
            <View style={styles.cardMetaRow}>
              <View style={styles.metaLeft}>
                <Text style={[styles.categoryText, { color: categoryInfo.color }]}>
                  {categoryInfo.label}
                </Text>
                <Text style={styles.metaDot}>•</Text>
                <Text style={styles.timeText}>
                  {formatNotificationTime(item.createdAt)}
                </Text>
              </View>

              {destination?.target ? (
                <View style={styles.destinationLink}>
                  <Text style={styles.destinationLinkText}>{destination.target.label}</Text>
                  <Ionicons name="chevron-forward" size={11} color="#059669" />
                </View>
              ) : isUnread ? (
                <Pressable
                  style={({ pressed }) => [styles.quickReadBtn, pressed && { opacity: 0.6 }]}
                  hitSlop={6}
                  onPress={(e) => {
                    e.stopPropagation?.();
                    void mutate(() => notifications.markAsRead(item._id));
                  }}
                >
                  <Ionicons name="checkmark-done" size={12} color="#059669" />
                  <Text style={styles.quickReadBtnText}>Đã đọc</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <NotificationPermissionNotice />
      {/* Screen Header Bar */}
      <View style={styles.header}>
        <View style={styles.headerTitleCol}>
          <Text style={styles.headerTitle}>Thông báo</Text>
          <Text style={styles.headerSubtitle}>
            {unreadCount > 0
              ? `${unreadCount} thông báo chưa đọc`
              : "Bạn đã xem hết thông báo mới"}
          </Text>
        </View>

        {unreadCount > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.markAllBtn,
              busy && { opacity: 0.5 },
              pressed && { opacity: 0.8 },
            ]}
            disabled={busy}
            onPress={handleMarkAllRead}
          >
            <Ionicons name="checkmark-done" size={15} color="#059669" />
            <Text style={styles.markAllBtnText}>Đọc hết</Text>
          </Pressable>
        )}
      </View>

      {/* Filter Tabs Bar */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {filterTabs.map((tab) => {
            const active = currentTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                style={({ pressed }) => [
                  styles.filterPill,
                  active && styles.filterPillActive,
                  pressed && styles.filterPillPressed,
                ]}
                onPress={() => handleSelectTab(tab.id)}
                disabled={busy}
              >
                {tab.icon && (
                  <Ionicons
                    name={tab.icon}
                    size={15}
                    color={active ? "#ffffff" : "#64748b"}
                    style={styles.filterPillIcon}
                  />
                )}
                <Text
                  style={[
                    styles.filterPillText,
                    active && styles.filterPillTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
                {typeof tab.badge === "number" && tab.badge > 0 && (
                  <View
                    style={[
                      styles.filterBadge,
                      active && styles.filterBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterBadgeText,
                        active && styles.filterBadgeTextActive,
                      ]}
                    >
                      {tab.badge > 99 ? "99+" : tab.badge}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Error Notice */}
      {!!error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>⚠️ {error}</Text>
        </View>
      )}

      {/* Notifications FlatList */}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={data?.data || []}
        keyExtractor={(item) => item._id}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => setRevision((v) => v + 1)}
            colors={["#059669"]}
            tintColor="#059669"
          />
        }
        renderItem={renderItem}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.emptyText}>Đang tải thông báo...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBox}>
                <Ionicons name="notifications-outline" size={28} color="#94a3b8" />
              </View>
              <Text style={styles.emptyTitle}>Chưa có thông báo nào</Text>
              <Text style={styles.emptySub}>
                {unreadOnly
                  ? "Bạn không có thông báo chưa đọc nào."
                  : type
                  ? "Chưa có thông báo nào trong danh mục này."
                  : "Khi có phân công công việc hoặc thông tin mới, thông báo sẽ hiển thị ở đây."}
              </Text>
              <Pressable
                style={styles.refreshBtn}
                onPress={() => setRevision((v) => v + 1)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Ionicons name="reload-outline" size={14} color="#334155" />
                  <Text style={styles.refreshBtnText}>Làm mới</Text>
                </View>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          data && data.total > data.limit ? (
            <View style={styles.paginationCard}>
              <Pressable
                style={[styles.pageBtn, (page === 1 || loading || busy) && styles.pageBtnDisabled]}
                disabled={page === 1 || loading || busy}
                onPress={() => setPage((v) => Math.max(1, v - 1))}
              >
                <Text
                  style={[
                    styles.pageBtnText,
                    (page === 1 || loading || busy) && styles.pageBtnTextDisabled,
                  ]}
                >
                  ‹ Trang trước
                </Text>
              </Pressable>

              <Text style={styles.pageInfoText}>
                Trang <Text style={styles.pageInfoBold}>{page}</Text> / {totalPages}
              </Text>

              <Pressable
                style={[
                  styles.pageBtn,
                  (page >= totalPages || loading || busy) && styles.pageBtnDisabled,
                ]}
                disabled={page >= totalPages || loading || busy}
                onPress={() => setPage((v) => v + 1)}
              >
                <Text
                  style={[
                    styles.pageBtnText,
                    (page >= totalPages || loading || busy) && styles.pageBtnTextDisabled,
                  ]}
                >
                  Trang sau ›
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ height: 20 }} />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerTitleCol: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    fontWeight: "500",
  },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  markAllBtnIcon: {
    color: "#059669",
    fontSize: 13,
    fontWeight: "800",
  },
  markAllBtnText: {
    color: "#059669",
    fontSize: 13,
    fontWeight: "700",
  },
  filterBar: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  filterScroll: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    alignItems: "center",
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterPillActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 4,
    elevation: 2,
  },
  filterPillPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  filterPillIcon: {
    marginRight: 6,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  filterPillTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  filterBadge: {
    backgroundColor: "#fee2e2",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    marginLeft: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeActive: {
    backgroundColor: "rgba(255, 255, 255, 0.28)",
  },
  filterBadgeText: {
    color: "#dc2626",
    fontSize: 11,
    fontWeight: "700",
  },
  filterBadgeTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  errorBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorBannerText: {
    fontSize: 13,
    color: "#b91c1c",
    fontWeight: "500",
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 20,
    gap: 7,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
    overflow: "hidden",
  },
  cardUnread: {
    borderColor: "#bbf7d0",
    backgroundColor: "#ffffff",
    shadowColor: "#059669",
    shadowOpacity: 0.06,
    shadowRadius: 5,
    elevation: 1.5,
  },
  cardRead: {
    backgroundColor: "#ffffff",
    opacity: 0.9,
  },
  cardPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.99 }],
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  typeIconBox: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  cardMain: {
    flex: 1,
    gap: 2.5,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  itemTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#1e293b",
    flex: 1,
    lineHeight: 18,
  },
  itemTitleUnread: {
    fontWeight: "700",
    color: "#0f172a",
  },
  titleActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#059669",
  },
  deleteIconBtn: {
    padding: 2,
  },
  itemBody: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 16.5,
  },
  cardMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  metaLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "700",
  },
  metaDot: {
    fontSize: 9,
    color: "#cbd5e1",
  },
  timeText: {
    fontSize: 11,
    color: "#94a3b8",
    fontWeight: "500",
  },
  destinationLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#f0fdf4",
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  destinationLinkText: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "600",
  },
  quickReadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    borderRadius: 5,
  },
  quickReadBtnText: {
    color: "#059669",
    fontSize: 11,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    paddingHorizontal: 20,
    gap: 10,
  },
  emptyIconBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e293b",
  },
  emptySub: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  emptyText: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 8,
  },
  refreshBtn: {
    marginTop: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  refreshBtnText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  paginationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    marginTop: 4,
  },
  pageBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  pageBtnTextDisabled: {
    color: "#94a3b8",
  },
  pageInfoText: {
    fontSize: 13,
    color: "#64748b",
  },
  pageInfoBold: {
    fontWeight: "700",
    color: "#0f172a",
  },
});
