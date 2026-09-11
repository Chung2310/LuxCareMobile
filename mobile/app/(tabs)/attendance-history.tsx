import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { attendance } from "../../src/api/services";
import type { AttendanceLog, AttendanceAdjustment, ShiftEmployee, WorkShift } from "../../../src/services/attendanceService";
import { currentKpiPeriod } from "../../../src/services/monthlyKpiService";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { AdjustmentForm } from "../../src/features/attendance/AdjustmentForm";
import { EmptyState, ErrorText, Loading } from "../../src/ui";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  Present: { label: "Có mặt", color: "#059669", bg: "#ecfdf5", icon: "checkmark-circle" },
  Late: { label: "Đi muộn", color: "#d97706", bg: "#fffbeb", icon: "alert-circle" },
  "Left-Early": { label: "Về sớm", color: "#ea580c", bg: "#fff7ed", icon: "exit-outline" },
  "Half-Day": { label: "Nửa ngày", color: "#7c3aed", bg: "#f5f3ff", icon: "hourglass-outline" },
  "Late-Left-Early": { label: "Muộn & Về sớm", color: "#e11d48", bg: "#fff1f2", icon: "warning-outline" },
  Absent: { label: "Vắng mặt", color: "#dc2626", bg: "#fef2f2", icon: "close-circle" },
  "Approved-Leave": { label: "Nghỉ phép duyệt", color: "#2563eb", bg: "#eff6ff", icon: "document-text" },
  "Paid-Holiday": { label: "Nghỉ lễ", color: "#0891b2", bg: "#ecfeff", icon: "ribbon" },
};

type FilterType = "all" | "present" | "late" | "leave" | "absent";

function prevMonth(p: string): string {
  const [y, m] = p.split("-").map(Number);
  const prevDate = new Date(Date.UTC(y, m - 2, 1));
  return `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(p: string): string {
  const [y, m] = p.split("-").map(Number);
  const nextDate = new Date(Date.UTC(y, m, 1));
  return `${nextDate.getUTCFullYear()}-${String(nextDate.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatDisplayDate(dateStr?: string): { dayOfWeek: string; dateFormatted: string } {
  if (!dateStr) return { dayOfWeek: "", dateFormatted: "" };
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const daysOfWeek = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  const dayOfWeek = daysOfWeek[date.getDay()] || "";
  const dateFormatted = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
  return { dayOfWeek, dateFormatted };
}

function formatTimeOnly(timeStr?: string | Date): string {
  if (!timeStr) return "--:--";
  const date = new Date(timeStr);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function calculateWorkHours(checkIn?: string | Date, checkOut?: string | Date): { hours: number; mins: number; text: string } {
  if (!checkIn || !checkOut) return { hours: 0, mins: 0, text: "--" };
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  const diffMs = end - start;
  if (diffMs <= 0) return { hours: 0, mins: 0, text: "--" };
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return { hours, mins, text: `${hours}h ${mins > 0 ? `${mins}m` : ""}` };
}

export default function AttendanceHistoryScreen() {
  const { user, selectedBranch } = useSession();
  const params = useLocalSearchParams<{ employeeId?: string; period?: string; from?: string }>();
  const allowed = canUseModule(user, "hr");
  const manage = hasPermission(user, "timekeeping:manage");

  // Selection states
  const [period, setPeriod] = useState<string>(params.period || currentKpiPeriod());
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>(params.employeeId || user?.uid || "");
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>(user?.displayName || user?.email || "Cá nhân");
  const [filter, setFilter] = useState<FilterType>("all");

  // Data states
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [people, setPeople] = useState<ShiftEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  // Detail Modal & Adjustment
  const [detailLog, setDetailLog] = useState<AttendanceLog | null>(null);
  const [detailAdjustments, setDetailAdjustments] = useState<AttendanceAdjustment[]>([]);
  const [loadingAdjustments, setLoadingAdjustments] = useState(false);
  const [adjustingLog, setAdjustingLog] = useState<AttendanceLog | null>(null);
  const lock = useRef(false);

  // Employee Picker Modal (For managers)
  const [pickerVisible, setPickerVisible] = useState(false);
  const [searchEmployee, setSearchEmployee] = useState("");

  // Load employee list for managers
  useEffect(() => {
    if (!manage || !allowed) return;
    let active = true;
    attendance
      .assignments()
      .then((rows) => {
        if (active) setPeople(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [manage, allowed]);

  // Load shifts for metadata
  useEffect(() => {
    if (!allowed) return;
    let active = true;
    attendance
      .shifts()
      .then((rows) => {
        if (active) setShifts(rows);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [allowed]);

  // Main data loader
  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!allowed || !user?.companyCode) return;
      const targetUid = selectedEmployeeId || user.uid;
      if (!targetUid) return;

      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [year, month] = period.split("-").map(Number);
      const endDate = `${period}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;

      try {
        const rows = await attendance.history(targetUid, user.companyCode, `${period}-01`, endDate);
        // Sort newest first
        rows.sort((a, b) => b.date.localeCompare(a.date));
        setLogs(rows);
      } catch (err) {
        setError(messageOf(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [allowed, user?.companyCode, user?.uid, selectedEmployeeId, period],
  );

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData, revision]),
  );

  // Fetch adjustments when opening detail modal
  const openDetail = (log: AttendanceLog) => {
    setDetailLog(log);
    setDetailAdjustments([]);
    setLoadingAdjustments(true);
    attendance
      .adjustments(log._id)
      .then((adj) => setDetailAdjustments(adj))
      .catch(() => {})
      .finally(() => setLoadingAdjustments(false));
  };

  // Stats calculation
  const stats = useMemo(() => {
    let presentDays = 0;
    let lateOrEarly = 0;
    let leave = 0;
    let absent = 0;
    let totalMinutesWorked = 0;

    logs.forEach((l) => {
      const isPres = l.status === "Present" || (!l.status && l.checkIn);
      const isLate = l.status === "Late" || l.status === "Left-Early" || l.status === "Late-Left-Early";
      const isLev = l.status === "Approved-Leave" || l.status === "Paid-Holiday";
      const isAbs = l.status === "Absent";

      if (isPres) presentDays++;
      if (isLate) {
        lateOrEarly++;
        presentDays++; // Counted as work day with delay
      }
      if (isLev) leave++;
      if (isAbs) absent++;

      if (l.checkIn?.time && l.checkOut?.time) {
        const start = new Date(l.checkIn.time).getTime();
        const end = new Date(l.checkOut.time).getTime();
        if (end > start) {
          totalMinutesWorked += Math.floor((end - start) / (1000 * 60));
        }
      }
    });

    const totalHours = Math.floor(totalMinutesWorked / 60);
    const totalMinsRem = totalMinutesWorked % 60;
    const hoursFormatted = `${totalHours}h ${totalMinsRem > 0 ? `${totalMinsRem}m` : ""}`;

    return {
      totalLogs: logs.length,
      presentDays,
      lateOrEarly,
      leave,
      absent,
      hoursFormatted: totalHours > 0 ? hoursFormatted : "0h",
    };
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filter === "all") return true;
      if (filter === "present") return log.status === "Present" || (!log.status && log.checkIn);
      if (filter === "late")
        return log.status === "Late" || log.status === "Left-Early" || log.status === "Late-Left-Early";
      if (filter === "leave") return log.status === "Approved-Leave" || log.status === "Paid-Holiday";
      if (filter === "absent") return log.status === "Absent";
      return true;
    });
  }, [logs, filter]);

  // Shift lookup helper
  const shiftMap = useMemo(() => {
    const map = new Map<string, WorkShift>();
    shifts.forEach((s) => map.set(s._id, s));
    return map;
  }, [shifts]);

  const filteredEmployees = useMemo(() => {
    if (!searchEmployee.trim()) return people;
    const q = searchEmployee.toLowerCase();
    return people.filter(
      (p) => (p.displayName && p.displayName.toLowerCase().includes(q)) || p.email.toLowerCase().includes(q),
    );
  }, [people, searchEmployee]);

  // Calendar view states & calculations
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");

  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
    const initPeriod = params.period || currentKpiPeriod();
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const t = `${y}-${m}-${d}`;
    return t.startsWith(initPeriod) ? t : `${initPeriod}-01`;
  });

  useEffect(() => {
    if (!selectedCalendarDate.startsWith(period)) {
      setSelectedCalendarDate(todayStr.startsWith(period) ? todayStr : `${period}-01`);
    }
  }, [period, todayStr, selectedCalendarDate]);

  const logMap = useMemo(() => {
    const map = new Map<string, AttendanceLog>();
    logs.forEach((log) => {
      map.set(log.date, log);
    });
    return map;
  }, [logs]);

  const selectedDayLog = useMemo(() => {
    return logMap.get(selectedCalendarDate);
  }, [logMap, selectedCalendarDate]);

  const calendarDays = useMemo(() => {
    const [year, month] = period.split("-").map(Number);
    const totalDays = new Date(year, month, 0).getDate();
    const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
    // Monday is first day of week in Vietnam:
    const offset = (firstDayOfWeek + 6) % 7;

    const days: Array<{
      dayNum: number | null;
      dateStr: string | null;
      isToday: boolean;
      isWeekend: boolean;
      isFuture: boolean;
      log?: AttendanceLog;
      statusType?: "present" | "late" | "leave" | "absent" | "empty";
    }> = [];

    // Empty leading padding cells
    for (let i = 0; i < offset; i++) {
      days.push({
        dayNum: null,
        dateStr: null,
        isToday: false,
        isWeekend: false,
        isFuture: false,
      });
    }

    // Days in current month
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${period}-${String(d).padStart(2, "0")}`;
      const dayOfWeek = new Date(year, month - 1, d).getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isToday = dateStr === todayStr;
      const isFuture = dateStr > todayStr;
      const log = logMap.get(dateStr);

      let statusType: "present" | "late" | "leave" | "absent" | "empty" = "empty";
      if (log) {
        if (log.status === "Present" || (!log.status && log.checkIn)) {
          statusType = "present";
        } else if (
          log.status === "Late" ||
          log.status === "Left-Early" ||
          log.status === "Late-Left-Early"
        ) {
          statusType = "late";
        } else if (log.status === "Approved-Leave" || log.status === "Paid-Holiday") {
          statusType = "leave";
        } else if (log.status === "Absent") {
          statusType = "absent";
        } else {
          statusType = "present";
        }
      }

      days.push({
        dayNum: d,
        dateStr,
        isToday,
        isWeekend,
        isFuture,
        log,
        statusType,
      });
    }

    return days;
  }, [period, todayStr, logMap]);

  if (!allowed) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#0f172a" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Lịch sử chấm công</Text>
        </View>
        <EmptyState
          message="Không có quyền truy cập"
          subtitle="Tài khoản của bạn chưa được cấp quyền phân hệ Nhân sự & Chấm công."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      {/* HEADER BAR */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={() => {
            if (params.from === "modules") router.replace("/(tabs)/modules");
            else if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/modules");
          }}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={22} color="#0f172a" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>Lịch sử chấm công</Text>
          <View style={styles.headerSubtitleRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {selectedEmployeeName} · {selectedBranch?.name || user?.branchName || "Chi nhánh chính"}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {manage && (
            <TouchableOpacity
              style={styles.employeeSelectBtn}
              onPress={() => setPickerVisible(true)}
              activeOpacity={0.8}
            >
              <Ionicons name="people-outline" size={17} color="#0891b2" />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.reloadBtn}
            onPress={() => void loadData(true)}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Ionicons name="reload" size={17} color="#475569" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadData(true)}
            colors={["#0891b2"]}
            tintColor="#0891b2"
          />
        }
      >
        {/* EMPLOYEE PICKER INDICATOR BANNER (For Managers) */}
        {manage && selectedEmployeeId !== user?.uid && (
          <View style={styles.managerTargetBanner}>
            <Ionicons name="person" size={15} color="#0891b2" />
            <Text style={styles.managerTargetText} numberOfLines={1}>
              Đang xem hồ sơ: <Text style={{ fontWeight: "700" }}>{selectedEmployeeName}</Text>
            </Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedEmployeeId(user?.uid || "");
                setSelectedEmployeeName(user?.displayName || user?.email || "Cá nhân");
              }}
              style={styles.resetEmployeeBtn}
            >
              <Text style={styles.resetEmployeeText}>Xem của tôi</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* MONTH SELECTOR CARD */}
        <View style={styles.monthCard}>
          <TouchableOpacity
            style={styles.monthNavBtn}
            onPress={() => setPeriod((p) => prevMonth(p))}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={20} color="#0f172a" />
          </TouchableOpacity>

          <View style={styles.monthCenterBox}>
            <View style={styles.monthTitleRow}>
              <Ionicons name="calendar" size={16} color="#0891b2" />
              <Text style={styles.monthTitleText}>
                Tháng {period.split("-")[1]}/{period.split("-")[0]}
              </Text>
            </View>
            <Text style={styles.monthSubtitleText}>
              {period === currentKpiPeriod() ? "Kỳ công hiện tại" : "Dữ liệu kỳ đối soát"}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.monthNavBtn, period >= currentKpiPeriod() && styles.monthNavBtnDisabled]}
            disabled={period >= currentKpiPeriod()}
            onPress={() => setPeriod((p) => nextMonth(p))}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={period >= currentKpiPeriod() ? "#cbd5e1" : "#0f172a"}
            />
          </TouchableOpacity>
        </View>

        {/* METRICS & OVERVIEW DASHBOARD */}
        <View style={styles.dashboardContainer}>
          <View style={styles.dashboardHeader}>
            <Text style={styles.dashboardTitle}>Tổng quan ngày công</Text>
            <TouchableOpacity
              style={styles.quickCheckInLink}
              onPress={() => router.push("/(tabs)/attendance")}
              activeOpacity={0.7}
            >
              <Text style={styles.quickCheckInText}>Vào chấm công</Text>
              <Ionicons name="arrow-forward" size={12} color="#0891b2" />
            </TouchableOpacity>
          </View>

          <View style={styles.metricsGrid}>
            {/* Card 1: Số ngày công */}
            <View style={[styles.metricCard, { borderTopColor: "#059669" }]}>
              <View style={[styles.metricIconWrap, { backgroundColor: "#ecfdf5" }]}>
                <Ionicons name="checkmark-done" size={16} color="#059669" />
              </View>
              <Text style={[styles.metricValue, { color: "#059669" }]}>{stats.presentDays}</Text>
              <Text style={styles.metricLabel}>Ngày công</Text>
            </View>

            {/* Card 2: Tổng giờ làm */}
            <View style={[styles.metricCard, { borderTopColor: "#0891b2" }]}>
              <View style={[styles.metricIconWrap, { backgroundColor: "#ecfeff" }]}>
                <Ionicons name="time" size={16} color="#0891b2" />
              </View>
              <Text style={[styles.metricValue, { color: "#0891b2" }]} numberOfLines={1}>
                {stats.hoursFormatted}
              </Text>
              <Text style={styles.metricLabel}>Tổng thời lượng</Text>
            </View>

            {/* Card 3: Đi muộn / Về sớm */}
            <View style={[styles.metricCard, { borderTopColor: "#d97706" }]}>
              <View style={[styles.metricIconWrap, { backgroundColor: "#fffbeb" }]}>
                <Ionicons name="alert-circle" size={16} color="#d97706" />
              </View>
              <Text style={[styles.metricValue, { color: "#d97706" }]}>{stats.lateOrEarly}</Text>
              <Text style={styles.metricLabel}>Muộn / Sớm</Text>
            </View>

            {/* Card 4: Nghỉ phép */}
            <View style={[styles.metricCard, { borderTopColor: "#2563eb" }]}>
              <View style={[styles.metricIconWrap, { backgroundColor: "#eff6ff" }]}>
                <Ionicons name="document-text" size={16} color="#2563eb" />
              </View>
              <Text style={[styles.metricValue, { color: "#2563eb" }]}>{stats.leave}</Text>
              <Text style={styles.metricLabel}>Nghỉ phép/Lễ</Text>
            </View>
          </View>
        </View>

        {/* VIEW MODE TOGGLE (DẠNG LỊCH / DẠNG DANH SÁCH) */}
        <View style={styles.viewModeToggleCard}>
          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === "calendar" && styles.viewModeBtnActive]}
            onPress={() => setViewMode("calendar")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="calendar"
              size={15}
              color={viewMode === "calendar" ? "#0891b2" : "#64748b"}
            />
            <Text
              style={[
                styles.viewModeBtnText,
                viewMode === "calendar" && styles.viewModeBtnTextActive,
              ]}
            >
              Dạng lịch
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.viewModeBtn, viewMode === "list" && styles.viewModeBtnActive]}
            onPress={() => setViewMode("list")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="list"
              size={15}
              color={viewMode === "list" ? "#0891b2" : "#64748b"}
            />
            <Text
              style={[
                styles.viewModeBtnText,
                viewMode === "list" && styles.viewModeBtnTextActive,
              ]}
            >
              Dạng danh sách ({logs.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* ERROR DISPLAY */}
        <ErrorText message={error} />

        {/* LOADING STATE */}
        {loading && logs.length === 0 && <Loading />}

        {/* CALENDAR VIEW */}
        {viewMode === "calendar" && (
          <View style={styles.calendarContainer}>
            {/* Weekday Labels Header */}
            <View style={styles.calendarWeekdaysRow}>
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((dayName, idx) => (
                <View key={dayName} style={styles.weekdayCell}>
                  <Text
                    style={[
                      styles.weekdayText,
                      (idx === 5 || idx === 6) && styles.weekdayTextWeekend,
                    ]}
                  >
                    {dayName}
                  </Text>
                </View>
              ))}
            </View>

            {/* Calendar Days Matrix */}
            <View style={styles.calendarDaysGrid}>
              {calendarDays.map((cell, index) => {
                if (!cell.dayNum || !cell.dateStr) {
                  return <View key={`empty-${index}`} style={styles.calendarDayCellEmpty} />;
                }

                const isSelected = selectedCalendarDate === cell.dateStr;
                const statusColor =
                  cell.statusType === "present"
                    ? "#059669"
                    : cell.statusType === "late"
                      ? "#d97706"
                      : cell.statusType === "leave"
                        ? "#2563eb"
                        : cell.statusType === "absent"
                          ? "#dc2626"
                          : null;

                return (
                  <TouchableOpacity
                    key={cell.dateStr}
                    style={[
                      styles.calendarDayCell,
                      cell.isWeekend && styles.calendarDayCellWeekend,
                      cell.isToday && styles.calendarDayCellToday,
                      isSelected && styles.calendarDayCellSelected,
                    ]}
                    onPress={() => setSelectedCalendarDate(cell.dateStr!)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.calendarDayNum,
                        cell.isWeekend && styles.calendarDayNumWeekend,
                        cell.isToday && styles.calendarDayNumToday,
                        isSelected && styles.calendarDayNumSelected,
                      ]}
                    >
                      {cell.dayNum}
                    </Text>

                    {statusColor ? (
                      <View
                        style={[
                          styles.calendarStatusDot,
                          { backgroundColor: statusColor },
                          isSelected && styles.calendarStatusDotSelected,
                        ]}
                      />
                    ) : cell.isFuture ? (
                      <View style={styles.calendarStatusDotPlaceholder} />
                    ) : cell.isWeekend ? (
                      <View style={styles.calendarStatusDotPlaceholder} />
                    ) : (
                      <View style={[styles.calendarStatusDot, { backgroundColor: "#cbd5e1" }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Calendar Status Legend */}
            <View style={styles.calendarLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#059669" }]} />
                <Text style={styles.legendText}>Có mặt ({stats.presentDays})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#d97706" }]} />
                <Text style={styles.legendText}>Muộn/Sớm ({stats.lateOrEarly})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#2563eb" }]} />
                <Text style={styles.legendText}>Nghỉ phép ({stats.leave})</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#dc2626" }]} />
                <Text style={styles.legendText}>Vắng ({stats.absent})</Text>
              </View>
            </View>

            {/* SELECTED DAY DETAIL CARD */}
            <View style={styles.calDetailCard}>
              <View style={styles.calDetailHeader}>
                <View style={styles.calDetailHeaderLeft}>
                  <View style={styles.calDetailDateBadge}>
                    <Text style={styles.calDetailDateNum}>
                      {selectedCalendarDate.split("-")[2]}
                    </Text>
                    <Text style={styles.calDetailMonthText}>
                      Tháng {selectedCalendarDate.split("-")[1]}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.calDetailDayOfWeek}>
                      {formatDisplayDate(selectedCalendarDate).dayOfWeek}
                    </Text>
                    <Text style={styles.calDetailFullDate}>
                      {formatDisplayDate(selectedCalendarDate).dateFormatted}
                    </Text>
                  </View>
                </View>

                {selectedDayLog ? (
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          (STATUS_CONFIG[selectedDayLog.status || ""] || STATUS_CONFIG.Present).bg,
                        borderColor: `${
                          (STATUS_CONFIG[selectedDayLog.status || ""] || STATUS_CONFIG.Present).color
                        }30`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        (STATUS_CONFIG[selectedDayLog.status || ""] || STATUS_CONFIG.Present).icon
                      }
                      size={13}
                      color={
                        (STATUS_CONFIG[selectedDayLog.status || ""] || STATUS_CONFIG.Present).color
                      }
                    />
                    <Text
                      style={[
                        styles.statusText,
                        {
                          color: (
                            STATUS_CONFIG[selectedDayLog.status || ""] || STATUS_CONFIG.Present
                          ).color,
                        },
                      ]}
                    >
                      {
                        (STATUS_CONFIG[selectedDayLog.status || ""] || STATUS_CONFIG.Present).label
                      }
                    </Text>
                  </View>
                ) : (
                  <View style={styles.calEmptyBadge}>
                    <Text style={styles.calEmptyBadgeText}>
                      {selectedCalendarDate > todayStr ? "Chưa diễn ra" : "Chưa có bản ghi"}
                    </Text>
                  </View>
                )}
              </View>

              {selectedDayLog ? (
                <View style={styles.calDetailBody}>
                  <View style={styles.calDetailTimeGrid}>
                    <View style={styles.calDetailTimeItem}>
                      <View style={styles.calDetailTimeLabelRow}>
                        <Ionicons name="log-in-outline" size={13} color="#059669" />
                        <Text style={styles.calDetailTimeLabel}>Giờ vào</Text>
                      </View>
                      <Text style={styles.calDetailTimeVal}>
                        {formatTimeOnly(selectedDayLog.checkIn?.time)}
                      </Text>
                    </View>

                    <View style={styles.calDetailTimeItem}>
                      <View style={styles.calDetailTimeLabelRow}>
                        <Ionicons name="log-out-outline" size={13} color="#2563eb" />
                        <Text style={styles.calDetailTimeLabel}>Giờ ra</Text>
                      </View>
                      <Text style={styles.calDetailTimeVal}>
                        {formatTimeOnly(selectedDayLog.checkOut?.time)}
                      </Text>
                    </View>

                    <View style={styles.calDetailTimeItem}>
                      <View style={styles.calDetailTimeLabelRow}>
                        <Ionicons name="time-outline" size={13} color="#0891b2" />
                        <Text style={styles.calDetailTimeLabel}>Thời lượng</Text>
                      </View>
                      <Text style={[styles.calDetailTimeVal, { color: "#0891b2" }]}>
                        {
                          calculateWorkHours(
                            selectedDayLog.checkIn?.time,
                            selectedDayLog.checkOut?.time,
                          ).text
                        }
                      </Text>
                    </View>
                  </View>

                  {Boolean(selectedDayLog.note) && (
                    <View style={styles.calDetailNoteBox}>
                      <Ionicons name="chatbox-ellipses-outline" size={13} color="#64748b" />
                      <Text style={styles.calDetailNoteText}>{selectedDayLog.note}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.calDetailActionBtn}
                    onPress={() => openDetail(selectedDayLog)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.calDetailActionBtnText}>
                      Xem chi tiết & Đối soát / Khiếu nại
                    </Text>
                    <Ionicons name="chevron-forward" size={15} color="#0891b2" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.calDetailEmptyBody}>
                  <Ionicons name="information-circle-outline" size={20} color="#94a3b8" />
                  <Text style={styles.calDetailEmptyText}>
                    {selectedCalendarDate > todayStr
                      ? "Ngày này trong tương lai chưa diễn ra hoạt động chấm công."
                      : "Không có dữ liệu chấm công cho ngày này (ngày nghỉ cuối tuần hoặc chưa ghi nhận ca)."}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* LIST VIEW */}
        {viewMode === "list" && (
          <>
            {/* STATUS FILTER PILLS */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsScroll}
            >
              <TouchableOpacity
                style={[styles.filterPill, filter === "all" && styles.filterPillActive]}
                onPress={() => setFilter("all")}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterPillText, filter === "all" && styles.filterPillTextActive]}>
                  Tất cả ({logs.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, filter === "present" && styles.filterPillActive]}
                onPress={() => setFilter("present")}
                activeOpacity={0.7}
              >
                <View style={[styles.miniDot, { backgroundColor: "#059669" }]} />
                <Text style={[styles.filterPillText, filter === "present" && styles.filterPillTextActive]}>
                  Có mặt ({stats.presentDays})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, filter === "late" && styles.filterPillActive]}
                onPress={() => setFilter("late")}
                activeOpacity={0.7}
              >
                <View style={[styles.miniDot, { backgroundColor: "#d97706" }]} />
                <Text style={[styles.filterPillText, filter === "late" && styles.filterPillTextActive]}>
                  Muộn / Sớm ({stats.lateOrEarly})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, filter === "leave" && styles.filterPillActive]}
                onPress={() => setFilter("leave")}
                activeOpacity={0.7}
              >
                <View style={[styles.miniDot, { backgroundColor: "#2563eb" }]} />
                <Text style={[styles.filterPillText, filter === "leave" && styles.filterPillTextActive]}>
                  Nghỉ phép ({stats.leave})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.filterPill, filter === "absent" && styles.filterPillActive]}
                onPress={() => setFilter("absent")}
                activeOpacity={0.7}
              >
                <View style={[styles.miniDot, { backgroundColor: "#dc2626" }]} />
                <Text style={[styles.filterPillText, filter === "absent" && styles.filterPillTextActive]}>
                  Vắng ({stats.absent})
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* LOGS LIST */}
            <View style={styles.logsListWrapper}>
              {filteredLogs.length === 0 && !loading ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="calendar-outline" size={44} color="#94a3b8" />
                  <Text style={styles.emptyTitle}>Chưa có bản ghi nào</Text>
                  <Text style={styles.emptySubtitle}>
                    Không tìm thấy lượt chấm công phù hợp trong tháng {period}.
                  </Text>
                </View>
              ) : (
                filteredLogs.map((log) => {
                  const { dayOfWeek, dateFormatted } = formatDisplayDate(log.date);
                  const statusCfg = STATUS_CONFIG[log.status || ""] || {
                    label: log.status || (log.checkIn ? "Có mặt" : "Chưa xác định"),
                    color: "#64748b",
                    bg: "#f1f5f9",
                    icon: "help-circle-outline",
                  };
                  const duration = calculateWorkHours(log.checkIn?.time, log.checkOut?.time);
                  const shift = (log as any).shiftId ? shiftMap.get((log as any).shiftId) : null;

                  return (
                    <TouchableOpacity
                      key={log._id}
                      style={styles.logCard}
                      onPress={() => openDetail(log)}
                      activeOpacity={0.8}
                    >
                      {/* Top line: Date + Day + Status */}
                      <View style={styles.logCardHeader}>
                        <View style={styles.dateGroup}>
                          <View style={styles.dateDayBadge}>
                            <Text style={styles.dateDayText}>{log.date.split("-")[2]}</Text>
                          </View>
                          <View>
                            <Text style={styles.logDayOfWeek}>{dayOfWeek}</Text>
                            <Text style={styles.logFullDate}>{dateFormatted}</Text>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.statusBadge,
                            { backgroundColor: statusCfg.bg, borderColor: `${statusCfg.color}35` },
                          ]}
                        >
                          <Ionicons name={statusCfg.icon} size={13} color={statusCfg.color} />
                          <Text style={[styles.statusText, { color: statusCfg.color }]}>
                            {statusCfg.label}
                          </Text>
                        </View>
                      </View>

                      {/* Middle Line: In & Out Time + Total Duration */}
                      <View style={styles.timeRow}>
                        <View style={styles.timeBlock}>
                          <View style={styles.timeLabelRow}>
                            <Ionicons name="log-in-outline" size={13} color="#059669" />
                            <Text style={styles.timeLabel}>Vào ca</Text>
                          </View>
                          <Text
                            style={[
                              styles.timeVal,
                              log.checkIn?.time ? { color: "#0f172a" } : { color: "#94a3b8" },
                            ]}
                          >
                            {formatTimeOnly(log.checkIn?.time)}
                          </Text>
                        </View>

                        <View style={styles.timeDivider}>
                          <Ionicons name="arrow-forward" size={14} color="#cbd5e1" />
                        </View>

                        <View style={styles.timeBlock}>
                          <View style={styles.timeLabelRow}>
                            <Ionicons name="log-out-outline" size={13} color="#2563eb" />
                            <Text style={styles.timeLabel}>Ra ca</Text>
                          </View>
                          <Text
                            style={[
                              styles.timeVal,
                              log.checkOut?.time ? { color: "#0f172a" } : { color: "#94a3b8" },
                            ]}
                          >
                            {formatTimeOnly(log.checkOut?.time)}
                          </Text>
                        </View>

                        <View style={styles.timeDivider}>
                          <Ionicons name="arrow-forward" size={14} color="#cbd5e1" />
                        </View>

                        <View style={styles.timeBlock}>
                          <View style={styles.timeLabelRow}>
                            <Ionicons name="time-outline" size={13} color="#0891b2" />
                            <Text style={styles.timeLabel}>Thời lượng</Text>
                          </View>
                          <Text
                            style={[
                              styles.timeVal,
                              duration.hours > 0 ? { color: "#0891b2" } : { color: "#64748b" },
                            ]}
                          >
                            {duration.text}
                          </Text>
                        </View>
                      </View>

                      {/* Bottom Line: Shift info + Note + Action */}
                      <View style={styles.logCardFooter}>
                        <View style={styles.footerLeft}>
                          {shift && (
                            <View style={styles.shiftTag}>
                              <Ionicons name="briefcase-outline" size={11} color="#475569" />
                              <Text style={styles.shiftTagText}>{shift.name}</Text>
                            </View>
                          )}
                          {Boolean(log.note) && (
                            <View style={styles.noteTag}>
                              <Ionicons name="chatbox-ellipses-outline" size={11} color="#64748b" />
                              <Text style={styles.noteTagText} numberOfLines={1}>
                                {log.note}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.footerRight}>
                          <Text style={styles.detailLinkText}>Chi tiết</Text>
                          <Ionicons name="chevron-forward" size={13} color="#0891b2" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* DETAIL MODAL */}
      <Modal
        visible={detailLog !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailLog(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalSheet}>
            {detailLog && (
              <>
                {/* Modal Header */}
                <View style={styles.modalSheetHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalSheetTitle}>Chi tiết ngày công</Text>
                    <Text style={styles.modalSheetSubtitle}>
                      {formatDisplayDate(detailLog.date).dayOfWeek},{" "}
                      {formatDisplayDate(detailLog.date).dateFormatted}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => setDetailLog(null)}
                    style={styles.modalCloseBtn}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={20} color="#64748b" />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalSheetBody} showsVerticalScrollIndicator={false}>
                  {/* Status Banner */}
                  {(() => {
                    const cfg = STATUS_CONFIG[detailLog.status || ""] || {
                      label: detailLog.status || "Chưa xác định",
                      color: "#64748b",
                      bg: "#f1f5f9",
                      icon: "help-circle-outline",
                    };
                    return (
                      <View style={[styles.detailStatusBanner, { backgroundColor: cfg.bg }]}>
                        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[styles.detailStatusTitle, { color: cfg.color }]}>
                            {cfg.label}
                          </Text>
                          <Text style={styles.detailStatusDesc}>
                            {detailLog.status === "Present"
                              ? "Hoàn thành đầy đủ giờ công trong ngày"
                              : detailLog.status === "Late"
                                ? "Chấm vào ca muộn hơn giờ quy định"
                                : detailLog.status === "Left-Early"
                                  ? "Chấm ra ca sớm hơn giờ quy định"
                                  : detailLog.status === "Approved-Leave"
                                    ? "Nghỉ phép theo đơn đã được ban lãnh đạo duyệt"
                                    : detailLog.status === "Paid-Holiday"
                                      ? "Nghỉ lễ theo lịch doanh nghiệp hưởng nguyên lương"
                                      : detailLog.status === "Absent"
                                        ? "Vắng mặt không có đơn xin phép"
                                        : "Ghi nhận từ nhật ký chấm công"}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

                  {/* Check-In & Check-Out Detail Cards */}
                  <View style={styles.detailCard}>
                    <Text style={styles.detailSectionTitle}>Lần chấm vào ca</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Thời gian:</Text>
                      <Text style={styles.detailValueBold}>
                        {formatTimeOnly(detailLog.checkIn?.time)}{" "}
                        {detailLog.checkIn?.time ? `(${formatDisplayDate(detailLog.date).dateFormatted})` : ""}
                      </Text>
                    </View>
                    {(detailLog.checkIn as any)?.deviceInfo && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Thiết bị:</Text>
                        <Text style={styles.detailValue}>{(detailLog.checkIn as any).deviceInfo}</Text>
                      </View>
                    )}
                    {(detailLog.checkIn as any)?.latitude && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Tọa độ GPS:</Text>
                        <Text style={styles.detailValue}>
                          {Number((detailLog.checkIn as any).latitude).toFixed(5)},{" "}
                          {Number((detailLog.checkIn as any).longitude).toFixed(5)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.detailCard}>
                    <Text style={styles.detailSectionTitle}>Lần chấm ra ca</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Thời gian:</Text>
                      <Text style={styles.detailValueBold}>
                        {formatTimeOnly(detailLog.checkOut?.time)}{" "}
                        {detailLog.checkOut?.time ? `(${formatDisplayDate(detailLog.date).dateFormatted})` : ""}
                      </Text>
                    </View>
                    {(detailLog.checkOut as any)?.deviceInfo && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Thiết bị:</Text>
                        <Text style={styles.detailValue}>{(detailLog.checkOut as any).deviceInfo}</Text>
                      </View>
                    )}
                    {(detailLog.checkOut as any)?.latitude && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Tọa độ GPS:</Text>
                        <Text style={styles.detailValue}>
                          {Number((detailLog.checkOut as any).latitude).toFixed(5)},{" "}
                          {Number((detailLog.checkOut as any).longitude).toFixed(5)}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Work Duration & Notes */}
                  <View style={styles.detailCard}>
                    <Text style={styles.detailSectionTitle}>Tổng hợp & Ghi chú</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Tổng thời lượng làm việc:</Text>
                      <Text style={[styles.detailValueBold, { color: "#0891b2" }]}>
                        {calculateWorkHours(detailLog.checkIn?.time, detailLog.checkOut?.time).text}
                      </Text>
                    </View>

                    {Boolean(detailLog.note) && (
                      <View style={[styles.detailRow, { alignItems: "flex-start", marginTop: 4 }]}>
                        <Text style={styles.detailLabel}>Ghi chú:</Text>
                        <Text style={[styles.detailValue, { flex: 1 }]}>{detailLog.note}</Text>
                      </View>
                    )}
                  </View>

                  {/* Adjustment History */}
                  <View style={styles.detailCard}>
                    <Text style={styles.detailSectionTitle}>Lịch sử điều chỉnh công</Text>
                    {loadingAdjustments ? (
                      <ActivityIndicator size="small" color="#0891b2" style={{ marginVertical: 8 }} />
                    ) : detailAdjustments.length === 0 ? (
                      <Text style={styles.noAdjustmentText}>
                        Chưa có lịch sử điều chỉnh nào cho ngày công này.
                      </Text>
                    ) : (
                      detailAdjustments.map((adj) => (
                        <View key={adj._id} style={styles.adjustmentItem}>
                          <View style={styles.adjustmentHeader}>
                            <Ionicons name="create-outline" size={14} color="#0891b2" />
                            <Text style={styles.adjustActor}>
                              {adj.actorName || adj.actorId || "Quản lý"}
                            </Text>
                            <Text style={styles.adjustDate}>
                              {new Date(adj.createdAt).toLocaleDateString("vi-VN")}
                            </Text>
                          </View>
                          <Text style={styles.adjustReason}>
                            <Text style={{ fontWeight: "700" }}>Lý do: </Text>
                            {adj.reason}
                          </Text>
                          {adj.after?.status && (
                            <Text style={styles.adjustStatusChange}>
                              Chuyển trạng thái:{" "}
                              <Text style={{ color: "#d97706" }}>{adj.before?.status || "Gốc"}</Text> →{" "}
                              <Text style={{ color: "#059669", fontWeight: "700" }}>
                                {adj.after.status}
                              </Text>
                            </Text>
                          )}
                        </View>
                      ))
                    )}
                  </View>
                </ScrollView>

                {/* Modal Footer Actions */}
                <View style={styles.modalSheetFooter}>
                  {manage && (
                    <TouchableOpacity
                      style={styles.adjustActionBtn}
                      onPress={() => {
                        const logToAdjust = detailLog;
                        setDetailLog(null);
                        setAdjustingLog(logToAdjust);
                      }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="build-outline" size={16} color="#ffffff" />
                      <Text style={styles.adjustActionBtnText}>Hiệu chỉnh công</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.closeSheetBtn}
                    onPress={() => setDetailLog(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.closeSheetBtnText}>Đóng</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ADJUSTMENT MODAL FOR MANAGERS */}
      <Modal
        visible={adjustingLog !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!lock.current) {
            setAdjustingLog(null);
            setRevision((v) => v + 1);
          }
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#ffffff" }} edges={["top", "bottom"]}>
          {adjustingLog && (
            <AdjustmentForm
              log={adjustingLog}
              onClose={() => {
                setAdjustingLog(null);
                setRevision((v) => v + 1);
              }}
              setLocked={(val) => {
                lock.current = val;
              }}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* EMPLOYEE PICKER MODAL (FOR MANAGERS) */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.detailModalSheet, { maxHeight: "80%" }]}>
            <View style={styles.modalSheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalSheetTitle}>Chọn nhân viên</Text>
                <Text style={styles.modalSheetSubtitle}>Tra cứu lịch sử chấm công theo nhân sự</Text>
              </View>
              <TouchableOpacity
                onPress={() => setPickerVisible(false)}
                style={styles.modalCloseBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search" size={16} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Tìm theo tên hoặc email nhân viên..."
                placeholderTextColor="#94a3b8"
                value={searchEmployee}
                onChangeText={setSearchEmployee}
              />
              {Boolean(searchEmployee) && (
                <TouchableOpacity onPress={() => setSearchEmployee("")}>
                  <Ionicons name="close-circle" size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.employeeListScroll} showsVerticalScrollIndicator={false}>
              {/* Option: View My Own */}
              <TouchableOpacity
                style={[
                  styles.employeeItem,
                  selectedEmployeeId === user?.uid && styles.employeeItemActive,
                ]}
                onPress={() => {
                  setSelectedEmployeeId(user?.uid || "");
                  setSelectedEmployeeName(user?.displayName || user?.email || "Cá nhân");
                  setPickerVisible(false);
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.empAvatar, { backgroundColor: "#ecfdf5" }]}>
                  <Ionicons name="person" size={16} color="#059669" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.empName}>
                    {user?.displayName || "Hồ sơ của tôi"} <Text style={styles.empMeTag}>(Tôi)</Text>
                  </Text>
                  <Text style={styles.empEmail}>{user?.email}</Text>
                </View>
                {selectedEmployeeId === user?.uid && (
                  <Ionicons name="checkmark" size={18} color="#059669" />
                )}
              </TouchableOpacity>

              {filteredEmployees.map((emp) => {
                if (emp._id === user?.uid) return null;
                const isSelected = selectedEmployeeId === emp._id;
                return (
                  <TouchableOpacity
                    key={emp._id}
                    style={[styles.employeeItem, isSelected && styles.employeeItemActive]}
                    onPress={() => {
                      setSelectedEmployeeId(emp._id);
                      setSelectedEmployeeName(emp.displayName || emp.email);
                      setPickerVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.empAvatar}>
                      <Text style={styles.empAvatarText}>
                        {(emp.displayName || emp.email).slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.empName}>{emp.displayName || emp.email}</Text>
                      <Text style={styles.empEmail}>
                        {emp.department ? `${emp.department} · ` : ""}
                        {emp.email}
                      </Text>
                    </View>
                    {isSelected && <Ionicons name="checkmark" size={18} color="#0891b2" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrapper: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#059669",
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: "#64748b",
    fontWeight: "500",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  employeeSelectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ecfeff",
    alignItems: "center",
    justifyContent: "center",
  },
  reloadBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  managerTargetBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#cffafe",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  managerTargetText: {
    flex: 1,
    fontSize: 12.5,
    color: "#0e7490",
  },
  resetEmployeeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#0891b2",
    borderRadius: 6,
  },
  resetEmployeeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ffffff",
  },
  monthCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  monthNavBtnDisabled: {
    opacity: 0.4,
    backgroundColor: "#f1f5f9",
  },
  monthCenterBox: {
    alignItems: "center",
    gap: 2,
  },
  monthTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  monthTitleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  monthSubtitleText: {
    fontSize: 11,
    color: "#64748b",
  },
  dashboardContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  dashboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dashboardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  quickCheckInLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  quickCheckInText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0891b2",
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    borderTopWidth: 3,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 4,
  },
  metricIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  metricValue: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
  },
  filterPillsScroll: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 5,
  },
  filterPillActive: {
    backgroundColor: "#0891b2",
    borderColor: "#0891b2",
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  filterPillTextActive: {
    color: "#ffffff",
  },
  miniDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  logsListWrapper: {
    gap: 10,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  logCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 13,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  logCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dateGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dateDayBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  dateDayText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  logDayOfWeek: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  logFullDate: {
    fontSize: 11,
    color: "#64748b",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  timeBlock: {
    flex: 1,
    gap: 2,
  },
  timeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeLabel: {
    fontSize: 10.5,
    color: "#64748b",
    fontWeight: "500",
  },
  timeVal: {
    fontSize: 14,
    fontWeight: "700",
  },
  timeDivider: {
    paddingHorizontal: 8,
  },
  durationBadge: {
    alignItems: "flex-end",
    backgroundColor: "#ecfeff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cffafe",
    gap: 1,
  },
  durationLabel: {
    fontSize: 9,
    color: "#0e7490",
    fontWeight: "500",
  },
  durationVal: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0891b2",
  },
  logCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#f8fafc",
    paddingTop: 8,
  },
  footerLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  shiftBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  shiftBadgeText: {
    fontSize: 10.5,
    color: "#475569",
    fontWeight: "500",
  },
  noteBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#fff7ed",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 150,
  },
  noteBadgeText: {
    fontSize: 10.5,
    color: "#c2410c",
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  detailLinkText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#0891b2",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  detailModalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingBottom: 20,
  },
  modalSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalSheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalSheetSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSheetBody: {
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  detailStatusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  detailStatusTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  detailStatusDesc: {
    fontSize: 11.5,
    color: "#475569",
    lineHeight: 16,
  },
  detailCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  detailSectionTitle: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  detailValue: {
    fontSize: 12,
    color: "#334155",
  },
  detailValueBold: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  noAdjustmentText: {
    fontSize: 11.5,
    color: "#94a3b8",
    fontStyle: "italic",
    paddingVertical: 4,
  },
  adjustmentItem: {
    backgroundColor: "#ffffff",
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 4,
  },
  adjustmentHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  adjustActor: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  adjustDate: {
    fontSize: 10.5,
    color: "#94a3b8",
  },
  adjustReason: {
    fontSize: 11.5,
    color: "#475569",
  },
  adjustStatusChange: {
    fontSize: 11,
    color: "#64748b",
  },
  modalSheetFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  adjustActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#0891b2",
    borderRadius: 12,
    paddingVertical: 12,
  },
  adjustActionBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  closeSheetBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeSheetBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    marginHorizontal: 20,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    padding: 0,
  },
  employeeListScroll: {
    paddingHorizontal: 20,
    maxHeight: 320,
  },
  employeeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  employeeItemActive: {
    backgroundColor: "#f0fdfa",
    marginHorizontal: -8,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  empAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  empAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  empName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  empMeTag: {
    fontSize: 11,
    fontWeight: "600",
    color: "#059669",
  },
  empEmail: {
    fontSize: 11,
    color: "#64748b",
  },

  // View Mode Switcher
  viewModeToggleCard: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  viewModeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 9,
    gap: 6,
  },
  viewModeBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  viewModeBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  viewModeBtnTextActive: {
    color: "#0891b2",
    fontWeight: "700",
  },

  // Calendar Container
  calendarContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  calendarWeekdaysRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 8,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  weekdayTextWeekend: {
    color: "#ea580c",
  },
  calendarDaysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 6,
  },
  calendarDayCell: {
    width: "14.28%",
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "transparent",
    paddingVertical: 2,
  },
  calendarDayCellEmpty: {
    width: "14.28%",
    aspectRatio: 1,
  },
  calendarDayCellWeekend: {
    backgroundColor: "#f8fafc",
  },
  calendarDayCellToday: {
    borderColor: "#a5f3fc",
    backgroundColor: "#f0fdfa",
  },
  calendarDayCellSelected: {
    borderColor: "#0891b2",
    backgroundColor: "#ecfeff",
  },
  calendarDayNum: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  calendarDayNumWeekend: {
    color: "#94a3b8",
  },
  calendarDayNumToday: {
    color: "#0891b2",
    fontWeight: "800",
  },
  calendarDayNumSelected: {
    color: "#0e7490",
    fontWeight: "800",
  },
  calendarStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 3,
  },
  calendarStatusDotSelected: {
    transform: [{ scale: 1.2 }],
  },
  calendarStatusDotPlaceholder: {
    width: 6,
    height: 6,
    marginTop: 3,
  },
  calendarLegendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },

  // Selected Day Detail Card inside calendar
  calDetailCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
    marginTop: 4,
  },
  calDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  calDetailHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  calDetailDateBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cffafe",
    alignItems: "center",
    justifyContent: "center",
  },
  calDetailDateNum: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0891b2",
    lineHeight: 18,
  },
  calDetailMonthText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#64748b",
  },
  calDetailDayOfWeek: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  calDetailFullDate: {
    fontSize: 11,
    color: "#64748b",
  },
  calEmptyBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  calEmptyBadgeText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  calDetailBody: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
  },
  calDetailTimeGrid: {
    flexDirection: "row",
    gap: 8,
  },
  calDetailTimeItem: {
    flex: 1,
    backgroundColor: "#ffffff",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  calDetailTimeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  calDetailTimeLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#64748b",
  },
  calDetailTimeVal: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  calDetailNoteBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ffffff",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  calDetailNoteText: {
    fontSize: 11.5,
    color: "#475569",
    flex: 1,
  },
  calDetailActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ecfeff",
    borderWidth: 1,
    borderColor: "#cffafe",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  calDetailActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0891b2",
  },
  calDetailEmptyBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  calDetailEmptyText: {
    fontSize: 12,
    color: "#64748b",
    flex: 1,
    lineHeight: 17,
  },

  // Tag badges for list items
  shiftTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  shiftTagText: {
    fontSize: 10.5,
    color: "#475569",
    fontWeight: "500",
  },
  noteTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#fff7ed",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    maxWidth: 150,
  },
  noteTagText: {
    fontSize: 10.5,
    color: "#c2410c",
  },
});
