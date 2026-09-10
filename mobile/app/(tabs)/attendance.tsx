import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { CheckInForm } from "../../src/features/attendance/CheckInForm";
import { currentAttendancePosition, submitAttendance } from "../../src/features/attendance/checkin";
import { ATTENDANCE_FACE_CHECK_ENABLED } from "../../../src/config/attendanceFaceCheck";
import { attendance, workCalendar } from "../../src/api/services";
import type { AttendanceLog, TodayAttendance, WorkShift } from "../../../src/services/attendanceService";
import type { WorkCalendarDay } from "../../../src/services/companyWorkCalendarService";
import { currentKpiPeriod } from "../../../src/services/monthlyKpiService";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { calendarAccess } from "../../src/features/calendar/model";
import { EmptyState, ErrorText, Loading, Page } from "../../src/ui";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  Present: { label: "Có mặt", color: "#059669", bg: "#ecfdf5", icon: "checkmark-circle" },
  Late: { label: "Đi muộn", color: "#d97706", bg: "#fffbeb", icon: "alert-circle" },
  "Left-Early": { label: "Về sớm", color: "#ea580c", bg: "#fff7ed", icon: "exit-outline" },
  "Half-Day": { label: "Nửa ngày", color: "#7c3aed", bg: "#f5f3ff", icon: "hourglass-outline" },
  "Late-Left-Early": { label: "Muộn & Về sớm", color: "#e11d48", bg: "#fff1f2", icon: "warning-outline" },
  Absent: { label: "Vắng mặt", color: "#dc2626", bg: "#fef2f2", icon: "close-circle" },
  "Approved-Leave": { label: "Nghỉ phép duyệt", color: "#2563eb", bg: "#eff6ff", icon: "document-text" },
  "Paid-Holiday": { label: "Nghỉ lễ", color: "#0891b2", bg: "#ecfeff", icon: "ribbon" },
};

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

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
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

function calculateWorkHours(checkIn?: string | Date, checkOut?: string | Date): string {
  if (!checkIn || !checkOut) return "";
  const start = new Date(checkIn).getTime();
  const end = new Date(checkOut).getTime();
  const diffMs = end - start;
  if (diffMs <= 0) return "";
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${mins}m`;
}

export default function Attendance() {
  const [action, setAction] = useState<"check-in" | "check-out" | null>(null);
  const [submittingAction, setSubmittingAction] = useState<"check-in" | "check-out" | null>(null);
  const [submittingStep, setSubmittingStep] = useState<string | null>(null);
  const actionLock = useRef(false);
  const { user, selectedBranch } = useSession();
  const allowed = canUseModule(user, "hr");
  const manage = hasPermission(user, "timekeeping:manage");

  // In-place direct check-in / check-out handler
  const handleAttendance = async (type: "check-in" | "check-out") => {
    if (submittingAction) return;

    try {
      setSubmittingAction(type);
      setSubmittingStep("Đang kiểm tra quyền vị trí...");

      // 1. Check & request foreground location permission immediately on this screen
      const perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted) {
        setSubmittingStep("Đang yêu cầu quyền vị trí...");
        const requestRes = await Location.requestForegroundPermissionsAsync();
        if (!requestRes.granted) {
          setSubmittingAction(null);
          setSubmittingStep(null);
          Alert.alert(
            "Cần quyền vị trí",
            "LuxCare cần quyền truy cập vị trí thiết bị để xác thực bạn đang có mặt tại cơ sở/chi nhánh khi chấm công.",
            [
              { text: "Để sau", style: "cancel" },
              { text: "Mở Cài đặt", onPress: () => void Linking.openSettings() },
            ],
          );
          return;
        }
      }

      // 2. Check if device location services (GPS) are turned on
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setSubmittingAction(null);
        setSubmittingStep(null);
        Alert.alert(
          "Dịch vụ định vị đang tắt",
          "Vui lòng bật dịch vụ định vị (GPS) trên điện thoại của bạn để thực hiện chấm công.",
        );
        return;
      }

      // 3. If face verification is configured, fallback to face check camera modal
      if (ATTENDANCE_FACE_CHECK_ENABLED) {
        setSubmittingAction(null);
        setSubmittingStep(null);
        setAction(type);
        return;
      }

      // 4. In-place GPS location retrieval
      setSubmittingStep("Đang định vị toạ độ GPS...");
      const position = await currentAttendancePosition();

      // 5. Submit attendance directly
      setSubmittingStep("Đang gửi dữ liệu chấm công...");
      await submitAttendance(type, position.coords.latitude, position.coords.longitude);

      setSubmittingStep("Chấm công thành công!");
      const timeNow = new Date().toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      });

      Alert.alert(
        "Chấm công thành công",
        type === "check-in"
          ? `Đã ghi nhận Chấm công vào ca lúc ${timeNow}. Chúc bạn một ngày làm việc hiệu quả!`
          : `Đã ghi nhận Chấm công ra ca lúc ${timeNow}. Hẹn gặp lại bạn vào ngày tiếp theo!`,
      );

      // Auto reload today data & history
      await loadData(true);
      setRevision((v) => v + 1);
    } catch (err: any) {
      const msg = messageOf(err);
      Alert.alert(
        "Không thể chấm công",
        msg || "Có lỗi xảy ra khi xác thực vị trí hoặc kết nối đến máy chủ. Vui lòng kiểm tra GPS và thử lại.",
      );
    } finally {
      setSubmittingAction(null);
      setSubmittingStep(null);
    }
  };

  // Real-time digital clock
  const [currentTime, setCurrentTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const [period, setPeriod] = useState(() => currentKpiPeriod());
  const [activeTab, setActiveTab] = useState<"history" | "calendar" | "shifts">("history");
  const [revision, setRevision] = useState(0);

  const [today, setToday] = useState<TodayAttendance | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [days, setDays] = useState<WorkCalendarDay[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!allowed || !user) return;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setErrors([]);

      const [year, month] = period.split("-").map(Number);
      const endDate = `${period}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;

      try {
        const [todayRes, logsRes, daysRes, shiftsRes] = await Promise.allSettled([
          attendance.today(),
          attendance.history(user.uid, user.companyCode || "", `${period}-01`, endDate),
          calendarAccess(user).read ? workCalendar.list(year, true) : Promise.resolve([]),
          manage ? attendance.shifts() : Promise.resolve([]),
        ]);

        if (todayRes.status === "fulfilled") setToday(todayRes.value);
        if (logsRes.status === "fulfilled") setLogs(logsRes.value);
        if (daysRes.status === "fulfilled") {
          setDays(daysRes.value.filter((day) => day.date.startsWith(period)));
        }
        if (shiftsRes.status === "fulfilled") setShifts(shiftsRes.value);

        const newErrors: string[] = [];
        if (todayRes.status === "rejected") newErrors.push(`Hôm nay: ${messageOf(todayRes.reason)}`);
        if (logsRes.status === "rejected") newErrors.push(`Lịch sử: ${messageOf(logsRes.reason)}`);
        if (daysRes.status === "rejected") newErrors.push(`Lịch làm việc: ${messageOf(daysRes.reason)}`);
        if (shiftsRes.status === "rejected") newErrors.push(`Ca làm việc: ${messageOf(shiftsRes.reason)}`);
        setErrors(newErrors);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [allowed, user?.uid, user?.companyCode, selectedBranch?._id, period, manage],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setToday(null);
      setLogs([]);
      setDays([]);
      setShifts([]);
      setErrors([]);
      if (!allowed || !user) return;
      setLoading(true);

      const [year, month] = period.split("-").map(Number);
      const endDate = `${period}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
      const jobs = [
        attendance.today().then((value) => {
          if (active) setToday(value);
        }),
        attendance.history(user.uid, user.companyCode || "", `${period}-01`, endDate).then((value) => {
          if (active) setLogs(value);
        }),
        (calendarAccess(user).read ? workCalendar.list(year, true) : Promise.resolve([])).then((value) => {
          if (active) setDays(value.filter((day) => day.date.startsWith(period)));
        }),
        ...(manage
          ? [
              attendance.shifts().then((value) => {
                if (active) setShifts(value);
              }),
            ]
          : []),
      ];

      void Promise.allSettled(jobs).then((results) => {
        if (active) {
          setErrors(
            results.flatMap((result, index) =>
              result.status === "rejected"
                ? [`${["Hôm nay", "Lịch sử", "Lịch làm việc", "Ca làm"][index]}: ${messageOf(result.reason)}`]
                : [],
            ),
          );
          setLoading(false);
        }
      });

      return () => {
        active = false;
      };
    }, [allowed, user?.uid, user?.companyCode, selectedBranch?._id, period, revision, manage]),
  );

  // Stats calculation for the current month
  const stats = useMemo(() => {
    let present = 0;
    let lateOrEarly = 0;
    let leave = 0;
    let absent = 0;

    logs.forEach((l) => {
      if (l.status === "Present") present++;
      else if (l.status === "Late" || l.status === "Left-Early" || l.status === "Late-Left-Early") lateOrEarly++;
      else if (l.status === "Approved-Leave" || l.status === "Paid-Holiday") leave++;
      else if (l.status === "Absent") absent++;
      else if (l.checkIn) present++;
    });

    return { total: logs.length, present, lateOrEarly, leave, absent };
  }, [logs]);

  // Vietnamese date string
  const vietnameseDate = useMemo(() => {
    const daysOfWeek = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
    const dayName = daysOfWeek[currentTime.getDay()];
    const dateNum = String(currentTime.getDate()).padStart(2, "0");
    const monthNum = String(currentTime.getMonth() + 1).padStart(2, "0");
    const yearNum = currentTime.getFullYear();
    return `${dayName}, ${dateNum}/${monthNum}/${yearNum}`;
  }, [currentTime]);

  const clockString = useMemo(() => {
    return currentTime.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    });
  }, [currentTime]);

  // Check-in status determination
  const hasCheckIn = !!today?.log?.checkIn;
  const hasCheckOut = !!today?.log?.checkOut;

  if (!allowed) {
    return (
      <Page title="Chấm công">
        <View style={styles.emptyContainer}>
          <Ionicons name="lock-closed-outline" size={44} color="#94a3b8" />
          <Text style={styles.emptyTitle}>Chưa được kích hoạt</Text>
          <Text style={styles.emptyDesc}>Phân hệ nhân sự & chấm công chưa được cấp quyền cho tài khoản này.</Text>
        </View>
      </Page>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void loadData(true);
                setRevision((v) => v + 1);
              }}
              colors={["#059669"]}
              tintColor="#059669"
            />
          }
        >
          {/* Header Bar */}
          <View style={styles.headerBar}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Chấm công & Ca trực</Text>
              <View style={styles.branchRow}>
                <View style={styles.branchDot} />
                <Text style={styles.branchName}>
                  {selectedBranch?.name || user?.branchName || "Chi nhánh chính LuxCare"}
                </Text>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={() => setRevision((v) => v + 1)}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Ionicons name="reload" size={16} color="#475569" />
              </TouchableOpacity>

              {manage && (
                <TouchableOpacity
                  style={styles.manageBtn}
                  onPress={() => router.push("/(tabs)/attendance-management" as any)}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-clear-outline" size={15} color="#059669" />
                  <Text style={styles.manageBtnText}>Duyệt công</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Hero Digital Clock Card */}
          <View style={styles.heroClockCard}>
            <View style={styles.clockHeaderRow}>
              <View style={styles.clockDateBox}>
                <Ionicons name="calendar-outline" size={14} color="#059669" />
                <Text style={styles.clockDateText}>{vietnameseDate}</Text>
              </View>
              <View
                style={[
                  styles.dayTypeBadge,
                  today?.workCalendar.isWorkingDay ? styles.dayTypeWorking : styles.dayTypeOff,
                ]}
              >
                <Text
                  style={[
                    styles.dayTypeBadgeText,
                    today?.workCalendar.isWorkingDay ? { color: "#059669" } : { color: "#ea580c" },
                  ]}
                >
                  {today?.workCalendar.label || (today?.workCalendar.isWorkingDay ? "Ngày làm việc" : "Ngày nghỉ")}
                </Text>
              </View>
            </View>

            {/* Live Clock Display */}
            <Text style={styles.clockTimeText}>{clockString}</Text>

            {/* Work Status Banner */}
            <View
              style={[
                styles.workStatusBanner,
                hasCheckOut
                  ? styles.statusBannerDone
                  : hasCheckIn
                    ? styles.statusBannerWorking
                    : styles.statusBannerReady,
              ]}
            >
              <Ionicons
                name={
                  hasCheckOut
                    ? "checkmark-done-circle"
                    : hasCheckIn
                      ? "time"
                      : "radio-button-on"
                }
                size={16}
                color={hasCheckOut ? "#2563eb" : hasCheckIn ? "#059669" : "#d97706"}
              />
              <Text
                style={[
                  styles.workStatusText,
                  hasCheckOut
                    ? { color: "#1d4ed8" }
                    : hasCheckIn
                      ? { color: "#047857" }
                      : { color: "#b45309" },
                ]}
              >
                {hasCheckOut
                  ? `Đã hoàn thành ngày công (${formatTimeOnly(today?.log?.checkIn?.time)} – ${formatTimeOnly(today?.log?.checkOut?.time)})`
                  : hasCheckIn
                    ? `Đang trong ca làm việc · Đã vào lúc ${formatTimeOnly(today?.log?.checkIn?.time)}`
                    : "Chưa vào ca · Sẵn sàng chấm công hôm nay"}
              </Text>
            </View>
          </View>

          {/* Action Check-In / Check-Out Dual Cards */}
          <View style={styles.actionCardsRow}>
            {/* Check-in Card */}
            <TouchableOpacity
              style={[
                styles.actionCard,
                styles.checkInCard,
                (loading || submittingAction !== null || hasCheckIn) && styles.actionCardDisabled,
              ]}
              disabled={loading || submittingAction !== null || !today || hasCheckIn}
              onPress={() => void handleAttendance("check-in")}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.actionIconCircle,
                  { backgroundColor: hasCheckIn ? "#f1f5f9" : "#ecfdf5" },
                ]}
              >
                {submittingAction === "check-in" ? (
                  <ActivityIndicator size="small" color="#059669" />
                ) : (
                  <Ionicons
                    name={hasCheckIn ? "checkmark-circle" : "finger-print"}
                    size={28}
                    color={hasCheckIn ? "#059669" : "#047857"}
                  />
                )}
              </View>
              <Text style={styles.actionCardTitle}>VÀO CA</Text>
              <Text style={styles.actionCardTime}>
                {submittingAction === "check-in"
                  ? "Đang xử lý..."
                  : hasCheckIn
                    ? formatTimeOnly(today?.log?.checkIn?.time)
                    : "Chưa chấm vào"}
              </Text>
              <View style={[styles.actionCardBadge, hasCheckIn && styles.actionCardBadgeDone]}>
                <Text style={[styles.actionCardBadgeText, hasCheckIn && { color: "#059669" }]}>
                  {submittingAction === "check-in"
                    ? "Đang gửi..."
                    : hasCheckIn
                      ? "Đã ghi nhận"
                      : "Chấm công vào"}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Check-out Card */}
            <TouchableOpacity
              style={[
                styles.actionCard,
                styles.checkOutCard,
                (loading || submittingAction !== null || !hasCheckIn || hasCheckOut) && styles.actionCardDisabled,
              ]}
              disabled={loading || submittingAction !== null || !hasCheckIn || hasCheckOut}
              onPress={() => void handleAttendance("check-out")}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.actionIconCircle,
                  { backgroundColor: hasCheckOut ? "#f1f5f9" : "#eff6ff" },
                ]}
              >
                {submittingAction === "check-out" ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <Ionicons
                    name={hasCheckOut ? "checkmark-circle" : "log-out-outline"}
                    size={28}
                    color={hasCheckOut ? "#2563eb" : "#1d4ed8"}
                  />
                )}
              </View>
              <Text style={styles.actionCardTitle}>RA CA</Text>
              <Text style={styles.actionCardTime}>
                {submittingAction === "check-out"
                  ? "Đang xử lý..."
                  : hasCheckOut
                    ? formatTimeOnly(today?.log?.checkOut?.time)
                    : "Chưa chấm ra"}
              </Text>
              <View style={[styles.actionCardBadge, hasCheckOut && styles.actionCardBadgeDone]}>
                <Text style={[styles.actionCardBadgeText, hasCheckOut && { color: "#2563eb" }]}>
                  {submittingAction === "check-out"
                    ? "Đang gửi..."
                    : hasCheckOut
                      ? "Đã hoàn thành"
                      : "Chấm công ra"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Submitting Progress Status Card */}
          {submittingAction && (
            <View
              style={[
                styles.submittingStatusCard,
                submittingAction === "check-out" && styles.submittingStatusCardBlue,
              ]}
            >
              <ActivityIndicator
                size="small"
                color={submittingAction === "check-in" ? "#059669" : "#2563eb"}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.submittingStatusTitle}>
                  {submittingAction === "check-in"
                    ? "Đang xử lý Chấm công vào ca"
                    : "Đang xử lý Chấm công ra ca"}
                </Text>
                <Text
                  style={[
                    styles.submittingStatusStep,
                    submittingAction === "check-out" && { color: "#2563eb" },
                  ]}
                >
                  {submittingStep}
                </Text>
              </View>
            </View>
          )}

          {/* Month Stepper & Switcher */}
          <View style={styles.monthPickerCard}>
            <TouchableOpacity
              style={styles.monthNavBtn}
              onPress={() => setPeriod((p) => prevMonth(p))}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={18} color="#0f172a" />
            </TouchableOpacity>

            <View style={styles.monthCenterInfo}>
              <Text style={styles.monthTitleText}>
                Tháng {period.split("-")[1]} năm {period.split("-")[0]}
              </Text>
              <Text style={styles.monthSubtitleText}>
                {period === currentKpiPeriod() ? "Tháng hiện tại" : "Lịch sử đã lưu"}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.monthNavBtn,
                period >= currentKpiPeriod() && styles.monthNavBtnDisabled,
              ]}
              disabled={period >= currentKpiPeriod()}
              onPress={() => setPeriod((p) => nextMonth(p))}
              activeOpacity={0.7}
            >
              <Ionicons
                name="chevron-forward"
                size={18}
                color={period >= currentKpiPeriod() ? "#cbd5e1" : "#0f172a"}
              />
            </TouchableOpacity>
          </View>

          {/* Month Stats Overview */}
          <View style={styles.monthStatsRow}>
            <View style={[styles.monthStatCard, { borderLeftColor: "#059669" }]}>
              <Text style={[styles.monthStatValue, { color: "#059669" }]}>{stats.present}</Text>
              <Text style={styles.monthStatLabel}>Có mặt</Text>
            </View>
            <View style={[styles.monthStatCard, { borderLeftColor: "#d97706" }]}>
              <Text style={[styles.monthStatValue, { color: "#d97706" }]}>{stats.lateOrEarly}</Text>
              <Text style={styles.monthStatLabel}>Đi muộn/sớm</Text>
            </View>
            <View style={[styles.monthStatCard, { borderLeftColor: "#2563eb" }]}>
              <Text style={[styles.monthStatValue, { color: "#2563eb" }]}>{stats.leave}</Text>
              <Text style={styles.monthStatLabel}>Nghỉ phép</Text>
            </View>
            <View style={[styles.monthStatCard, { borderLeftColor: "#dc2626" }]}>
              <Text style={[styles.monthStatValue, { color: "#dc2626" }]}>{stats.absent}</Text>
              <Text style={styles.monthStatLabel}>Vắng mặt</Text>
            </View>
          </View>

          {/* Navigation Tabs (History, Calendar, Shifts) */}
          <View style={styles.tabPillsRow}>
            <TouchableOpacity
              style={[styles.tabPill, activeTab === "history" && styles.tabPillActive]}
              onPress={() => setActiveTab("history")}
              activeOpacity={0.75}
            >
              <Ionicons
                name="time-outline"
                size={14}
                color={activeTab === "history" ? "#059669" : "#64748b"}
              />
              <Text style={[styles.tabPillText, activeTab === "history" && styles.tabPillTextActive]}>
                Nhật ký chấm công ({logs.length})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabPill, activeTab === "calendar" && styles.tabPillActive]}
              onPress={() => setActiveTab("calendar")}
              activeOpacity={0.75}
            >
              <Ionicons
                name="calendar-outline"
                size={14}
                color={activeTab === "calendar" ? "#059669" : "#64748b"}
              />
              <Text style={[styles.tabPillText, activeTab === "calendar" && styles.tabPillTextActive]}>
                Lịch nghỉ & bù ({days.length})
              </Text>
            </TouchableOpacity>

            {manage && (
              <TouchableOpacity
                style={[styles.tabPill, activeTab === "shifts" && styles.tabPillActive]}
                onPress={() => setActiveTab("shifts")}
                activeOpacity={0.75}
              >
                <Ionicons
                  name="swap-horizontal-outline"
                  size={14}
                  color={activeTab === "shifts" ? "#059669" : "#64748b"}
                />
                <Text style={[styles.tabPillText, activeTab === "shifts" && styles.tabPillTextActive]}>
                  Ca trực ({shifts.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Error notifications */}
          {errors.map((err) => (
            <ErrorText key={err} message={err} />
          ))}

          {loading && !logs.length && <Loading />}

          {/* TAB 1: HISTORY LOGS */}
          {activeTab === "history" && (
            <View style={styles.logsListContainer}>
              {logs.length === 0 && !loading ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="calendar-outline" size={44} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>Chưa có bản ghi chấm công</Text>
                  <Text style={styles.emptyDesc}>
                    Không có lượt chấm công nào được ghi nhận trong tháng {period}.
                  </Text>
                </View>
              ) : (
                logs.map((log) => {
                  const statusInfo = STATUS_LABELS[log.status || ""] || {
                    label: log.status || "Chưa xác định",
                    color: "#64748b",
                    bg: "#f1f5f9",
                    icon: "help-circle-outline",
                  };
                  const duration = calculateWorkHours(log.checkIn?.time, log.checkOut?.time);

                  return (
                    <View key={log._id} style={styles.logCard}>
                      <View style={styles.logCardTop}>
                        <View style={styles.logDateBox}>
                          <Text style={styles.logDateText}>{formatDisplayDate(log.date)}</Text>
                        </View>
                        <View
                          style={[
                            styles.logStatusBadge,
                            { backgroundColor: statusInfo.bg, borderColor: `${statusInfo.color}30` },
                          ]}
                        >
                          <Ionicons name={statusInfo.icon as any} size={13} color={statusInfo.color} />
                          <Text style={[styles.logStatusText, { color: statusInfo.color }]}>
                            {statusInfo.label}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.logTimeRow}>
                        <View style={styles.logTimeItem}>
                          <Text style={styles.logTimeLabel}>Giờ vào ca</Text>
                          <Text style={styles.logTimeValue}>{formatTimeOnly(log.checkIn?.time)}</Text>
                        </View>

                        <Ionicons name="arrow-forward" size={14} color="#cbd5e1" style={{ marginTop: 10 }} />

                        <View style={styles.logTimeItem}>
                          <Text style={styles.logTimeLabel}>Giờ ra ca</Text>
                          <Text style={styles.logTimeValue}>{formatTimeOnly(log.checkOut?.time)}</Text>
                        </View>

                        {Boolean(duration) && (
                          <View style={styles.logDurationBox}>
                            <Text style={styles.logDurationLabel}>Thời gian</Text>
                            <Text style={styles.logDurationValue}>{duration}</Text>
                          </View>
                        )}
                      </View>

                      {Boolean(log.note) && (
                        <View style={styles.logNoteBox}>
                          <Ionicons name="chatbox-ellipses-outline" size={12} color="#64748b" />
                          <Text style={styles.logNoteText} numberOfLines={2}>
                            {log.note}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 2: CALENDAR DAYS & HOLIDAYS */}
          {activeTab === "calendar" && (
            <View style={styles.logsListContainer}>
              {days.length === 0 && !loading ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="today-outline" size={44} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>Không có ngày làm bù / nghỉ lễ</Text>
                  <Text style={styles.emptyDesc}>Trong tháng này mọi hoạt động diễn ra theo lịch thông thường.</Text>
                </View>
              ) : (
                days.map((day) => {
                  const isOverride = day.dayType === "working_override";
                  const isSubstitute = day.dayType === "substitute_holiday";

                  return (
                    <View key={day._id} style={styles.calendarDayCard}>
                      <View style={styles.calendarDayLeft}>
                        <Ionicons
                          name={isOverride ? "briefcase" : "ribbon"}
                          size={18}
                          color={isOverride ? "#2563eb" : "#059669"}
                        />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={styles.calendarDayName}>{day.name || "Ngày lễ quy định"}</Text>
                          <Text style={styles.calendarDayDate}>{formatDisplayDate(day.date)}</Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.calendarTypeBadge,
                          {
                            backgroundColor: isOverride ? "#eff6ff" : isSubstitute ? "#fffbeb" : "#ecfdf5",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.calendarTypeBadgeText,
                            {
                              color: isOverride ? "#2563eb" : isSubstitute ? "#d97706" : "#059669",
                            },
                          ]}
                        >
                          {isOverride ? "Làm bù" : isSubstitute ? "Nghỉ bù" : "Nghỉ lễ"}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {/* TAB 3: SHIFTS LIST */}
          {activeTab === "shifts" && manage && (
            <View style={styles.logsListContainer}>
              {shifts.length === 0 && !loading ? (
                <View style={styles.emptyContainer}>
                  <Ionicons name="swap-horizontal-outline" size={44} color="#cbd5e1" />
                  <Text style={styles.emptyTitle}>Chưa cấu hình ca làm việc</Text>
                  <Text style={styles.emptyDesc}>Vào Quản lý công để thiết lập danh mục ca trực.</Text>
                </View>
              ) : (
                shifts.map((shift) => (
                  <View key={shift._id} style={styles.shiftCard}>
                    <View style={styles.shiftHeaderRow}>
                      <View style={styles.shiftCodeBadge}>
                        <Text style={styles.shiftCodeText}>#{shift.code}</Text>
                      </View>
                      <Text style={styles.shiftTitle}>{shift.name}</Text>
                      {shift.isDefault && (
                        <View style={styles.shiftDefaultBadge}>
                          <Text style={styles.shiftDefaultBadgeText}>Mặc định</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.shiftTimeRow}>
                      <Ionicons name="time" size={14} color="#059669" />
                      <Text style={styles.shiftTimeText}>
                        {shift.startTime} – {shift.endTime}
                        {shift.crossesMidnight ? " (qua đêm)" : ""}
                      </Text>
                    </View>

                    <View style={styles.shiftDaysRow}>
                      <Text style={styles.shiftDaysLabel}>Áp dụng:</Text>
                      <Text style={styles.shiftDaysText}>
                        {shift.workingDays.map((d) => (d === 0 ? "CN" : `T${d + 1}`)).join(", ")}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Modal Check-In Camera Form (Only fallback if face check is explicitly enabled) */}
      {ATTENDANCE_FACE_CHECK_ENABLED && (
        <Modal
          visible={action !== null}
          animationType="slide"
          onRequestClose={() => {
            if (!actionLock.current) {
              setAction(null);
              setRevision((v) => v + 1);
            }
          }}
        >
          <SafeAreaView style={styles.modalSafeArea} edges={["top", "bottom"]}>
            {action && (
              <CheckInForm
                action={action}
                onClose={() => {
                  setAction(null);
                  setRevision((v) => v + 1);
                }}
                setLocked={(val) => {
                  actionLock.current = val;
                }}
              />
            )}
          </SafeAreaView>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 40,
    gap: 12,
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  branchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  branchDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#059669",
  },
  branchName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  manageBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ecfdf5",
    borderColor: "#a7f3d0",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  manageBtnText: {
    color: "#059669",
    fontWeight: "700",
    fontSize: 12,
  },

  // Hero Digital Clock Card
  heroClockCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    alignItems: "center",
    gap: 8,
  },
  clockHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  clockDateBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clockDateText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  dayTypeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  dayTypeWorking: {
    backgroundColor: "#ecfdf5",
  },
  dayTypeOff: {
    backgroundColor: "#fff7ed",
  },
  dayTypeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  clockTimeText: {
    fontSize: 40,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: 1,
    fontVariant: ["tabular-nums"],
    marginVertical: 4,
  },
  workStatusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    width: "100%",
    justifyContent: "center",
  },
  statusBannerReady: {
    backgroundColor: "#fffbeb",
  },
  statusBannerWorking: {
    backgroundColor: "#ecfdf5",
  },
  statusBannerDone: {
    backgroundColor: "#eff6ff",
  },
  workStatusText: {
    fontSize: 12,
    fontWeight: "700",
  },

  // Action Cards (CheckIn / CheckOut)
  actionCardsRow: {
    flexDirection: "row",
    gap: 12,
  },
  actionCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
    gap: 4,
  },
  checkInCard: {
    borderTopWidth: 4,
    borderTopColor: "#059669",
  },
  checkOutCard: {
    borderTopWidth: 4,
    borderTopColor: "#2563eb",
  },
  actionCardDisabled: {
    opacity: 0.65,
  },
  actionIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  actionCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: 0.5,
  },
  actionCardTime: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  actionCardBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 4,
  },
  actionCardBadgeDone: {
    backgroundColor: "#ecfdf5",
  },
  actionCardBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  submittingStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  submittingStatusCardBlue: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
    shadowColor: "#2563eb",
  },
  submittingStatusTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  submittingStatusStep: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },

  // Month Stepper
  monthPickerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  monthNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavBtnDisabled: {
    opacity: 0.4,
  },
  monthCenterInfo: {
    alignItems: "center",
  },
  monthTitleText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  monthSubtitleText: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },

  // Month Stats
  monthStatsRow: {
    flexDirection: "row",
    gap: 8,
  },
  monthStatCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
  },
  monthStatValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  monthStatLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 1,
  },

  // Tab Pills
  tabPillsRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 2,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tabPillActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  tabPillTextActive: {
    color: "#059669",
    fontWeight: "700",
  },

  // Logs List
  logsListContainer: {
    gap: 10,
  },
  logCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
    gap: 10,
  },
  logCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  logDateBox: {
    backgroundColor: "#f8fafc",
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  logDateText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  logStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  logStatusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  logTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 12,
  },
  logTimeItem: {
    flex: 1,
  },
  logTimeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#94a3b8",
  },
  logTimeValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 1,
  },
  logDurationBox: {
    alignItems: "flex-end",
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  logDurationLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#94a3b8",
  },
  logDurationValue: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  logNoteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  logNoteText: {
    fontSize: 12,
    color: "#475569",
    flex: 1,
  },

  // Calendar Day Card
  calendarDayCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  calendarDayLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  calendarDayName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  calendarDayDate: {
    fontSize: 11,
    color: "#64748b",
  },
  calendarTypeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  calendarTypeBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },

  // Shifts
  shiftCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  shiftHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  shiftCodeBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  shiftCodeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
  },
  shiftTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    flex: 1,
  },
  shiftDefaultBadge: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  shiftDefaultBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#059669",
  },
  shiftTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  shiftTimeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  shiftDaysRow: {
    flexDirection: "row",
    gap: 6,
  },
  shiftDaysLabel: {
    fontSize: 11,
    color: "#94a3b8",
  },
  shiftDaysText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  emptyDesc: {
    fontSize: 12,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 18,
  },

  modalSafeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
});
