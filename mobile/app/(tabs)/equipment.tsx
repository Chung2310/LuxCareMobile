import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../../src/ui";
import { equipment } from "../../src/api/services";
import type {
  EquipmentRecord,
  EquipmentSummary,
  EquipmentComplianceSummary,
} from "../../../src/types/equipment";

function getStatusBadge(status: string) {
  const s = (status || "").toLowerCase();
  if (s.includes("using") || s.includes("dùng") || s.includes("đang") || s.includes("in_use")) {
    return { label: "Đang dùng", color: "#047857", bg: "#f0fdf4" };
  }
  if (s.includes("ready") || s.includes("sẵn") || s.includes("avail")) {
    return { label: "Sẵn sàng", color: "#0284c7", bg: "#f0f9ff" };
  }
  if (s.includes("booked") || s.includes("đơn") || s.includes("đặt") || s.includes("order")) {
    return { label: "Đã có đơn", color: "#6366f1", bg: "#eef2ff" };
  }
  if (s.includes("maint") || s.includes("bảo trì") || s.includes("sửa") || s.includes("repair")) {
    return { label: "Bảo trì", color: "#b45309", bg: "#fffbeb" };
  }
  if (s.includes("dispos") || s.includes("thanh lý") || s.includes("hỏng") || s.includes("scrap")) {
    return { label: "Thanh lý", color: "#64748b", bg: "#f8fafc" };
  }
  return { label: status || "Khác", color: "#475569", bg: "#f1f5f9" };
}

export default function EquipmentScreen() {
  const [items, setItems] = useState<EquipmentRecord[]>([]);
  const [serverTotal, setServerTotal] = useState<number | null>(null);
  const [summary, setSummary] = useState<EquipmentSummary | null>(null);
  const [compliance, setCompliance] = useState<EquipmentComplianceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [revision, setRevision] = useState(0);

  const loadData = useCallback(async () => {
    setError(null);
    try {
      const [sumRes, compRes, listRes] = await Promise.allSettled([
        equipment.getSummary(),
        equipment.getCompliance(),
        equipment.list({
          search: search.trim() || undefined,
          status: selectedFilter !== "all" ? selectedFilter : undefined,
        }),
      ]);

      if (sumRes.status === "fulfilled") {
        setSummary(sumRes.value);
      }
      if (compRes.status === "fulfilled") {
        setCompliance(compRes.value);
      }
      if (listRes.status === "fulfilled") {
        setItems(listRes.value.items || []);
        if (typeof listRes.value.total === "number") {
          setServerTotal(listRes.value.total);
        }
      } else {
        // If list failed, capture message
        const err = listRes.reason;
        setError(err instanceof Error ? err.message : "Không thể tải danh sách thiết bị.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedFilter]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (active) {
        setLoading(true);
        void loadData();
      }
      return () => {
        active = false;
      };
    }, [loadData, revision]),
  );

  // Compute status counts from summary or items
  const totalCount = summary?.total ?? serverTotal ?? items.length;

  const countByStatus = (...keywords: string[]) => {
    if (summary?.byStatus && Array.isArray(summary.byStatus)) {
      const found = summary.byStatus.find((s) =>
        keywords.some((k) => s.status.toLowerCase().includes(k.toLowerCase())),
      );
      if (found) return found.count;
    }
    return items.filter((item) => {
      const s = (item.status || "").toLowerCase();
      return keywords.some((k) => s.includes(k.toLowerCase()));
    }).length;
  };

  const bookedCount = summary?.booked ?? countByStatus("đơn", "booked", "order");
  const readyCount = summary?.ready ?? countByStatus("sẵn", "ready", "avail");
  const usingCount = summary?.using ?? countByStatus("dùng", "using", "in_use");
  const maintenanceCount = summary?.maintenance ?? countByStatus("trì", "maint", "repair");
  const disposedCount = summary?.disposed ?? countByStatus("lý", "dispos", "scrap");

  // Overdue, upcoming, valid calculation
  let computedOverdue = compliance?.overdue ?? 0;
  let computedUpcoming = compliance?.upcoming ?? 0;
  let computedValid = compliance?.valid ?? 0;

  if (!compliance || (computedOverdue === 0 && computedUpcoming === 0 && computedValid === 0)) {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    items.forEach((item) => {
      const cs = (item.complianceStatus || "").toLowerCase();
      if (cs.includes("valid") || cs.includes("đạt")) {
        computedValid++;
        return;
      }
      if (cs.includes("overdue") || cs.includes("quá hạn")) {
        computedOverdue++;
        return;
      }
      if (cs.includes("upcoming") || cs.includes("sắp")) {
        computedUpcoming++;
        return;
      }

      if (item.nextInspectionDate) {
        const time = new Date(item.nextInspectionDate).getTime();
        if (!isNaN(time)) {
          if (time < now) {
            computedOverdue++;
          } else if (time <= now + thirtyDaysMs) {
            computedUpcoming++;
          } else {
            computedValid++;
          }
        }
      }
    });
  }

  const overdueCount = computedOverdue;
  const upcomingCount = computedUpcoming;
  const validCount = computedValid;

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
        >
          <Image
            source={require("../../assets/lucide-chevron-right.png")}
            style={styles.backIcon}
            resizeMode="contain"
          />
        </Pressable>
        <Text style={styles.headerTitle}>Quản lý thiết bị</Text>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setRevision((v) => v + 1);
            }}
            colors={["#008852"]}
            tintColor="#008852"
          />
        }
      >
        {/* Error message banner if any */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
            <Pressable
              onPress={() => {
                setLoading(true);
                void loadData();
              }}
              style={styles.errorRetryBtn}
            >
              <Text style={styles.errorRetryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : null}

        {/* 6 thẻ trạng thái trên 2 hàng (Ảnh 1) */}
        <View style={styles.statusGrid}>
          {/* 1. Tổng số */}
          <Pressable
            onPress={() => setSelectedFilter("all")}
            style={[styles.statusCard, styles.cardGray, selectedFilter === "all" && styles.cardActive]}
          >
            <Text style={[styles.statusLabel, styles.textGray]} numberOfLines={1}>
              TỔNG SỐ
            </Text>
            <Text style={[styles.statusValue, styles.textDark]}>{totalCount}</Text>
          </Pressable>

          {/* 2. Đã có đơn */}
          <Pressable
            onPress={() => setSelectedFilter(selectedFilter === "booked" ? "all" : "booked")}
            style={[styles.statusCard, styles.cardGreen, selectedFilter === "booked" && styles.cardActive]}
          >
            <Text style={[styles.statusLabel, styles.textGreen]} numberOfLines={1}>
              ĐÃ CÓ ĐƠN
            </Text>
            <Text style={[styles.statusValue, styles.textGreen]}>{bookedCount}</Text>
          </Pressable>

          {/* 3. Sẵn sàng */}
          <Pressable
            onPress={() => setSelectedFilter(selectedFilter === "ready" ? "all" : "ready")}
            style={[styles.statusCard, styles.cardGreen, selectedFilter === "ready" && styles.cardActive]}
          >
            <Text style={[styles.statusLabel, styles.textGreen]} numberOfLines={1}>
              SẴN SÀNG
            </Text>
            <Text style={[styles.statusValue, styles.textGreen]}>{readyCount}</Text>
          </Pressable>

          {/* 4. Đang dùng */}
          <Pressable
            onPress={() => setSelectedFilter(selectedFilter === "using" ? "all" : "using")}
            style={[styles.statusCard, styles.cardGreen, selectedFilter === "using" && styles.cardActive]}
          >
            <Text style={[styles.statusLabel, styles.textGreen]} numberOfLines={1}>
              ĐANG DÙNG
            </Text>
            <Text style={[styles.statusValue, styles.textGreen]}>{usingCount}</Text>
          </Pressable>

          {/* 5. Bảo trì */}
          <Pressable
            onPress={() => setSelectedFilter(selectedFilter === "maintenance" ? "all" : "maintenance")}
            style={[styles.statusCard, styles.cardAmber, selectedFilter === "maintenance" && styles.cardActive]}
          >
            <Text style={[styles.statusLabel, styles.textAmber]} numberOfLines={1}>
              BẢO TRÌ
            </Text>
            <Text style={[styles.statusValue, styles.textAmber]}>{maintenanceCount}</Text>
          </Pressable>

          {/* 6. Thanh lý */}
          <Pressable
            onPress={() => setSelectedFilter(selectedFilter === "disposed" ? "all" : "disposed")}
            style={[styles.statusCard, styles.cardGray, selectedFilter === "disposed" && styles.cardActive]}
          >
            <Text style={[styles.statusLabel, styles.textGray]} numberOfLines={1}>
              THANH LÝ
            </Text>
            <Text style={[styles.statusValue, styles.textGray]}>{disposedCount}</Text>
          </Pressable>
        </View>

        {/* 1 hàng text : " Trạng thái " */}
        <Text style={styles.statusSectionTitle}>Trạng thái</Text>

        {/* 3 thẻ kiểm định (Ảnh 2): Quá hạn, Sắp tới hạn, Đạt chuẩn */}
        <View style={styles.complianceGrid}>
          {/* 1. Quá hạn kiểm định */}
          <View style={[styles.complianceCard, styles.complianceCardRed]}>
            <View style={styles.complianceCardHeader}>
              <Text style={[styles.complianceCardTitle, styles.complianceTextRed]} numberOfLines={1}>
                Quá hạn
              </Text>
              <View style={[styles.complianceIconWrap, styles.complianceIconWrapRed]}>
                <Image
                  source={require("../../assets/compliance-clock-badge.png")}
                  style={styles.complianceIcon}
                  resizeMode="contain"
                />
              </View>
            </View>
            <Text style={[styles.complianceValue, styles.complianceTextRed]}>
              {overdueCount}
            </Text>
            <Text style={[styles.complianceSubtitle, styles.complianceSubRed]} numberOfLines={1}>
              Cần kiểm định gấp
            </Text>
          </View>

          {/* 2. Sắp đến hạn */}
          <View style={[styles.complianceCard, styles.complianceCardAmber]}>
            <View style={styles.complianceCardHeader}>
              <Text style={[styles.complianceCardTitle, styles.complianceTextAmber]} numberOfLines={1}>
                Sắp tới hạn
              </Text>
              <View style={[styles.complianceIconWrap, styles.complianceIconWrapAmber]}>
                <Image
                  source={require("../../assets/compliance-calendar-badge.png")}
                  style={styles.complianceIcon}
                  resizeMode="contain"
                />
              </View>
            </View>
            <Text style={[styles.complianceValue, styles.complianceTextAmber]}>
              {upcomingCount}
            </Text>
            <Text style={[styles.complianceSubtitle, styles.complianceSubAmber]} numberOfLines={1}>
              Trong 30 ngày
            </Text>
          </View>

          {/* 3. Đạt chuẩn & còn hạn */}
          <View style={[styles.complianceCard, styles.complianceCardGreen]}>
            <View style={styles.complianceCardHeader}>
              <Text style={[styles.complianceCardTitle, styles.complianceTextGreen]} numberOfLines={1}>
                Đạt chuẩn
              </Text>
              <View style={[styles.complianceIconWrap, styles.complianceIconWrapGreen]}>
                <Image
                  source={require("../../assets/compliance-shield-badge.png")}
                  style={styles.complianceIcon}
                  resizeMode="contain"
                />
              </View>
            </View>
            <Text style={[styles.complianceValue, styles.complianceTextGreen]}>
              {validCount}
            </Text>
            <Text style={[styles.complianceSubtitle, styles.complianceSubGreen]} numberOfLines={1}>
              Hoạt động an toàn
            </Text>
          </View>
        </View>

        {/* Thanh tìm kiếm */}
        <View style={styles.searchBar}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => loadData()}
            placeholder="Tìm theo tên, mã thiết bị, khoa..."
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        {/* Danh sách thiết bị từ API */}
        <View style={styles.listSection}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>
              Danh sách thiết bị ({items.length})
            </Text>
            {selectedFilter !== "all" && (
              <Pressable onPress={() => setSelectedFilter("all")}>
                <Text style={styles.resetFilterText}>Xóa lọc</Text>
              </Pressable>
            )}
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#008852" />
              <Text style={styles.loadingText}>Đang tải dữ liệu từ máy chủ...</Text>
            </View>
          ) : items.length === 0 ? (
            <EmptyState
              message="Chưa có thiết bị nào"
              subtitle={
                search
                  ? "Không tìm thấy thiết bị phù hợp với từ khóa."
                  : "Danh sách thiết bị trống trên hệ thống."
              }
            />
          ) : (
            items.map((item) => {
              const badge = getStatusBadge(item.status);
              const inspectionDate =
                item.nextInspectionDate
                  ? new Date(item.nextInspectionDate).toLocaleDateString("vi-VN")
                  : "Chưa cập nhật";

              return (
                <View key={item._id || item.id || item.code} style={styles.itemCard}>
                  <View style={styles.itemCardTop}>
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemCode}>
                        {item.code || "N/A"}{item.department || item.departmentName ? ` · ${item.department || item.departmentName}` : ""}
                      </Text>
                    </View>
                    <View style={[styles.itemBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.itemBadgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                  </View>

                  <View style={styles.itemFooter}>
                    <Text style={styles.itemMeta}>
                      Hạn kiểm định: <Text style={styles.normalDate}>{inspectionDate}</Text>
                    </Text>
                    {item.category ? (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{item.category}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
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
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "180deg" }],
  },
  backIcon: {
    width: 16,
    height: 16,
    tintColor: "#334155",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  headerRightSpacer: {
    width: 36,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  errorBanner: {
    backgroundColor: "#fff1f2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  errorBannerText: {
    fontSize: 12,
    color: "#be123c",
    fontFamily: "Inter-Medium",
    flex: 1,
  },
  errorRetryBtn: {
    backgroundColor: "#be123c",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  errorRetryText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
    fontFamily: "Inter-Bold",
  },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 8,
  },
  statusCard: {
    width: "31.6%",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 9,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 62,
  },
  cardActive: {
    borderColor: "#008852",
    borderWidth: 2,
  },
  statusLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
    letterSpacing: 0.2,
    textAlign: "center",
  },
  statusValue: {
    fontSize: 20,
    fontWeight: "800",
    fontFamily: "Inter-Bold",
    marginTop: 3,
    textAlign: "center",
  },
  statusSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    marginTop: 14,
    marginBottom: 8,
  },
  cardGray: {
    backgroundColor: "#ffffff",
    borderColor: "#e2e8f0",
  },
  cardGreen: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  cardAmber: {
    backgroundColor: "#fffbeb",
    borderColor: "#fed7aa",
  },
  textGray: {
    color: "#64748b",
  },
  textGreen: {
    color: "#047857",
  },
  textAmber: {
    color: "#b45309",
  },
  textDark: {
    color: "#0f172a",
  },
  complianceGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 2,
  },
  complianceCard: {
    width: "31.6%",
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: "space-between",
    minHeight: 78,
  },
  complianceCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  complianceCardTitle: {
    fontSize: 10,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
    flex: 1,
  },
  complianceIconWrap: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  complianceIconWrapRed: {
    backgroundColor: "#ffe4e6",
  },
  complianceIconWrapAmber: {
    backgroundColor: "#fef3c7",
  },
  complianceIconWrapGreen: {
    backgroundColor: "#dcfce7",
  },
  complianceIcon: {
    width: 11,
    height: 11,
  },
  complianceValue: {
    fontSize: 20,
    fontWeight: "800",
    fontFamily: "Inter-Bold",
    marginTop: 3,
    marginBottom: 2,
    textAlign: "center",
  },
  complianceSubtitle: {
    fontSize: 8.8,
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
    textAlign: "center",
  },
  complianceCardRed: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
  },
  complianceCardAmber: {
    backgroundColor: "#fffbeb",
    borderColor: "#fed7aa",
  },
  complianceCardGreen: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  complianceTextRed: {
    color: "#be123c",
  },
  complianceSubRed: {
    color: "#e11d48",
  },
  complianceTextAmber: {
    color: "#b45309",
  },
  complianceSubAmber: {
    color: "#b45309",
  },
  complianceTextGreen: {
    color: "#047857",
  },
  complianceSubGreen: {
    color: "#059669",
  },
  searchBar: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  searchInput: {
    fontSize: 13,
    fontFamily: "Inter-Medium",
    color: "#1e293b",
  },
  listSection: {
    gap: 10,
    marginTop: 6,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  listTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    fontFamily: "Inter-Bold",
  },
  resetFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#008852",
    fontFamily: "Inter-SemiBold",
  },
  loadingContainer: {
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Inter-Regular",
  },
  emptyContainer: {
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    fontFamily: "Inter-Bold",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    fontFamily: "Inter-Regular",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  itemCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 10,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  itemCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  itemCode: {
    fontSize: 11,
    color: "#64748b",
    fontFamily: "Inter-Regular",
  },
  itemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  itemBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  itemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  itemMeta: {
    fontSize: 11,
    color: "#64748b",
    fontFamily: "Inter-Medium",
  },
  normalDate: {
    color: "#059669",
    fontWeight: "600",
  },
  categoryBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 10,
    color: "#475569",
    fontFamily: "Inter-Medium",
  },
});
