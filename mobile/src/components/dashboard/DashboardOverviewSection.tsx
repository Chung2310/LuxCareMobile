import React from "react";
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type {
  DashboardActionItems,
  DashboardDateFilter,
  DashboardSummary,
} from "../../../../src/types/dashboard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface DashboardOverviewSectionProps {
  summary: DashboardSummary | null;
  actionItems: DashboardActionItems | null;
  loading: boolean;
  filter: DashboardDateFilter;
  onFilterChange: (filter: DashboardDateFilter) => void;
  onRefresh: () => void;
  canViewExecutive?: boolean;
  onNavigate: (route: string, title?: string) => void;
}

const DATE_FILTERS: Array<{ id: DashboardDateFilter; label: string }> = [
  { id: "day", label: "Hôm nay" },
  { id: "week", label: "7 ngày qua" },
  { id: "year", label: "Năm nay" },
];

export const DashboardOverviewSection: React.FC<DashboardOverviewSectionProps> = ({
  summary,
  actionItems,
  loading,
  filter,
  onFilterChange,
  onRefresh,
  canViewExecutive = true,
  onNavigate,
}) => {
  // 1. Số liệu chấm công
  const totalEmployees = summary?.timekeeping?.totalEmployees || 0;
  const checkedInToday = summary?.timekeeping?.checkedInToday || 0;
  const lateToday = summary?.timekeeping?.lateToday || 0;
  const onTimeToday = Math.max(0, checkedInToday - lateToday);
  const notCheckedInToday = Math.max(0, totalEmployees - checkedInToday);

  const onTimePercent =
    totalEmployees > 0 ? Math.round((onTimeToday / totalEmployees) * 100) : 0;
  const latePercent =
    totalEmployees > 0 ? Math.round((lateToday / totalEmployees) * 100) : 0;
  const checkedInPercent =
    totalEmployees > 0 ? Math.round((checkedInToday / totalEmployees) * 100) : 0;
  const notCheckedPercent =
    totalEmployees > 0 ? Math.max(0, 100 - onTimePercent - latePercent) : 0;

  // 2. Số liệu công việc
  const tasksTotal = summary?.projects?.tasks?.total || 0;
  const tasksDone = summary?.projects?.tasks?.done || 0;
  const tasksDoing = summary?.projects?.tasks?.doing || 0;
  const tasksTodo = summary?.projects?.tasks?.todo || 0;
  const overdueTasks = summary?.projects?.overdueTasks || 0;

  const tasksDonePercent =
    tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;
  const tasksDoingPercent =
    tasksTotal > 0 ? Math.round((tasksDoing / tasksTotal) * 100) : 0;
  const tasksTodoPercent =
    tasksTotal > 0 ? Math.max(0, 100 - tasksDonePercent - tasksDoingPercent) : 0;

  // 3. Việc cần xử lý ngay
  const pendingApprovalsList = actionItems?.pendingApprovals || [];
  const overdueTasksList = actionItems?.overdueTasks || [];
  const totalActionCount = pendingApprovalsList.length + overdueTasksList.length;

  return (
    <View style={styles.container}>
      {/* HEADER SECTION: TIÊU ĐỀ + BỘ LỌC + LÀM MỚI */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.titleIconBadge}>
            <Ionicons name="pulse" size={17} color="#059669" />
          </View>
          <View>
            <Text style={styles.sectionTitle}>Bảng điều hành tổng quan</Text>
            <Text style={styles.sectionSubtitle}>
              Số liệu vận hành cơ sở theo thời gian thực
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={onRefresh}
          disabled={loading}
          hitSlop={8}
          activeOpacity={0.7}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#059669" />
          ) : (
            <Ionicons name="refresh-outline" size={17} color="#059669" />
          )}
        </TouchableOpacity>
      </View>

      {/* FILTER PILLS: HÔM NAY / 7 NGÀY / NĂM NAY */}
      <View style={styles.filterPillsRow}>
        {DATE_FILTERS.map((f) => {
          const isSelected = filter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterPill, isSelected && styles.filterPillActive]}
              onPress={() => onFilterChange(f.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterPillText,
                  isSelected && styles.filterPillTextActive,
                ]}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 1. KHỐI VIỆC CẦN XỬ LÝ NGAY (NẾU CÓ ĐƠN TỒN HOẶC QUÁ HẠN) */}
      {totalActionCount > 0 ? (
        <View style={styles.actionItemsCard}>
          <View style={styles.actionCardHeader}>
            <View style={styles.actionCardTitleRow}>
              <Ionicons name="alert-circle" size={18} color="#dc2626" />
              <Text style={styles.actionCardTitle}>Việc cần xử lý ngay</Text>
            </View>
            <View style={styles.actionCountBadge}>
              <Text style={styles.actionCountText}>
                {totalActionCount} cần xử lý
              </Text>
            </View>
          </View>

          <View style={styles.actionList}>
            {/* Đơn chờ duyệt */}
            {pendingApprovalsList.map((item) => (
              <TouchableOpacity
                key={`approval-${item.id}`}
                style={styles.actionItemRow}
                onPress={() => onNavigate("/(tabs)/leave", "Duyệt đơn từ")}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.actionItemIconBox,
                    { backgroundColor: "#fef3c7" },
                  ]}
                >
                  <Ionicons name="document-text" size={15} color="#d97706" />
                </View>
                <View style={styles.actionItemContent}>
                  <Text style={styles.actionItemMainText} numberOfLines={1}>
                    Đơn chờ duyệt: {item.employeeName}
                  </Text>
                  <Text style={styles.actionItemSubText}>
                    {item.since
                      ? new Date(item.since).toLocaleDateString("vi-VN")
                      : "Chờ phê duyệt"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color="#94a3b8" />
              </TouchableOpacity>
            ))}

            {/* Task quá hạn */}
            {overdueTasksList.map((item) => (
              <TouchableOpacity
                key={`overdue-${item.id}`}
                style={styles.actionItemRow}
                onPress={() => onNavigate("/(tabs)/work", "Công việc quá hạn")}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.actionItemIconBox,
                    { backgroundColor: "#fee2e2" },
                  ]}
                >
                  <Ionicons name="flame" size={15} color="#dc2626" />
                </View>
                <View style={styles.actionItemContent}>
                  <Text style={styles.actionItemMainText} numberOfLines={1}>
                    Quá hạn: {item.title}
                  </Text>
                  <Text style={[styles.actionItemSubText, { color: "#dc2626" }]}>
                    Hạn: {item.dueDate?.replace("T", " ") || "Đã quá hạn"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={15} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <View style={styles.actionClearStrip}>
          <Ionicons name="checkmark-circle" size={16} color="#059669" />
          <Text style={styles.actionClearText}>
            Tiến độ hoàn hảo: Không có đơn từ tồn đọng hay công việc quá hạn!
          </Text>
        </View>
      )}

      {/* 2. THẺ VẬN HÀNH 1: CHẤM CÔNG & NHÂN SỰ HÔM NAY */}
      <TouchableOpacity
        style={styles.heroCard}
        onPress={() => onNavigate("/(tabs)/attendance", "Chấm công")}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.cardIconBox, { backgroundColor: "#ecfdf5" }]}>
              <Ionicons name="time" size={17} color="#059669" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Chấm công & Đi làm</Text>
              <Text style={styles.cardSubtitle}>Tỷ lệ nhân sự có mặt hôm nay</Text>
            </View>
          </View>

          <View style={styles.statusPillGreen}>
            <Text style={styles.statusPillGreenText}>
              {checkedInToday}/{totalEmployees} ({checkedInPercent}%)
            </Text>
            <Ionicons name="chevron-forward" size={13} color="#059669" />
          </View>
        </View>

        {/* Thanh phân bổ chấm công nhiều màu */}
        <View style={styles.segmentedBarWrapper}>
          {onTimePercent > 0 && (
            <View
              style={[
                styles.segmentPart,
                { width: `${onTimePercent}%`, backgroundColor: "#059669" },
              ]}
            />
          )}
          {latePercent > 0 && (
            <View
              style={[
                styles.segmentPart,
                { width: `${latePercent}%`, backgroundColor: "#f59e0b" },
              ]}
            />
          )}
          {notCheckedPercent > 0 && (
            <View
              style={[
                styles.segmentPart,
                { width: `${notCheckedPercent}%`, backgroundColor: "#e2e8f0" },
              ]}
            />
          )}
        </View>

        {/* Dòng 3 chỉ số chi tiết */}
        <View style={styles.cardMetricsRow}>
          <View style={styles.metricCol}>
            <View style={styles.metricDotRow}>
              <View style={[styles.microDot, { backgroundColor: "#059669" }]} />
              <Text style={styles.metricLabel}>Đúng giờ</Text>
            </View>
            <Text style={[styles.metricValue, { color: "#059669" }]}>
              {onTimeToday}
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <View style={styles.metricDotRow}>
              <View style={[styles.microDot, { backgroundColor: "#f59e0b" }]} />
              <Text style={styles.metricLabel}>Đi muộn</Text>
            </View>
            <Text style={[styles.metricValue, { color: "#f59e0b" }]}>
              {lateToday}
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <View style={styles.metricDotRow}>
              <View style={[styles.microDot, { backgroundColor: "#94a3b8" }]} />
              <Text style={styles.metricLabel}>Chưa chấm</Text>
            </View>
            <Text style={[styles.metricValue, { color: "#64748b" }]}>
              {notCheckedInToday}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* 3. THẺ VẬN HÀNH 2: TIẾN ĐỘ CÔNG VIỆC & TASK */}
      <TouchableOpacity
        style={styles.heroCard}
        onPress={() => onNavigate("/(tabs)/work", "Công việc")}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={[styles.cardIconBox, { backgroundColor: "#eef2ff" }]}>
              <Ionicons name="checkbox" size={17} color="#4f46e5" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Tiến độ Công việc & Task</Text>
              <Text style={styles.cardSubtitle}>
                {tasksDone}/{tasksTotal} task đã giải quyết ({tasksDonePercent}%)
              </Text>
            </View>
          </View>

          <View style={styles.statusPillIndigo}>
            <Text style={styles.statusPillIndigoText}>
              {tasksDonePercent}% hoàn tất
            </Text>
            <Ionicons name="chevron-forward" size={13} color="#4f46e5" />
          </View>
        </View>

        {/* Thanh phân bổ công việc */}
        <View style={styles.segmentedBarWrapper}>
          {tasksDonePercent > 0 && (
            <View
              style={[
                styles.segmentPart,
                { width: `${tasksDonePercent}%`, backgroundColor: "#4f46e5" },
              ]}
            />
          )}
          {tasksDoingPercent > 0 && (
            <View
              style={[
                styles.segmentPart,
                { width: `${tasksDoingPercent}%`, backgroundColor: "#38bdf8" },
              ]}
            />
          )}
          {tasksTodoPercent > 0 && (
            <View
              style={[
                styles.segmentPart,
                { width: `${tasksTodoPercent}%`, backgroundColor: "#e2e8f0" },
              ]}
            />
          )}
        </View>

        {/* Dòng 3 chỉ số công việc */}
        <View style={styles.cardMetricsRow}>
          <View style={styles.metricCol}>
            <View style={styles.metricDotRow}>
              <View style={[styles.microDot, { backgroundColor: "#4f46e5" }]} />
              <Text style={styles.metricLabel}>Hoàn thành</Text>
            </View>
            <Text style={[styles.metricValue, { color: "#4f46e5" }]}>
              {tasksDone}
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <View style={styles.metricDotRow}>
              <View style={[styles.microDot, { backgroundColor: "#0284c7" }]} />
              <Text style={styles.metricLabel}>Đang làm</Text>
            </View>
            <Text style={[styles.metricValue, { color: "#0284c7" }]}>
              {tasksDoing}
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricCol}>
            <View style={styles.metricDotRow}>
              <View
                style={[
                  styles.microDot,
                  { backgroundColor: overdueTasks > 0 ? "#dc2626" : "#94a3b8" },
                ]}
              />
              <Text
                style={[
                  styles.metricLabel,
                  overdueTasks > 0 && { color: "#dc2626", fontWeight: "700" },
                ]}
              >
                Quá hạn
              </Text>
            </View>
            <Text
              style={[
                styles.metricValue,
                { color: overdueTasks > 0 ? "#dc2626" : "#64748b" },
              ]}
            >
              {overdueTasks}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* 4. DẢI 3 CAPSULE TINH GỌN: ĐÀO TẠO • TÀI NGUYÊN • THIẾT BỊ */}
      <View style={styles.capsulesRow}>
        {/* Đào tạo */}
        <TouchableOpacity
          style={styles.capsuleItem}
          onPress={() => onNavigate("/(tabs)/modules", "Đào tạo")}
          activeOpacity={0.8}
        >
          <View style={[styles.capsuleIcon, { backgroundColor: "#fffbeb" }]}>
            <Ionicons name="school" size={15} color="#d97706" />
          </View>
          <View style={styles.capsuleContent}>
            <Text style={[styles.capsuleNum, { color: "#d97706" }]}>
              {summary?.training?.totalCourses || 0}
            </Text>
            <Text style={styles.capsuleLabel} numberOfLines={1}>
              Khóa đào tạo
            </Text>
            <Text style={styles.capsuleSub}>
              {summary?.training?.enrollments?.inProgress || 0} đang học
            </Text>
          </View>
        </TouchableOpacity>

        {/* Tài nguyên */}
        <TouchableOpacity
          style={styles.capsuleItem}
          onPress={() => onNavigate("/(tabs)/resources", "Tài nguyên số")}
          activeOpacity={0.8}
        >
          <View style={[styles.capsuleIcon, { backgroundColor: "#ecfeff" }]}>
            <Ionicons name="folder-open" size={15} color="#0891b2" />
          </View>
          <View style={styles.capsuleContent}>
            <Text style={[styles.capsuleNum, { color: "#0891b2" }]}>
              {(summary?.resources?.fileCount || 0).toLocaleString("vi-VN")}
            </Text>
            <Text style={styles.capsuleLabel} numberOfLines={1}>
              Tài nguyên số
            </Text>
            <Text style={styles.capsuleSub}>
              +{summary?.resources?.recentUploads || 0} mới
            </Text>
          </View>
        </TouchableOpacity>

        {/* Thiết bị y tế */}
        <TouchableOpacity
          style={styles.capsuleItem}
          onPress={() => onNavigate("/(tabs)/equipment", "Thiết bị y tế")}
          activeOpacity={0.8}
        >
          <View style={[styles.capsuleIcon, { backgroundColor: "#f5f3ff" }]}>
            <Ionicons name="medkit" size={15} color="#7c3aed" />
          </View>
          <View style={styles.capsuleContent}>
            <Text style={[styles.capsuleNum, { color: "#7c3aed" }]}>
              {(summary?.equipment?.total || 0).toLocaleString("vi-VN")}
            </Text>
            <Text style={styles.capsuleLabel} numberOfLines={1}>
              Thiết bị y tế
            </Text>
            <Text style={styles.capsuleSub}>Đang chạy</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },

  // 1. Header khu vực
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  titleIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  refreshButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },

  // 2. Filter Pills
  filterPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  filterPill: {
    paddingHorizontal: 13,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterPillActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#64748b",
  },
  filterPillTextActive: {
    color: "#ffffff",
  },

  // Action Clear Strip (khi 0 việc tồn)
  actionClearStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginBottom: 14,
  },
  actionClearText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#166534",
    flex: 1,
  },

  // Action items card (khi có việc tồn đọng)
  actionItemsCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  actionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  actionCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionCardTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#991b1b",
  },
  actionCountBadge: {
    backgroundColor: "#fef2f2",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  actionCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#dc2626",
  },
  actionList: {
    gap: 7,
  },
  actionItemRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    padding: 9,
    borderRadius: 10,
    gap: 9,
  },
  actionItemIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  actionItemContent: {
    flex: 1,
  },
  actionItemMainText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#1e293b",
  },
  actionItemSubText: {
    fontSize: 10.5,
    color: "#64748b",
    marginTop: 1,
  },

  // HERO CARDS (CHẤM CÔNG & CÔNG VIỆC)
  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  cardIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  cardTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardSubtitle: {
    fontSize: 10.5,
    color: "#64748b",
    marginTop: 1,
  },
  statusPillGreen: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  statusPillGreenText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  statusPillIndigo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  statusPillIndigoText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4f46e5",
  },

  // Segmented multi-color progress bar
  segmentedBarWrapper: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "#f1f5f9",
    flexDirection: "row",
    overflow: "hidden",
    marginBottom: 12,
  },
  segmentPart: {
    height: "100%",
  },

  // 3 Metrics row
  cardMetricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  metricCol: {
    flex: 1,
    alignItems: "center",
  },
  metricDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 3,
  },
  microDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metricLabel: {
    fontSize: 10.5,
    color: "#64748b",
    fontWeight: "500",
  },
  metricValue: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  metricDivider: {
    width: 1,
    height: 22,
    backgroundColor: "#e2e8f0",
  },

  // CAPSULES ROW (ĐÀO TẠO, TÀI NGUYÊN, THIẾT BỊ)
  capsulesRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  capsuleItem: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  capsuleIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  capsuleContent: {
    alignItems: "center",
    width: "100%",
  },
  capsuleNum: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 1,
  },
  capsuleLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#334155",
    textAlign: "center",
  },
  capsuleSub: {
    fontSize: 9.5,
    color: "#94a3b8",
    marginTop: 2,
    textAlign: "center",
  },
});
