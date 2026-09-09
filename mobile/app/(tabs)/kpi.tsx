import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import {
  currentKpiPeriod,
  validateKpiPeriod,
  type MonthlyKpiReport,
} from "../../../src/services/monthlyKpiService";
import { monthlyKpi } from "../../src/api/services";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { EmptyState, Page } from "../../src/ui";
import { WorkSectionTabs, type WorkSection } from "../../src/features/work/WorkSectionTabs";

function shiftKpiPeriod(period: string, delta: number): string {
  try {
    const [yStr, mStr] = period.split("-");
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10);
    const d = new Date(year, month - 1 + delta, 1);
    const newY = d.getFullYear();
    const newM = String(d.getMonth() + 1).padStart(2, "0");
    return `${newY}-${newM}`;
  } catch {
    return period;
  }
}

function getKpiLevel(percent: number | null) {
  if (percent === null) {
    return { label: "Chưa có việc", color: "#64748b", bg: "#f1f5f9" };
  }
  if (percent >= 90) {
    return { label: "Đạt xuất sắc", color: "#059669", bg: "#ecfdf5" };
  }
  if (percent >= 75) {
    return { label: "Đạt yêu cầu", color: "#2563eb", bg: "#eff6ff" };
  }
  if (percent >= 50) {
    return { label: "Cần cố gắng", color: "#d97706", bg: "#fffbeb" };
  }
  return { label: "Chưa đạt", color: "#dc2626", bg: "#fef2f2" };
}

interface KpiProps {
  onSectionChange?: (section: WorkSection) => void;
}

export default function Kpi({ onSectionChange }: KpiProps = {}) {
  const { user, selectedBranch } = useSession();
  const allowed = canUseModule(user, "hr") && hasPermission(user, "work:read");
  const branchId = selectedBranch?._id || user?.branchId || undefined;

  const [period, setPeriod] = useState(() => currentKpiPeriod());
  const [report, setReport] = useState<MonthlyKpiReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");

  // Fetch immediately on mount and when parameters change
  useEffect(() => {
    let active = true;
    setReport(null);
    if (!allowed) return;
    setLoading(true);
    setError(null);

    void monthlyKpi
      .report(period, branchId)
      .then((data) => {
        if (active) setReport(data);
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
  }, [allowed, period, branchId, user?.uid, revision]);

  // Refresh when returning focus
  useFocusEffect(
    useCallback(() => {
      setRevision((v) => v + 1);
    }, []),
  );

  if (!allowed)
    return (
      <Page title="KPI tháng">
        <Text style={styles.emptySubtitle}>Bạn chưa có quyền xem KPI công việc.</Text>
      </Page>
    );

  const handleSectionChange = (nextSection: WorkSection) => {
    if (onSectionChange) {
      onSectionChange(nextSection);
      return;
    }
    if (nextSection === "tasks") {
      router.replace("/(tabs)/work");
    } else if (nextSection === "projects") {
      router.replace("/(tabs)/projects");
    }
  };

  const rows = (report?.rows || []).filter((row) =>
    row.employeeName.toLocaleLowerCase("vi-VN").includes(search.trim().toLocaleLowerCase("vi-VN")),
  );

  // Calculate high-level summary metrics
  const totalEmployees = rows.length;
  const totalTasks = rows.reduce((acc, r) => acc + r.totalTasks, 0);
  const totalCompleted = rows.reduce((acc, r) => acc + r.completedTasks, 0);
  const totalPending = rows.reduce((acc, r) => acc + r.pendingTasks, 0);
  const avgPercent =
    totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : null;

  const isClosed = report?.periodStatus === "closed";

  const [yearStr, monthStr] = period.split("-");

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      {/* Unified Subnav */}
      <WorkSectionTabs
        value="kpi"
        canViewKpi={hasPermission(user, "work:read")}
        onChange={onSectionChange || handleSectionChange}
      />

      {/* Screen Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>KPI công việc</Text>
          <Text style={styles.headerSub}>
            {selectedBranch?.name || user?.branchName || "Chi nhánh hiện tại"} · {totalEmployees} nhân sự
          </Text>
        </View>

        <View style={[styles.statusBadge, isClosed ? styles.statusBadgeClosed : styles.statusBadgeOpen]}>
          <Text style={[styles.statusBadgeText, isClosed ? styles.statusBadgeTextClosed : styles.statusBadgeTextOpen]}>
            {isClosed ? "● Đã chốt KPI" : "○ Tạm tính"}
          </Text>
        </View>
      </View>

      {/* Month Stepper Selector */}
      <View style={styles.stepperCard}>
        <Pressable
          style={styles.stepBtn}
          onPress={() => setPeriod((curr) => shiftKpiPeriod(curr, -1))}
          disabled={loading}
        >
          <Text style={styles.stepBtnText}>‹ Tháng trước</Text>
        </Pressable>

        <View style={styles.stepperCenter}>
          <Text style={styles.stepperPeriodText}>
            Tháng {monthStr}/{yearStr}
          </Text>
          {!!report?.closedAt && (
            <Text style={styles.closedAtText}>
              Chốt lúc: {new Date(report.closedAt).toLocaleDateString("vi-VN")}
            </Text>
          )}
        </View>

        <Pressable
          style={styles.stepBtn}
          onPress={() => setPeriod((curr) => shiftKpiPeriod(curr, 1))}
          disabled={loading}
        >
          <Text style={styles.stepBtnText}>Tháng sau ›</Text>
        </Pressable>
      </View>

      {/* Summary Metrics Row */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={[styles.metricNumber, { color: "#059669" }]}>
            {avgPercent !== null ? `${avgPercent}%` : "—"}
          </Text>
          <Text style={styles.metricLabel}>TB Hoàn thành</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={[styles.metricNumber, { color: "#0f172a" }]}>
            {totalTasks}
          </Text>
          <Text style={styles.metricLabel}>Tổng việc</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={[styles.metricNumber, { color: "#2563eb" }]}>
            {totalCompleted}
          </Text>
          <Text style={styles.metricLabel}>Đúng hạn</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={[styles.metricNumber, { color: "#dc2626" }]}>
            {totalPending}
          </Text>
          <Text style={styles.metricLabel}>Chưa đạt</Text>
        </View>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm tên nhân sự trong báo cáo..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} style={styles.searchClearBtn}>
              <Text style={styles.searchClearText}>✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Error Notice */}
      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}

      {/* KPI List */}
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={rows}
        keyExtractor={(row) => row.employeeId}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => setRevision((v) => v + 1)}
            colors={["#059669"]}
            tintColor="#059669"
          />
        }
        renderItem={({ item }) => {
          const percent = item.percent;
          const level = getKpiLevel(percent);

          return (
            <View style={styles.kpiCard}>
              {/* Employee Info & Score Header */}
              <View style={styles.kpiHeader}>
                <View style={styles.employeeInfoRow}>
                  <View style={styles.employeeAvatar}>
                    <Text style={styles.employeeAvatarText}>
                      {(item.employeeName || "U").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.employeeName}>{item.employeeName}</Text>
                    <View style={[styles.levelBadge, { backgroundColor: level.bg }]}>
                      <Text style={[styles.levelBadgeText, { color: level.color }]}>
                        {level.label}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Score Number */}
                <View style={styles.scoreBox}>
                  <Text style={[styles.scoreNumber, { color: level.color }]}>
                    {percent !== null ? `${percent}%` : "—"}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              {percent !== null && (
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(100, Math.max(0, percent))}%`,
                        backgroundColor: level.color,
                      },
                    ]}
                  />
                </View>
              )}

              {/* Detailed Numbers Row */}
              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statVal}>{item.completedTasks}</Text>
                  <Text style={styles.statSub}>Đúng hạn</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statCol}>
                  <Text style={styles.statVal}>{item.totalTasks}</Text>
                  <Text style={styles.statSub}>Tổng việc</Text>
                </View>

                <View style={styles.statDivider} />

                <View style={styles.statCol}>
                  <Text style={[styles.statVal, item.pendingTasks > 0 && { color: "#dc2626" }]}>
                    {item.pendingTasks}
                  </Text>
                  <Text style={styles.statSub}>Chưa đạt</Text>
                </View>
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.emptyLoadingText}>Đang tính toán báo cáo KPI...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <EmptyState
                message="Không có dữ liệu KPI phù hợp"
                subtitle={
                  search
                    ? "Không tìm thấy nhân viên nào theo từ khóa."
                    : `Chưa có dữ liệu công việc trong kỳ ${monthStr}/${yearStr}.`
                }
              />
              {search.length > 0 && (
                <Pressable
                  style={styles.resetFiltersBtn}
                  onPress={() => setSearch("")}
                >
                  <Text style={styles.resetFiltersBtnText}>Xóa từ khóa</Text>
                </Pressable>
              )}
            </View>
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
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusBadgeClosed: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  statusBadgeOpen: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statusBadgeTextClosed: {
    color: "#059669",
  },
  statusBadgeTextOpen: {
    color: "#d97706",
  },
  stepperCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  stepBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  stepBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  stepperCenter: {
    alignItems: "center",
  },
  stepperPeriodText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  closedAtText: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 1,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 3,
  },
  metricNumber: {
    fontSize: 16,
    fontWeight: "800",
  },
  metricLabel: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
  },
  searchSection: {
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 10,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 2,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchClearText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  errorBox: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  errorText: {
    fontSize: 13,
    color: "#b91c1c",
    fontWeight: "500",
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  kpiCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  employeeInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  employeeAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#e0e7ff",
    alignItems: "center",
    justifyContent: "center",
  },
  employeeAvatarText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#4338ca",
  },
  employeeName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  levelBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 3,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  scoreBox: {
    alignItems: "flex-end",
  },
  scoreNumber: {
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "#e2e8f0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#f8fafc",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  statCol: {
    alignItems: "center",
    flex: 1,
  },
  statVal: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  statSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#e2e8f0",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 12,
  },
  emptyLoadingText: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  resetFiltersBtn: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
  },
  resetFiltersBtnText: {
    fontSize: 13,
    color: "#334155",
    fontWeight: "600",
  },
});
