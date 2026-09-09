import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { DashboardSummary, DashboardActionItems } from "../../../src/types/dashboard";
import type { DashboardSummaryParams } from "../../../src/services/dashboardService";
import { dashboard } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { colors } from "../../src/ui";
import { canUseModule } from "../../src/auth/access";

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
  const { user, selectedBranch } = useSession();
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [params, setParams] = useState<DashboardSummaryParams>({ filter: "day" });
  const [actions, setActions] = useState<DashboardActionItems | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showValues, setShowValues] = useState(true);

  const allowed = user?.permissions?.some((p) => p === "*" || p === "dashboard:read") ?? false;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!allowed) return;
      void dashboard
        .getSummary(params)
        .then((value) => {
          if (active) setData(value);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [params, allowed, user?.uid]),
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!allowed) return;
      void dashboard
        .getActionItems()
        .then((value) => {
          if (active) setActions(value);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [allowed, user?.uid, selectedBranch?._id]),
  );

  // 8 Chức năng cốt lõi (2 hàng x 4 cột) - Phong cách Super App tinh gọn, đầy đủ các mảng thiết yếu
  const luxcareServices: LuxCareFeature[] = useMemo(
    () => [
      {
        id: "attendance",
        title: "Chấm công\n& Ca trực",
        icon: "time",
        color: "#059669", // LuxCare Primary Emerald Green
        bgColor: "#ecfdf5",
        route: "/(tabs)/attendance",
      },
      {
        id: "leave",
        title: "Đơn từ\n& Nghỉ phép",
        icon: "receipt",
        color: "#0d9488", // Teal y tế
        bgColor: "#f0fdfa",
        route: "/(tabs)/leave",
        badge: actions?.pendingApprovals.length ? `${actions.pendingApprovals.length}` : undefined,
      },
      {
        id: "work",
        title: "Việc của tôi\ncần làm",
        icon: "checkbox",
        color: "#2563eb", // Xanh dương việc cần làm
        bgColor: "#eff6ff",
        route: "/(tabs)/work",
        badge: actions?.overdueTasks.length ? `${actions.overdueTasks.length}` : undefined,
      },
      {
        id: "payslips",
        title: "Phiếu lương\ncá nhân",
        icon: "wallet",
        color: "#059669", // Xanh LuxCare
        bgColor: "#ecfdf5",
        route: "/(tabs)/payslips",
      },
      {
        id: "inventory",
        title: "Vật tư\n& Dược phẩm",
        icon: "cube",
        color: "#10b981", // Xanh bạc hà
        bgColor: "#ecfdf5",
        route: "/(tabs)/modules",
      },
      {
        id: "equipment",
        title: "Thiết bị\ny tế",
        icon: "medkit",
        color: "#0284c7", // Xanh y tế
        bgColor: "#f0f9ff",
        route: "/(tabs)/modules",
      },
      {
        id: "chat",
        title: "Trò chuyện\nnội bộ",
        icon: "chatbubble-ellipses",
        color: "#0d9488", // Teal
        bgColor: "#f0fdfa",
        route: "/(tabs)/modules",
      },
      {
        id: "modules",
        title: "Tất cả\nchức năng",
        icon: "apps",
        color: "#475569", // Slate xám thanh lịch
        bgColor: "#f8fafc",
        route: "/(tabs)/modules",
      },
    ],
    [actions],
  );

  // Lọc theo tìm kiếm
  const visibleServices = useMemo(() => {
    if (!searchQuery.trim()) return luxcareServices;
    const q = searchQuery.toLowerCase().trim();
    return luxcareServices.filter((item) => item.title.toLowerCase().includes(q));
  }, [luxcareServices, searchQuery]);

  // 4 Icon LuxCare Đề Xuất
  const luxcareRecommendations = [
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
      title: "Phiếu lương\ncá nhân",
      icon: "newspaper",
      color: "#059669",
      route: "/(tabs)/payslips",
    },
  ];

  const pendingCount = (actions?.overdueTasks.length || 0) + (actions?.pendingApprovals.length || 0);

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
            {/* Top Bar: Search Pill + Notification Bell + User Avatar */}
            <View style={uiStyles.searchHeaderRow}>
              <View style={uiStyles.searchPill}>
                <Ionicons name="search" size={17} color="#059669" style={{ marginRight: 8 }} />
                <TextInput
                  style={uiStyles.searchInput}
                  placeholder="LuxCare - Trợ thủ y tế & nhân sự..."
                  placeholderTextColor="#64748b"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
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
                  <Ionicons name="notifications" size={20} color="#065f46" />
                  {pendingCount > 0 && (
                    <View style={uiStyles.redBadge}>
                      <Text style={uiStyles.redBadgeText}>{pendingCount > 99 ? "99+" : pendingCount}</Text>
                    </View>
                  )}
                </Pressable>

                <Pressable
                  style={[uiStyles.headerCircleBtn, uiStyles.avatarCircle]}
                  onPress={() => router.push("/(tabs)/profile")}
                  accessibilityLabel="Tài khoản cá nhân"
                >
                  <Text style={uiStyles.avatarInitials}>
                    {(user?.displayName || "LC").slice(0, 2).toUpperCase()}
                  </Text>
                  <View style={uiStyles.onlineDot} />
                </Pressable>
              </View>
            </View>

            {/* Hàng 4 nút Thao tác nhanh (Chấm công, Nộp đơn, Việc tôi, Phiếu lương) */}
            <View style={uiStyles.topQuickRow}>
              <Pressable
                style={({ pressed }) => [uiStyles.topQuickItem, pressed && { opacity: 0.8 }]}
                onPress={() => router.push("/(tabs)/attendance")}
              >
                <View style={uiStyles.topQuickIconBox}>
                  <Ionicons name="qr-code-outline" size={25} color="#059669" />
                </View>
                <Text style={uiStyles.topQuickLabel}>Chấm công</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [uiStyles.topQuickItem, pressed && { opacity: 0.8 }]}
                onPress={() => router.push("/(tabs)/leave")}
              >
                <View style={uiStyles.topQuickIconBox}>
                  <Ionicons name="document-text-outline" size={25} color="#059669" />
                </View>
                <Text style={uiStyles.topQuickLabel}>Nộp đơn</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [uiStyles.topQuickItem, pressed && { opacity: 0.8 }]}
                onPress={() => router.push("/(tabs)/work")}
              >
                <View style={uiStyles.topQuickIconBox}>
                  <Ionicons name="checkbox-outline" size={25} color="#059669" />
                </View>
                <Text style={uiStyles.topQuickLabel}>Việc của tôi</Text>
              </Pressable>

              <Pressable
                style={({ pressed }) => [uiStyles.topQuickItem, pressed && { opacity: 0.8 }]}
                onPress={() => router.push("/(tabs)/payslips")}
              >
                <View style={uiStyles.topQuickIconBox}>
                  <Ionicons name="wallet-outline" size={25} color="#059669" />
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
              <Pressable onPress={() => setShowValues(!showValues)} hitSlop={10} style={{ marginRight: 10 }}>
                <Ionicons
                  name={showValues ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#071629"
                />
              </Pressable>

              {/* Cột 1: Công tháng này */}
              <View style={uiStyles.cardCol}>
                <View style={uiStyles.colHeader}>
                  <Text style={uiStyles.colTitle}>Công tháng</Text>
                  <View style={uiStyles.miniBrandBadge}>
                    <Text style={uiStyles.miniBrandText}>LC</Text>
                  </View>
                </View>
                <Pressable
                  style={uiStyles.colValueRow}
                  onPress={() => router.push("/(tabs)/attendance")}
                >
                  <Text style={uiStyles.colValueBig}>
                    {showValues ? `${data?.timekeeping.checkedInToday || 22} công` : "••••••"}
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color="#64748b" />
                </Pressable>
              </View>

              <View style={uiStyles.vDivider} />

              {/* Cột 2: Phép năm */}
              <View style={uiStyles.cardCol}>
                <View style={uiStyles.colHeader}>
                  <Text style={uiStyles.colTitle}>Phép năm</Text>
                  <Ionicons name="calendar" size={12} color="#059669" style={{ marginLeft: 3 }} />
                </View>
                <Pressable
                  style={uiStyles.colValueRow}
                  onPress={() => router.push("/(tabs)/leave")}
                >
                  <Text style={[uiStyles.colValueBig, { color: "#059669" }]}>
                    {showValues ? "Còn 12 ngày" : "••••••"}
                  </Text>
                  <Ionicons name="chevron-forward" size={13} color="#059669" />
                </Pressable>
              </View>

              <View style={uiStyles.vDivider} />

              {/* Cột 3: Việc cần làm */}
              <View style={uiStyles.cardCol}>
                <View style={uiStyles.colHeader}>
                  <Text style={uiStyles.colTitle}>Việc gấp</Text>
                  <Ionicons name="flame" size={12} color="#ea580c" style={{ marginLeft: 3 }} />
                </View>
                <Pressable
                  style={uiStyles.colValueRow}
                  onPress={() => router.push("/(tabs)/work")}
                >
                  <Text style={[uiStyles.colValueBig, { color: pendingCount > 0 ? "#dc2626" : "#071629" }]}>
                    {showValues ? `${pendingCount} việc` : "••••••"}
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
        {/* KHỐI 3: MA TRẬN 12 ICON DỊCH VỤ (TỰ DO TRÊN NỀN TRẮNG NHƯ MOMO) */}
        {/* ============================================================ */}
        <View style={uiStyles.servicesContainer}>
          <View style={uiStyles.servicesGrid}>
            {visibleServices.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [uiStyles.gridItem, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  if (item.requiresModule && !canUseModule(user, item.requiresModule)) {
                    Alert.alert("Thông báo", "Bạn chưa được cấp quyền sử dụng phân hệ này.");
                    return;
                  }
                  router.push(item.route as any);
                }}
              >
                <View style={uiStyles.iconWrapper}>
                  <Ionicons name={item.icon} size={28} color={item.color} />
                  {item.badge && (
                    <View style={uiStyles.serviceBadge}>
                      <Text style={uiStyles.serviceBadgeText}>{item.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={uiStyles.itemLabel}>{item.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ============================================================ */}
        {/* KHỐI 4: "LUXCARE ĐỀ XUẤT" (HEADING ĐẬM, ICON NẰM TỰ DO) */}
        {/* ============================================================ */}
        <View style={uiStyles.recommendSection}>
          <Text style={uiStyles.sectionTitle}>LuxCare đề xuất</Text>

          <View style={uiStyles.recommendGrid}>
            {luxcareRecommendations.map((item) => (
              <Pressable
                key={item.id}
                style={({ pressed }) => [uiStyles.recommendItem, pressed && { opacity: 0.7 }]}
                onPress={() => router.push(item.route as any)}
              >
                <View style={uiStyles.recommendIconBox}>
                  <Ionicons name={item.icon as any} size={28} color={item.color} />
                  {item.badge && (
                    <View style={uiStyles.serviceBadge}>
                      <Text style={uiStyles.serviceBadgeText}>{item.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={uiStyles.recommendLabel}>{item.title}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ============================================================ */}
        {/* KHỐI 5: THẺ TIẾN ĐỘ CHUYÊN CẦN THÁNG (CHUẨN THEME LUXCARE) */}
        {/* ============================================================ */}
        <View style={uiStyles.trackerCardWrapper}>
          <View style={uiStyles.trackerCard}>
            <View style={uiStyles.trackerHeader}>
              <View style={uiStyles.trackerTitleRow}>
                <View style={uiStyles.trackerIcon}>
                  <Ionicons name="calendar-outline" size={17} color="#059669" />
                </View>
                <Text style={uiStyles.trackerTitle}>Chuyên cần & Công tháng 9</Text>
                <Ionicons name="chevron-forward" size={14} color="#64748b" />
              </View>
              <Ionicons name="ellipsis-horizontal" size={17} color="#94a3b8" />
            </View>

            <View style={uiStyles.progressBarBg}>
              <View style={[uiStyles.progressBarFill, { width: "82%" }]} />
            </View>

            <View style={uiStyles.trackerFooterRow}>
              <Text style={uiStyles.trackerFooterLeft}>Đã đạt 18/22 ngày công chuẩn</Text>
              <Text style={uiStyles.trackerFooterRight}>82% chỉ tiêu</Text>
            </View>
          </View>
        </View>

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
  searchHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 16,
  },
  searchPill: {
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
    borderColor: "rgba(5, 150, 105, 0.15)",
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#071629",
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
  avatarCircle: {
    backgroundColor: "#059669",
    borderWidth: 1.5,
    borderColor: "#ffffff",
  },
  avatarInitials: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "800",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#10b981",
    borderWidth: 1.5,
    borderColor: "#ffffff",
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
