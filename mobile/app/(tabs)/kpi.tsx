import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import { monthlyKpi, kanban } from "../../src/api/services";
import type { HRTask } from "../../../src/types/hr";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { EmptyState, Page } from "../../src/ui";
import { WorkSectionTabs, type WorkSection } from "../../src/features/work/WorkSectionTabs";
import {
  normalizePriority,
  normalizeTaskStatus,
} from "../../src/features/work/model";

function formatTaskDueDate(dueDateString?: string, isCompleted = false) {
  if (!dueDateString) return { text: "Chưa đặt", isOverdue: false, isToday: false };
  try {
    const due = new Date(dueDateString);
    if (isNaN(due.getTime())) return { text: dueDateString, isOverdue: false, isToday: false };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const diffDays = Math.round((dueStart - todayStart) / (1000 * 60 * 60 * 24));

    const dateFormatted = `${String(due.getDate()).padStart(2, "0")}/${String(due.getMonth() + 1).padStart(2, "0")}`;

    if (!isCompleted && diffDays < 0) {
      return {
        text: `Quá hạn ${Math.abs(diffDays)} ngày (${dateFormatted})`,
        isOverdue: true,
        isToday: false,
      };
    }
    if (!isCompleted && diffDays === 0) {
      return {
        text: `Hạn chót hôm nay (${String(due.getHours()).padStart(2, "0")}:${String(due.getMinutes()).padStart(2, "0")})`,
        isOverdue: false,
        isToday: true,
      };
    }
    if (diffDays === 1) {
      return { text: `Ngày mai (${dateFormatted})`, isOverdue: false, isToday: false };
    }
    return { text: `Hạn: ${dateFormatted}`, isOverdue: false, isToday: false };
  } catch {
    return { text: dueDateString, isOverdue: false, isToday: false };
  }
}

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

function getTaskKpiDetail(task: HRTask) {
  const normStatus = normalizeTaskStatus(task.status);
  const isDone = normStatus === "Done";

  let isOverdue = false;
  let diffHours = 0;
  if (task.dueDate) {
    const dueTime = new Date(task.dueDate).getTime();
    if (Number.isFinite(dueTime)) {
      const compareTime = isDone
        ? task.completedAt
          ? new Date(task.completedAt).getTime()
          : task.endTime
          ? new Date(task.endTime).getTime()
          : Date.now()
        : Date.now();
      if (compareTime > dueTime) {
        isOverdue = true;
        diffHours = Math.round((compareTime - dueTime) / (1000 * 60 * 60));
      }
    }
  }

  if (isDone) {
    if (isOverdue) {
      return {
        status: "completed_late",
        isOntime: false,
        label: "Hoàn thành trễ",
        sub: diffHours > 24 ? `Trễ ${Math.round(diffHours / 24)} ngày` : `Trễ ${diffHours}h`,
        color: "#d97706",
        bg: "#fffbeb",
        borderColor: "#fde68a",
        icon: "⚠️",
      };
    }
    return {
      status: "completed_ontime",
      isOntime: true,
      label: "Đúng hạn (Đạt KPI)",
      sub: "Hoàn thành chuẩn deadline",
      color: "#059669",
      bg: "#ecfdf5",
      borderColor: "#a7f3d0",
      icon: "🎯",
    };
  }

  if (isOverdue) {
    return {
      status: "overdue",
      isOntime: false,
      label: "Quá hạn (Chưa đạt)",
      sub: diffHours > 24 ? `Quá hạn ${Math.round(diffHours / 24)} ngày` : `Quá hạn ${diffHours}h`,
      color: "#dc2626",
      bg: "#fef2f2",
      borderColor: "#fca5a5",
      icon: "🔴",
    };
  }

  if (normStatus === "In Progress") {
    return {
      status: "in_progress",
      isOntime: false,
      label: "Đang làm",
      sub: "Trong thời hạn",
      color: "#2563eb",
      bg: "#eff6ff",
      borderColor: "#bfdbfe",
      icon: "⏳",
    };
  }

  return {
    status: "todo",
    isOntime: false,
    label: "Chưa bắt đầu",
    sub: "Chờ triển khai",
    color: "#64748b",
    bg: "#f1f5f9",
    borderColor: "#e2e8f0",
    icon: "⚪",
  };
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
  const [allTasks, setAllTasks] = useState<HRTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");

  const [expandedEmployees, setExpandedEmployees] = useState<Set<string>>(new Set());
  const [taskFilterMap, setTaskFilterMap] = useState<Record<string, "all" | "ontime" | "pending">>({});
  const [selectedTask, setSelectedTask] = useState<HRTask | null>(null);

  // Fetch report and all branch tasks
  useEffect(() => {
    let active = true;
    setReport(null);
    if (!allowed) return;
    setLoading(true);
    setError(null);

    Promise.all([
      monthlyKpi.report(period, branchId),
      kanban.listTasks(branchId).catch(() => []),
    ])
      .then(([reportData, taskList]) => {
        if (active) {
          setReport(reportData);
          setAllTasks(taskList);
        }
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

  useFocusEffect(
    useCallback(() => {
      setRevision((v) => v + 1);
    }, []),
  );

  // Index tasks by employee identifier
  const employeeTasksMap = useMemo(() => {
    const map = new Map<string, HRTask[]>();
    allTasks.forEach((task) => {
      const uidKey = task.assigneeUid;
      const nameKey = task.assignee ? task.assignee.trim().toLowerCase() : "";

      if (uidKey) {
        const list = map.get(uidKey) || [];
        list.push(task);
        map.set(uidKey, list);
      }
      if (nameKey) {
        const list = map.get(nameKey) || [];
        list.push(task);
        map.set(nameKey, list);
      }
    });
    return map;
  }, [allTasks]);

  const getTasksForEmployee = useCallback(
    (empId: string, empName: string): HRTask[] => {
      const byId = employeeTasksMap.get(empId) || [];
      const byName = employeeTasksMap.get(empName.trim().toLowerCase()) || [];
      const seen = new Set<string>();
      const merged: HRTask[] = [];
      [...byId, ...byName].forEach((t) => {
        if (!seen.has(t.id)) {
          seen.add(t.id);
          merged.push(t);
        }
      });

      // Prefer tasks belonging to the current month period if available
      const periodFiltered = merged.filter((t) => {
        const d =
          t.dueDate ||
          t.completedAt ||
          t.startTime ||
          (typeof t.createdAt === "string" ? t.createdAt : "");
        if (d && d.length >= 7) {
          return d.includes(period);
        }
        return true;
      });

      return periodFiltered.length > 0 ? periodFiltered : merged;
    },
    [employeeTasksMap, period],
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

  const totalEmployees = rows.length;
  const totalTasks = rows.reduce((acc, r) => acc + r.totalTasks, 0);
  const totalCompleted = rows.reduce((acc, r) => acc + r.completedTasks, 0);
  const totalPending = rows.reduce((acc, r) => acc + r.pendingTasks, 0);
  const avgPercent = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : null;
  const isClosed = report?.periodStatus === "closed";
  const [yearStr, monthStr] = period.split("-");

  const toggleEmployeeExpand = (empId: string) => {
    setExpandedEmployees((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const toggleExpandAll = () => {
    if (expandedEmployees.size === rows.length) {
      setExpandedEmployees(new Set());
    } else {
      setExpandedEmployees(new Set(rows.map((r) => r.employeeId)));
    }
  };

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
          <Text style={[styles.metricNumber, { color: "#0f172a" }]}>{totalTasks}</Text>
          <Text style={styles.metricLabel}>Tổng việc</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={[styles.metricNumber, { color: "#2563eb" }]}>{totalCompleted}</Text>
          <Text style={styles.metricLabel}>Đúng hạn</Text>
        </View>

        <View style={styles.metricCard}>
          <Text style={[styles.metricNumber, { color: "#dc2626" }]}>{totalPending}</Text>
          <Text style={styles.metricLabel}>Chưa đạt</Text>
        </View>
      </View>

      {/* Search Input Bar + Expand All Toggle */}
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

        {rows.length > 0 && (
          <View style={styles.globalActionsRow}>
            <Text style={styles.totalEmpCountText}>Hiển thị {rows.length} nhân sự</Text>
            <Pressable style={styles.expandAllBtn} onPress={toggleExpandAll}>
              <Text style={styles.expandAllBtnText}>
                {expandedEmployees.size === rows.length ? "▲ Thu gọn tất cả" : "▼ Mở rộng tất cả"}
              </Text>
            </Pressable>
          </View>
        )}
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
          const isExpanded = expandedEmployees.has(item.employeeId);
          const empTasks = getTasksForEmployee(item.employeeId, item.employeeName);
          const currentFilter = taskFilterMap[item.employeeId] || "all";

          const ontimeTasks = empTasks.filter((t) => getTaskKpiDetail(t).isOntime);
          const pendingTasks = empTasks.filter((t) => !getTaskKpiDetail(t).isOntime);

          const displayedTasks =
            currentFilter === "ontime"
              ? ontimeTasks
              : currentFilter === "pending"
              ? pendingTasks
              : empTasks;

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

              {/* Expand / Collapse Button for Individual Tasks */}
              <Pressable
                style={styles.expandToggleBtn}
                onPress={() => toggleEmployeeExpand(item.employeeId)}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 13 }}>📋</Text>
                  <Text style={styles.expandToggleText}>
                    {isExpanded
                      ? `Thu gọn danh sách việc (${empTasks.length})`
                      : `Xem chi tiết ${empTasks.length} việc tính KPI`}
                  </Text>
                </View>
                <Text style={styles.expandChevron}>{isExpanded ? "▲" : "▼"}</Text>
              </Pressable>

              {/* Detailed Task Breakdown per Employee */}
              {isExpanded && (
                <View style={styles.taskListContainer}>
                  {/* Task Filter Chips */}
                  <View style={styles.taskFilterRow}>
                    <Pressable
                      style={[styles.filterChip, currentFilter === "all" && styles.filterChipActive]}
                      onPress={() =>
                        setTaskFilterMap((prev) => ({ ...prev, [item.employeeId]: "all" }))
                      }
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          currentFilter === "all" && styles.filterChipTextActive,
                        ]}
                      >
                        Tất cả ({empTasks.length})
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.filterChip, currentFilter === "ontime" && styles.filterChipActive]}
                      onPress={() =>
                        setTaskFilterMap((prev) => ({ ...prev, [item.employeeId]: "ontime" }))
                      }
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          currentFilter === "ontime" && styles.filterChipTextActive,
                        ]}
                      >
                        🎯 Đạt KPI ({ontimeTasks.length})
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[styles.filterChip, currentFilter === "pending" && styles.filterChipActive]}
                      onPress={() =>
                        setTaskFilterMap((prev) => ({ ...prev, [item.employeeId]: "pending" }))
                      }
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          currentFilter === "pending" && styles.filterChipTextActive,
                        ]}
                      >
                        ⚠️ Chưa đạt ({pendingTasks.length})
                      </Text>
                    </Pressable>
                  </View>

                  {/* List of Tasks for this Employee */}
                  {displayedTasks.length === 0 ? (
                    <View style={styles.emptyTaskBox}>
                      <Text style={styles.emptyTaskText}>Không có công việc nào trong danh mục này.</Text>
                    </View>
                  ) : (
                    displayedTasks.map((task) => {
                      const kpiDetail = getTaskKpiDetail(task);
                      const normPri = normalizePriority(task.priority || "Medium");

                      return (
                        <Pressable
                          key={task.id}
                          style={[styles.taskItemCard, { borderLeftColor: kpiDetail.color }]}
                          onPress={() => setSelectedTask(task)}
                        >
                          <View style={styles.taskItemHeader}>
                            {/* KPI status badge */}
                            <View
                              style={[
                                styles.taskKpiBadge,
                                {
                                  backgroundColor: kpiDetail.bg,
                                  borderColor: kpiDetail.borderColor,
                                },
                              ]}
                            >
                              <Text style={{ fontSize: 10 }}>{kpiDetail.icon}</Text>
                              <Text style={[styles.taskKpiBadgeText, { color: kpiDetail.color }]}>
                                {kpiDetail.label}
                              </Text>
                            </View>

                            {/* Priority */}
                            <Text style={styles.taskPriorityBadge}>{normPri}</Text>
                          </View>

                          <Text style={styles.taskItemTitle} numberOfLines={2}>
                            {task.title}
                          </Text>

                          <View style={styles.taskItemMeta}>
                            <Text style={styles.taskDueDateText}>
                              📅 {formatTaskDueDate(task.dueDate, task.status === "Done" || task.status === "done").text}
                            </Text>

                            {!!(task.estTime || task.actualTime) && (
                              <Text style={styles.taskTimeText}>
                                ⏱️ {task.actualTime || 0}h / {task.estTime || 0}h
                              </Text>
                            )}

                            {task.subtasks && task.subtasks.length > 0 && (
                              <Text style={styles.taskSubtasksText}>
                                ✓ {task.subtasks.filter((s) => s.completed).length}/{task.subtasks.length}
                              </Text>
                            )}
                          </View>

                          <Text style={styles.taskKpiSubText}>{kpiDetail.sub}</Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              )}
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

      {/* Task Detail Modal */}
      {selectedTask && (
        <Modal
          visible={!!selectedTask}
          transparent
          animationType="slide"
          onRequestClose={() => setSelectedTask(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle} numberOfLines={1}>
                  Chi tiết công việc KPI
                </Text>
                <Pressable
                  style={styles.modalCloseBtn}
                  onPress={() => setSelectedTask(null)}
                >
                  <Text style={{ fontSize: 16, color: "#64748b", fontWeight: "700" }}>✕</Text>
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 12, paddingVertical: 6 }}>
                  {/* Task KPI Rating banner */}
                  {(() => {
                    const detail = getTaskKpiDetail(selectedTask);
                    return (
                      <View
                        style={[
                          styles.modalKpiBanner,
                          {
                            backgroundColor: detail.bg,
                            borderColor: detail.borderColor,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 18 }}>{detail.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.modalKpiTitle, { color: detail.color }]}>
                            {detail.label}
                          </Text>
                          <Text style={styles.modalKpiDesc}>{detail.sub}</Text>
                        </View>
                      </View>
                    );
                  })()}

                  <View>
                    <Text style={styles.taskDetailLabel}>Tiêu đề công việc:</Text>
                    <Text style={styles.taskDetailTitle}>{selectedTask.title}</Text>
                  </View>

                  {!!selectedTask.description && (
                    <View>
                      <Text style={styles.taskDetailLabel}>Mô tả:</Text>
                      <Text style={styles.taskDetailDesc}>{selectedTask.description}</Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>👤 Phụ trách:</Text>
                    <Text style={styles.detailValue}>
                      {selectedTask.assignee || "Chưa gán"}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>📅 Hạn hoàn thành:</Text>
                    <Text style={styles.detailValue}>
                      {selectedTask.dueDate || "Chưa đặt deadline"}
                    </Text>
                  </View>

                  {!!selectedTask.completedAt && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>🏁 Hoàn thành lúc:</Text>
                      <Text style={styles.detailValue}>
                        {new Date(selectedTask.completedAt).toLocaleString("vi-VN")}
                      </Text>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>⏱️ Thời lượng:</Text>
                    <Text style={styles.detailValue}>
                      {selectedTask.actualTime || 0}h thực tế / {selectedTask.estTime || 0}h kế hoạch
                    </Text>
                  </View>

                  {/* Subtasks */}
                  {selectedTask.subtasks && selectedTask.subtasks.length > 0 && (
                    <View style={{ gap: 6 }}>
                      <Text style={styles.taskDetailLabel}>
                        Công việc con ({selectedTask.subtasks.filter((s) => s.completed).length}/
                        {selectedTask.subtasks.length}):
                      </Text>
                      {selectedTask.subtasks.map((st) => (
                        <View key={st.id} style={styles.subtaskRow}>
                          <Text style={{ fontSize: 13, color: st.completed ? "#059669" : "#64748b" }}>
                            {st.completed ? "✓" : "○"}
                          </Text>
                          <Text
                            style={[
                              styles.subtaskText,
                              st.completed && styles.subtaskTextCompleted,
                            ]}
                          >
                            {st.title}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>

              <View style={styles.modalFooter}>
                <Pressable
                  style={styles.modalActionBtn}
                  onPress={() => {
                    setSelectedTask(null);
                    router.push("/(tabs)/work");
                  }}
                >
                  <Text style={styles.modalActionBtnText}>Mở trong bảng Công việc →</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
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
    paddingBottom: 8,
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
  globalActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginTop: 8,
  },
  totalEmpCountText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  expandAllBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
  },
  expandAllBtnText: {
    fontSize: 11,
    color: "#059669",
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

  /* Task Breakdown within Employee Card */
  expandToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  expandToggleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#334155",
  },
  expandChevron: {
    fontSize: 10,
    color: "#64748b",
  },
  taskListContainer: {
    marginTop: 4,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
  },
  taskFilterRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterChipActive: {
    backgroundColor: "#eff6ff",
    borderColor: "#93c5fd",
  },
  filterChipText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
  },
  filterChipTextActive: {
    color: "#1d4ed8",
    fontWeight: "800",
  },
  emptyTaskBox: {
    padding: 12,
    alignItems: "center",
  },
  emptyTaskText: {
    fontSize: 11,
    color: "#94a3b8",
  },
  taskItemCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
    padding: 10,
    gap: 4,
  },
  taskItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  taskKpiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  taskKpiBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  taskPriorityBadge: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
  },
  taskItemTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 2,
  },
  taskItemMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 2,
  },
  taskDueDateText: {
    fontSize: 11,
    color: "#64748b",
  },
  taskTimeText: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "600",
  },
  taskSubtasksText: {
    fontSize: 11,
    color: "#059669",
    fontWeight: "600",
  },
  taskKpiSubText: {
    fontSize: 10,
    color: "#94a3b8",
    marginTop: 1,
  },

  /* Task Detail Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    flex: 1,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalKpiBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalKpiTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  modalKpiDesc: {
    fontSize: 11,
    color: "#475569",
    marginTop: 2,
  },
  taskDetailLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
  },
  taskDetailTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  taskDetailDesc: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 18,
    marginTop: 2,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "600",
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtaskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  subtaskText: {
    fontSize: 12,
    color: "#334155",
  },
  subtaskTextCompleted: {
    textDecorationLine: "line-through",
    color: "#94a3b8",
  },
  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
    marginTop: 8,
  },
  modalActionBtn: {
    backgroundColor: "#059669",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalActionBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },

  /* Empty state */
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
