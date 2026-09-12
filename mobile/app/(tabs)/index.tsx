import { attendanceDay, loadDashboardSnapshot } from "../../src/features/dashboard/snapshot";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type {
  DashboardSummary,
  DashboardActionItems,
  DashboardDateFilter,
} from "../../../src/types/dashboard";
import type { DashboardSummaryParams } from "../../../src/services/dashboardService";
import { dashboard, attendance, roster } from "../../src/api/services";
import type { TodayAttendance } from "../../../src/services/attendanceService";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { useCommunication, communicationBadge } from "../../src/features/notifications/CommunicationProvider";
import { canUseModule } from "../../src/auth/access";
import { useAppLoading } from "../../src/context/LoadingContext";
import { DashboardOverviewSection } from "../../src/components/dashboard";
import { getAllServicesFlat, isServiceAccessible, LUXCARE_MODULES } from "../../src/components";
import { isBlogEditorUser } from "../../../src/utils/permissionUtils";
import { BranchSelector } from "../../src/features/branches/BranchSelector";
import { useChatUnread } from "../../src/context/ChatUnreadContext";
import { useNotifications } from "../../src/features/notifications/NotificationProvider";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface LuxCareFeature {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
  route: string;
  badge?: string;
  requiresModule?: "hr";
}

export default function Home() {
  const { blogUnread, chatUnread } = useCommunication();
  const { unreadCount, workUnread, refresh: refreshNotifications } = useNotifications();
  const { totalUnread: unreadChatCount } = useChatUnread();
  const badgeFor = (item: { route: string; badge?: string }) => communicationBadge(item.route, blogUnread, unreadChatCount || chatUnread, item.badge, workUnread);
  const { user, selectedBranch } = useSession();
  const { navigateWithLoading } = useAppLoading();
  const isOwner = ["admin", "superadmin", "branch_owner"].includes(user?.role || "");
  const isEditor = isBlogEditorUser(user);

  const [avatarError, setAvatarError] = useState(false);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.photoURL]);

  const avatarInitials = useMemo(() => {
    if (!user?.displayName?.trim()) return "LC";
    const parts = user.displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }, [user?.displayName]);

  const [data, setData] = useState<DashboardSummary | null>(null);
  const [attendanceSummary, setAttendanceSummary] = useState<DashboardSummary["timekeeping"] | null>(null);
  const [myAttendance, setMyAttendance] = useState<TodayAttendance | null>(null);
  const dashboardRequest = useRef(0);
  const [params, setParams] = useState<DashboardSummaryParams>({ filter: "day" });
  const [actions, setActions] = useState<DashboardActionItems | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // === Typewriter animation cho sub-text chào hỏi ===
  const TYPING_TEXT = "Chúc bạn một ngày làm việc thật hiệu quả!";
  const [typedText, setTypedText] = useState("");
  const typingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Nhấp nháy con trỏ
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(cursorOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    );
    blink.start();

    // Hàm gõ từng ký tự
    let idx = 0;
    const typeNext = () => {
      idx++;
      setTypedText(TYPING_TEXT.slice(0, idx));
      if (idx < TYPING_TEXT.length) {
        typingRef.current = setTimeout(typeNext, 55);
      } else {
        // Sau khi gõ xong, chờ 2.5s rồi reset
        typingRef.current = setTimeout(() => {
          idx = 0;
          setTypedText("");
          typingRef.current = setTimeout(typeNext, 300);
        }, 2500);
      }
    };
    typingRef.current = setTimeout(typeNext, 800); // Delay ban đầu

    return () => {
      blink.stop();
      if (typingRef.current) clearTimeout(typingRef.current);
    };
  }, []);
  // =====================================================

  const allowed =
    user?.role === "superadmin" ||
    user?.role === "admin" ||
    user?.role === "branch_owner" ||
    user?.role === "manager" ||
    (user?.permissions?.some((p) => p === "*" || p === "dashboard:read") ?? false);

  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const loadDashboardData = useCallback(async () => {
    const request = ++dashboardRequest.current;
    setData(null);
    setActions(null);
    setAttendanceSummary(null);
    setMyAttendance(null);
    setLoadingDashboard(false);
    if (isEditor) return;
    setLoadingDashboard(true);
    try {
      if (allowed) {
        const snapshot = await loadDashboardSnapshot(
          dashboard,
          params,
          new Date(),
          attendance,
          user?.companyCode,
          selectedBranch?._id,
          roster,
        );
        if (request !== dashboardRequest.current) return;
        setData(snapshot.summary);
        setActions(snapshot.actions);
        setAttendanceSummary(snapshot.attendance);
        setMyAttendance(snapshot.myAttendance);
      } else {
        const myToday = await attendance.today().catch(() => null);
        if (request !== dashboardRequest.current) return;
        setMyAttendance(myToday);
      }
    } finally {
      if (request === dashboardRequest.current) setLoadingDashboard(false);
    }
  }, [allowed, isEditor, params, user?.uid, user?.companyCode, selectedBranch?._id]);

  useFocusEffect(
    useCallback(() => {
      void loadDashboardData();
      refreshNotifications();
      let day = attendanceDay();
      const appState = AppState.addEventListener("change", (state) => {
        if (state === "active") void loadDashboardData();
      });
      const timer = setInterval(() => {
        const nextDay = attendanceDay();
        if (nextDay !== day) {
          day = nextDay;
          void loadDashboardData();
        }
      }, 60000);
      return () => {
        dashboardRequest.current++;
        appState.remove();
        clearInterval(timer);
      };
    }, [loadDashboardData, refreshNotifications]),
  );

  // 8 Chức năng cốt lõi (2 hàng x 4 cột) - Phong cách Super App tinh gọn, đầy đủ các mảng thiết yếu
  const luxcareServices: LuxCareFeature[] = useMemo(
    () => [
      {
        id: "attendance",
        title: "Chấm công\n& Ca trực",
        icon: "time",
        color: "#059669", // Emerald xanh lá LuxCare
        bgColor: "#ecfdf5",
        route: "/(tabs)/attendance",
      },
      {
        id: "leave",
        title: "Đơn từ\n& Nghỉ phép",
        icon: "receipt",
        color: "#7c3aed", // Tím violet nổi bật
        bgColor: "#f5f3ff",
        route: "/(tabs)/leave",
        badge: actions?.pendingApprovals.length ? `${actions.pendingApprovals.length}` : undefined,
      },
      {
        id: "work",
        title: "Việc của tôi\ncần làm",
        icon: "checkbox",
        color: "#2563eb", // Xanh dương cobalt
        bgColor: "#eff6ff",
        route: "/(tabs)/work",
        badge: actions?.overdueTasks.length ? `${actions.overdueTasks.length}` : undefined,
      },
      {
        id: "payslips",
        title: "Bảng lương",
        icon: "wallet",
        color: "#d97706", // Cam vàng amber
        bgColor: "#fffbeb",
        route: "/(tabs)/payslips",
      },
      {
        id: "inventory",
        title: "Vật tư\n& Dược phẩm",
        icon: "cube",
        color: "#dc2626", // Đỏ tươi nổi bật
        bgColor: "#fef2f2",
        route: "/(tabs)/inventory",
      },
      {
        id: "customers",
        title: "Khách hàng\n& Leads",
        icon: "people",
        color: "#059669", // Xanh emerald LuxCare
        bgColor: "#ecfdf5",
        route: "/(tabs)/customers",
      },
      {
        id: "chat",
        title: "Trò chuyện\nnội bộ",
        icon: "chatbubble-ellipses",
        color: "#ec4899", // Hồng pink năng động
        bgColor: "#fdf2f8",
        route: "/(tabs)/chat",
        badge: unreadChatCount > 0 ? (unreadChatCount > 99 ? "99+" : `${unreadChatCount}`) : undefined,
      },
      {
        id: "modules",
        title: "Tất cả\nchức năng",
        icon: "apps",
        color: "#6366f1", // Indigo tím xanh
        bgColor: "#eef2ff",
        route: "/(tabs)/modules",
      },
    ].filter((item) => item.id === "modules" || isServiceAccessible(item as any, user)) as LuxCareFeature[],
    [actions, user, unreadChatCount],
  );

  // Danh sách toàn bộ các tính năng để tìm kiếm toàn diện (đã lọc quyền)
  const allServicesFlat = useMemo(() => {
    const list = getAllServicesFlat(LUXCARE_MODULES, user);
    if (!unreadChatCount) return list;
    const badgeText = unreadChatCount > 99 ? "99+" : `${unreadChatCount}`;
    return list.map((item) =>
      item.route === "/(tabs)/chat" ? { ...item, badge: badgeText } : item
    );
  }, [user, unreadChatCount]);

  const isSearching = searchQuery.trim().length > 0;

  // Lọc theo tìm kiếm: Nếu không tìm kiếm -> hiển thị các dịch vụ chính được phép; Nếu đang tìm kiếm -> quét toàn bộ chức năng được phép
  const visibleServices = useMemo(() => {
    if (!isSearching) return luxcareServices;
    const q = searchQuery.toLowerCase().trim();
    return allServicesFlat.filter((item) =>
      `${item.title} ${item.subtitle || ""}`
        .toLowerCase()
        .replace(/\n/g, " ")
        .includes(q)
    );
  }, [allServicesFlat, isSearching, luxcareServices, searchQuery]);

  // 4 Icon LuxCare Đề Xuất (đã lọc theo quyền)
  const luxcareRecommendations = useMemo(
    () =>
      [
        {
          id: "overdue",
          title: "Việc gấp\nquá hạn",
          icon: "alert-circle",
          color: "#dc2626",
          route: "/(tabs)/work",
          badge: actions?.overdueTasks.length ? `${actions.overdueTasks.length}` : undefined,
        },
        {
          id: "leave-pending",
          title: "Đơn chờ\nxét duyệt",
          icon: "file-tray-full",
          color: "#0d9488",
          route: "/(tabs)/leave",
          badge: actions?.pendingApprovals.length ? `${actions.pendingApprovals.length}` : undefined,
        },
        {
          id: "projects",
          title: "Dự án\nđang chạy",
          icon: "git-network",
          color: "#0284c7",
          route: "/(tabs)/projects",
        },
        {
          id: "payslip",
          title: "Bảng lương",
          icon: "newspaper",
          color: "#059669",
          route: "/(tabs)/payslips",
        },
      ].filter((item) => isServiceAccessible(item as any, user)),
    [actions, user],
  );

  const pendingCount = (actions?.overdueTasks.length || 0) + (actions?.pendingApprovals.length || 0);

  if (isEditor) return <Redirect href="/(tabs)/blog" />;

  return (
    <View style={uiStyles.screen}>
      <ScrollView
        style={uiStyles.scrollView}
        contentContainerStyle={uiStyles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ============================================================ */}
        {/* KHỐI 1: HEADER NỀN GRADIENT XANH NGỌC LUXCARE CAO CẤP */}
        {/* ============================================================ */}
        <View style={uiStyles.luxcareHeaderContainer}>
          <SafeAreaView edges={["top"]} style={uiStyles.luxcareSafeArea}>
            {/* Top Bar: Search Bar + Notification Bell + User Avatar */}
            <View style={uiStyles.searchHeaderRow}>
              {/* Thanh tìm kiếm dịch vụ & tính năng */}
              <View style={uiStyles.homeSearchBar}>
                <Ionicons name="search" size={17} color="#059669" style={{ marginRight: 6 }} />
                <TextInput
                  style={uiStyles.homeSearchInput}
                  placeholder="Tìm dịch vụ, tính năng..."
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                    <Ionicons name="close-circle" size={16} color="#94a3b8" />
                  </Pressable>
                )}
              </View>

              <View style={uiStyles.headerRightIcons}>
                <Pressable
                  style={uiStyles.headerCircleBtn}
                  onPress={() => router.push("/(tabs)/notifications")}
                  accessibilityLabel="Thông báo"
                >
                  <Ionicons
                    name={unreadCount > 0 ? "notifications" : "notifications-outline"}
                    size={20}
                    color="#065f46"
                  />
                  {unreadCount > 0 && (
                    <View style={uiStyles.redBadge}>
                      <Text style={uiStyles.redBadgeText}>
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </Text>
                    </View>
                  )}
                </Pressable>

                <Pressable
                  style={uiStyles.avatarBtnWrapper}
                  onPress={() => router.push("/(tabs)/profile")}
                  accessibilityLabel="Tài khoản cá nhân"
                >
                  <View style={[uiStyles.headerCircleBtn, uiStyles.avatarCircle]}>
                    {user?.photoURL && !avatarError ? (
                      <Image
                        source={{ uri: user.photoURL }}
                        style={uiStyles.avatarImg}
                        resizeMode="cover"
                        onError={() => setAvatarError(true)}
                      />
                    ) : (
                      <Text style={uiStyles.avatarInitials}>{avatarInitials}</Text>
                    )}
                  </View>
                  <View style={uiStyles.onlineDot} />
                </Pressable>
              </View>
            </View>

            {/* Thẻ chào hỏi cá nhân – nền ảnh bg-hello-dashboard */}
            <ImageBackground
              source={require("../../public/bg-hello-dashboard.png")}
              style={uiStyles.greetingCard}
              imageStyle={uiStyles.greetingCardImage}
              resizeMode="cover"
            >
              {/* Hàng trên: tên + chip ngày bên phải */}
              <View style={uiStyles.greetingTopRow}>
                <View>
                  <Text style={uiStyles.greetingXinChao}>Xin chào,</Text>
                  <Text style={uiStyles.greetingName}>{user?.displayName || "bạn"}!</Text>
                </View>
                <View style={uiStyles.greetingDateChip}>
                  <Ionicons name="sunny" size={13} color="#f59e0b" />
                  <Text style={uiStyles.greetingDateText}>
                    {new Date().toLocaleDateString("vi-VN", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </Text>
                </View>
              </View>
              {/* Typewriter sub-text */}
              <View style={uiStyles.greetingSubRow}>
                <Text style={uiStyles.greetingSubText}>{typedText}</Text>
                <Animated.Text style={[uiStyles.greetingCursor, { opacity: cursorOpacity }]}>|</Animated.Text>
              </View>

              {/* Branch Selector for Business Owners */}
              {isOwner && (
                <View style={{ marginTop: 8 }}>
                  <BranchSelector
                    renderCustomTrigger={(open) => (
                      <Pressable
                        style={uiStyles.homeBranchSelector}
                        onPress={open}
                        accessibilityRole="button"
                        accessibilityLabel="Chọn chi nhánh xem dữ liệu"
                      >
                        <View style={uiStyles.homeBranchLeft}>
                          <Ionicons name="business" size={13} color="#047857" />
                          <Text style={uiStyles.homeBranchLabel}>Chi nhánh:</Text>
                          <Text style={uiStyles.homeBranchName} numberOfLines={1}>
                            {selectedBranch?.name || "Toàn hệ thống (Tất cả chi nhánh)"}
                          </Text>
                        </View>
                        <View style={uiStyles.homeBranchChevron}>
                          <Ionicons name="chevron-down" size={12} color="#047857" />
                        </View>
                      </Pressable>
                    )}
                  />
                </View>
              )}
            </ImageBackground>

            {/* Hàng 4 nút Thao tác nhanh (Chấm công, Nộp đơn, Việc tôi, Phiếu lương) */}
            <View style={uiStyles.topQuickRow}>
              <Pressable
                style={({ pressed }) => [uiStyles.topQuickItem, pressed && { opacity: 0.8 }]}
                onPress={() =>
                  navigateWithLoading("/(tabs)/attendance", {
                    title: "Chấm công hôm nay",
                    icon: "finger-print-outline",
                    color: "#059669",
                    bgColor: "#ecfdf5",
                  })
                }
              >
                <View style={[uiStyles.topQuickIconBox, { borderColor: "rgba(5, 150, 105, 0.18)" }]}>
                  <Ionicons name="finger-print-outline" size={26} color="#059669" />
                </View>
                <Text style={uiStyles.topQuickLabel}>Chấm công</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [uiStyles.topQuickItem, pressed && { opacity: 0.8 }]}
                onPress={() =>
                  navigateWithLoading("/(tabs)/leave?create=1", {
                    title: "Đơn từ & Nghỉ phép",
                    icon: "document-text-outline",
                    color: "#7c3aed",
                    bgColor: "#f5f3ff",
                  })
                }
              >
                <View style={[uiStyles.topQuickIconBox, { borderColor: "rgba(124, 58, 237, 0.18)" }]}>
                  <Ionicons name="document-text-outline" size={25} color="#7c3aed" />
                </View>
                <Text style={uiStyles.topQuickLabel}>Nộp đơn</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [uiStyles.topQuickItem, pressed && { opacity: 0.8 }]}
                onPress={() =>
                  navigateWithLoading("/(tabs)/work", {
                    title: "Công việc cần làm",
                    icon: "checkbox-outline",
                    color: "#2563eb",
                    bgColor: "#eff6ff",
                  })
                }
              >
                <View style={[uiStyles.topQuickIconBox, { borderColor: "rgba(37, 99, 235, 0.18)" }]}>
                  <Ionicons name="checkbox-outline" size={25} color="#2563eb" />
                </View>
                <Text style={uiStyles.topQuickLabel}>Việc của tôi</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [uiStyles.topQuickItem, pressed && { opacity: 0.8 }]}
                onPress={() =>
                  navigateWithLoading("/(tabs)/payslips", {
                    title: "Phiếu lương cá nhân",
                    icon: "wallet-outline",
                    color: "#d97706",
                    bgColor: "#fffbeb",
                  })
                }
              >
                <View style={[uiStyles.topQuickIconBox, { borderColor: "rgba(245, 158, 11, 0.18)" }]}>
                  <Ionicons name="wallet-outline" size={25} color="#d97706" />
                </View>
                <Text style={uiStyles.topQuickLabel}>Phiếu lương</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </View>

        {/* ============================================================ */}
        {/* KHỐI 2: THẺ NỔI VÍ NHÂN SỰ LUXCARE (NẰM ĐÈ NỬA XANH NỬA TRẮNG) */}
        {/* ============================================================ */}
        <View style={uiStyles.floatingCardWrapper}>
          <View style={uiStyles.floatingCard}>
            <View style={uiStyles.floatingCardTop}>
              {/* Cột 1: Công hôm nay */}
              <View style={uiStyles.cardCol}>
                <View style={uiStyles.colHeader}>
                  <Text style={uiStyles.colTitle}>Đi làm</Text>
                  <View style={uiStyles.miniBrandBadge}>
                    <Text style={uiStyles.miniBrandText}>LC</Text>
                  </View>
                </View>
                <Pressable
                  style={uiStyles.colValueRow}
                  onPress={() => router.push("/(tabs)/attendance")}
                >
                  <Text
                    style={[
                      uiStyles.colValueBig,
                      myAttendance?.log?.checkIn && { color: "#059669" },
                    ]}
                  >
                    {loadingDashboard
                      ? "…"
                      : myAttendance?.log?.checkIn
                      ? `Đã chấm${attendanceSummary ? ` (${attendanceSummary.checkedInToday}/${attendanceSummary.totalEmployees})` : ""}`
                      : attendanceSummary
                      ? `${attendanceSummary.checkedInToday}/${attendanceSummary.totalEmployees} người`
                      : "Chưa chấm"}
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color="#64748b" />
                </Pressable>
              </View>

              <View style={uiStyles.vDivider} />

              {/* Cột 2: Đơn chờ duyệt */}
              <View style={uiStyles.cardCol}>
                <View style={uiStyles.colHeader}>
                  <Text style={uiStyles.colTitle}>Chờ duyệt</Text>
                  <Ionicons
                    name="document-text"
                    size={12}
                    color="#059669"
                    style={{ marginLeft: 3 }}
                  />
                </View>
                <Pressable
                  style={uiStyles.colValueRow}
                  onPress={() => router.push("/(tabs)/leave")}
                >
                  <Text style={[uiStyles.colValueBig, { color: "#059669" }]}>
                    {actions?.pendingApprovals?.length || 0} đơn
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color="#059669" />
                </Pressable>
              </View>

              <View style={uiStyles.vDivider} />

              {/* Cột 3: Việc gấp quá hạn */}
              <View style={uiStyles.cardCol}>
                <View style={uiStyles.colHeader}>
                  <Text style={uiStyles.colTitle}>Việc gấp</Text>
                  <Ionicons
                    name="flame"
                    size={12}
                    color="#ea580c"
                    style={{ marginLeft: 3 }}
                  />
                </View>
                <Pressable
                  style={uiStyles.colValueRow}
                  onPress={() => router.push("/(tabs)/work")}
                >
                  <Text
                    style={[
                      uiStyles.colValueBig,
                      {
                        color:
                          (actions?.overdueTasks?.length || 0) > 0
                            ? "#dc2626"
                            : "#071629",
                      },
                    ]}
                  >
                    {actions?.overdueTasks?.length || 0} việc
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color="#64748b" />
                </Pressable>
              </View>
            </View>

            {/* Dòng Footer của Thẻ Nổi */}
            <Pressable
              style={({ pressed }) => [uiStyles.floatingCardBottom, pressed && { opacity: 0.8 }]}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <View style={uiStyles.footerLinkLeft}>
                <Ionicons name="shield-checkmark" size={17} color="#059669" />
                <Text style={uiStyles.footerLinkText} numberOfLines={1}>
                  Trung Tâm Nhân Sự & Sự Nghiệp của {user?.displayName || "bạn"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={15} color="#059669" />
            </Pressable>
          </View>
        </View>

        {/* ============================================================ */}
        {/* KHỐI 3: MA TRẬN ICON DỊCH VỤ / KẾT QUẢ TÌM KIẾM */}
        {/* ============================================================ */}
        <View style={uiStyles.servicesContainer}>
          {isSearching && (
            <View style={uiStyles.searchResultHeader}>
              <Text style={uiStyles.searchResultTitle}>
                Kết quả tìm kiếm ({visibleServices.length})
              </Text>
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Text style={uiStyles.searchResultClearText}>Đóng</Text>
              </Pressable>
            </View>
          )}

          {isSearching && visibleServices.length === 0 ? (
            <View style={uiStyles.searchEmptyContainer}>
              <Ionicons name="search-outline" size={38} color="#94a3b8" />
              <Text style={uiStyles.searchEmptyTitle}>Không tìm thấy chức năng phù hợp</Text>
              <Text style={uiStyles.searchEmptySubtitle}>
                Không có kết quả nào cho "{searchQuery}". Bạn có thể thử tìm: chấm công, đơn nghỉ phép, việc làm, lương, vật tư...
              </Text>
              <Pressable style={uiStyles.searchEmptyClearBtn} onPress={() => setSearchQuery("")}>
                <Text style={uiStyles.searchEmptyClearText}>Xóa bộ lọc</Text>
              </Pressable>
            </View>
          ) : (
            <View style={uiStyles.servicesGrid}>
              {visibleServices.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [uiStyles.gridItem, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    if ((item as any).requiresModule && !canUseModule(user, (item as any).requiresModule)) {
                      Alert.alert("Thông báo", "Bạn chưa được cấp quyền sử dụng phân hệ này.");
                      return;
                    }
                    if ((item as any).status === "coming_soon") {
                      Alert.alert(
                        item.title.replace(/\n/g, " "),
                        "Phân hệ này đang được hoàn thiện và đồng bộ từ phiên bản LuxCare Web. Sẽ sớm sẵn sàng trong bản cập nhật kế tiếp!",
                        [{ text: "Đã hiểu", style: "default" }]
                      );
                      return;
                    }
                    navigateWithLoading(item.route, {
                      title: item.title.replace(/\n/g, " "),
                      icon: item.icon,
                      color: item.color,
                      bgColor: item.bgColor,
                    });
                  }}
                >
                  <View style={uiStyles.iconWrapper}>
                    <Ionicons name={item.icon} size={28} color={item.color} />
                    {badgeFor(item) && (
                      <View style={uiStyles.serviceBadge}>
                        <Text style={uiStyles.serviceBadgeText}>{badgeFor(item)}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={uiStyles.itemLabel}>{item.title}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ============================================================ */}
        {/* KHỐI 4: "LUXCARE ĐỀ XUẤT" (CHỈ HIỂN THỊ KHI KHÔNG TÌM KIẾM) */}
        {/* ============================================================ */}
        {!isSearching && (
          <View style={uiStyles.recommendSection}>
            <Text style={uiStyles.sectionTitle}>LuxCare đề xuất</Text>

            <View style={uiStyles.recommendGrid}>
              {luxcareRecommendations.map((item) => (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [uiStyles.recommendItem, pressed && { opacity: 0.7 }]}
                  onPress={() =>
                    navigateWithLoading(item.route, {
                      title: item.title.replace(/\n/g, " "),
                      icon: item.icon as any,
                      color: item.color,
                      bgColor: (item as any).bgColor,
                    })
                  }
                >
                  <View style={uiStyles.recommendIconBox}>
                    <Ionicons name={item.icon as any} size={28} color={item.color} />
                    {badgeFor(item) && (
                      <View style={uiStyles.serviceBadge}>
                        <Text style={uiStyles.serviceBadgeText}>{badgeFor(item)}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={uiStyles.recommendLabel}>{item.title}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* ============================================================ */}
        {/* KHỐI 5: DASHBOARD TỔNG QUAN DOANH NGHIỆP THỜI GIAN THỰC */}
        {/* ============================================================ */}
        {!isSearching && allowed && (
          <DashboardOverviewSection
            summary={data}
            attendanceSummary={attendanceSummary}
            actionItems={actions}
            loading={loadingDashboard}
            filter={params.filter}
            onFilterChange={(newFilter) => setParams({ filter: newFilter })}
            onRefresh={() => void loadDashboardData()}
            canViewExecutive={allowed}
            onNavigate={(route, title) =>
              navigateWithLoading(route, { title })
            }
          />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const uiStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f6f8fd",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },

  // 1. HEADER NỀN XANH NGỌC LUXCARE (#059669) VÀ XANH MINT (#d1fae5)
  luxcareHeaderContainer: {
    backgroundColor: "#d1fae5", // Xanh ngọc mint LuxCare tươi sáng
    paddingBottom: 38,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  luxcareSafeArea: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Thẻ chào hỏi cá nhân – nền ảnh bg-hello-dashboard
  greetingCard: {
    marginBottom: 14,
    marginTop: 2,
    borderRadius: 16,
    overflow: "hidden",
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 100,
    justifyContent: "flex-end",
    backgroundColor: "#ecfdf5",
  },
  greetingCardImage: {
    borderRadius: 16,
    opacity: 0.95,
  },
  greetingTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  // Chữ "Xin chào" – font viết tay giống LuxCare ở trang đăng nhập
  greetingXinChao: {
    fontSize: 22,
    fontFamily: Platform.select({ ios: "Snell Roundhand", android: "cursive" }),
    color: "#111827",
    lineHeight: 28,
  },
  // Tên user – đen đậm
  greetingName: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.3,
  },
  greetingHello: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.3,
    flex: 1,
  },
  greetingSubText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
    marginTop: 2,
  },
  greetingSubRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    minHeight: 18,
  },
  greetingCursor: {
    fontSize: 13,
    fontWeight: "300",
    color: "#059669",
    marginLeft: 1,
  },
  greetingDateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.85)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
  },
  homeBranchSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.25)",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  homeBranchLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  homeBranchLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#047857",
  },
  homeBranchName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#065f46",
    flex: 1,
  },
  homeBranchChevron: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(5, 150, 105, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
  },
  greetingDateText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
  },
  searchHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },
  // Thanh tìm kiếm dịch vụ & tính năng
  homeSearchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingHorizontal: 12,
    height: 40,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.18)",
  },
  homeSearchInput: {
    flex: 1,
    height: 38,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 0,
  },
  headerRightIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerCircleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  avatarBtnWrapper: {
    position: "relative",
  },
  avatarCircle: {
    backgroundColor: "#059669",
    borderWidth: 1.5,
    borderColor: "#ffffff",
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  onlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10b981",
    borderWidth: 1.8,
    borderColor: "#ffffff",
    zIndex: 3,
  },
  redBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#ef4444",
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  redBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },

  // Hàng 4 nút Quick Actions (Tone màu xanh LuxCare #059669)
  topQuickRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  topQuickItem: {
    alignItems: "center",
    gap: 6,
    width: (SCREEN_WIDTH - 44) / 4,
  },
  topQuickIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.12)",
  },
  topQuickLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#071629",
    textAlign: "center",
  },

  // 2. THẺ NỔI VÍ NHÂN SỰ LUXCARE (NẰM ĐÈ GIỮA NỀN XANH VÀ NỀN TRẮNG)
  floatingCardWrapper: {
    paddingHorizontal: 16,
    marginTop: -28,
  },
  floatingCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.08)",
  },
  floatingCardTop: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardCol: {
    flex: 1,
    gap: 2,
  },
  colHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  colTitle: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  miniBrandBadge: {
    backgroundColor: "#059669", // Màu LuxCare
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    marginLeft: 4,
  },
  miniBrandText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "800",
  },
  colValueRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  colValueBig: {
    fontSize: 13,
    fontWeight: "800",
    color: "#071629",
    marginRight: 2,
  },
  vDivider: {
    width: 1,
    height: 32,
    backgroundColor: "#f1f5f9",
    marginHorizontal: 8,
  },
  floatingCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#e6f4ea",
  },
  footerLinkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    flex: 1,
  },
  footerLinkText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#065f46",
  },

  // 3. MA TRẬN 12 ICON DỊCH VỤ (NẰM TỰ DO TRÊN NỀN TRẮNG TINH KHIẾT)
  servicesContainer: {
    backgroundColor: "#ffffff",
    marginTop: 14,
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  searchResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  searchResultTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#065f46",
  },
  searchResultClearText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
    textDecorationLine: "underline",
  },
  searchEmptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  searchEmptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 12,
    marginBottom: 4,
  },
  searchEmptySubtitle: {
    fontSize: 12.5,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 16,
    maxWidth: 280,
  },
  searchEmptyClearBtn: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  searchEmptyClearText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#059669",
  },
  servicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 18,
  },
  gridItem: {
    width: "25%",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 2,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  itemLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1e293b",
    textAlign: "center",
    lineHeight: 15,
  },
  serviceBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: "#ef4444",
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  serviceBadgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "800",
  },

  // 4. KHỐI "LUXCARE ĐỀ XUẤT"
  recommendSection: {
    backgroundColor: "#ffffff",
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#071629",
    marginBottom: 14,
  },
  recommendGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  recommendItem: {
    alignItems: "center",
    gap: 6,
    width: (SCREEN_WIDTH - 52) / 4,
  },
  recommendIconBox: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  recommendLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#1e293b",
    textAlign: "center",
    lineHeight: 15,
  },

  // 5. THẺ TIẾN ĐỘ CHUYÊN CẦN THÁNG
  trackerCardWrapper: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  trackerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    gap: 10,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.08)",
  },
  trackerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  trackerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  trackerIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  trackerTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#071629",
  },
  progressBarBg: {
    height: 7,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#059669", // LuxCare Emerald
    borderRadius: 4,
  },
  trackerFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  trackerFooterLeft: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  trackerFooterRight: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
});
