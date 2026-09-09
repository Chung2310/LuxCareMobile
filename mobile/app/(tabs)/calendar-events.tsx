import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import type { CalendarItem, CalendarItemInput } from "../../../src/services/hrCalendarService";
import type { AttendanceLog, WorkShift } from "../../../src/services/attendanceService";
import type { WorkCalendarDay } from "../../../src/services/companyWorkCalendarService";
import type { LeaveApplication } from "../../../src/types/leave";
import type { UserProfile } from "../../../src/types/common";
import {
  attendance,
  hrCalendar,
  leave,
  roster,
  workCalendar,
} from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { canUseModule, hasPermission } from "../../src/auth/access";

/* ==========================================================================
   1. TYPES & COLOR CONSTANTS (Chuẩn LuxCare Web)
   ========================================================================== */
type SubTabType = "schedule" | "attendance" | "requests" | "shifts";

interface EventTypeMeta {
  label: string;
  dot: string;
  bg: string;
  border: string;
  text: string;
}

const EVENT_TYPE_MAP: Record<string, EventTypeMeta> = {
  event: {
    label: "Sự kiện",
    dot: "#4f46e5",
    bg: "#eef2ff",
    border: "#c7d2fe",
    text: "#4338ca",
  },
  leave: {
    label: "Nghỉ phép",
    dot: "#f43f5e",
    bg: "#fff1f2",
    border: "#fecdd3",
    text: "#be123c",
  },
  wfh: {
    label: "Làm từ xa (WFH)",
    dot: "#10b981",
    bg: "#ecfdf5",
    border: "#a7f3d0",
    text: "#047857",
  },
  exception: {
    label: "Giải trình",
    dot: "#f59e0b",
    bg: "#fffbeb",
    border: "#fde68a",
    text: "#b45309",
  },
  reminder: {
    label: "Nhắc việc",
    dot: "#0f172a",
    bg: "#f1f5f9",
    border: "#cbd5e1",
    text: "#0f172a",
  },
};

const WEEKDAY_NAMES = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function formatTimeOnly(isoString?: string): string {
  if (!isoString) return "--:--";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "--:--";
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
  } catch {
    return "--:--";
  }
}

function formatDateDisplay(isoString?: string): string {
  if (!isoString) return "--/--/----";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "--/--/----";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return "--/--/----";
  }
}

function formatFullDateTime(isoString?: string): string {
  if (!isoString) return "--";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return "--";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} lúc ${h}:${m}`;
  } catch {
    return "--";
  }
}

function calculateWorkedDuration(checkInTime?: string | Date, checkOutTime?: string | Date): string {
  if (!checkInTime || !checkOutTime) return "--";
  try {
    const start = new Date(checkInTime).getTime();
    const end = new Date(checkOutTime).getTime();
    const diffMs = end - start;
    if (diffMs <= 0) return "--";
    const totalMinutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  } catch {
    return "--";
  }
}

/* ==========================================================================
   2. MAIN COMPONENT: WORK SCHEDULE (LỊCH LÀM VIỆC)
   ========================================================================== */
export default function CalendarEvents() {
  const { user, selectedBranch } = useSession();
  const allowed = canUseModule(user, "hr") && !!user?.companyCode;
  const isManager = hasPermission(user, "timekeeping:manage") || user?.role === "admin" || user?.role === "superadmin";

  // Subtab Navigation
  const [subTab, setSubTab] = useState<SubTabType>("schedule");

  // Date State for Month View (year & month: 0-indexed month)
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0 - 11

  // Selected Day in Calendar Grid (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);
  const [selectedDateStr, setSelectedDateStr] = useState<string>(todayStr);

  // View Mode for Schedule Tab
  const [scheduleViewMode, setScheduleViewMode] = useState<"grid" | "list">("grid");

  // Filters for Schedule Tab
  const [selectedEventType, setSelectedEventType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [onlyMine, setOnlyMine] = useState<boolean>(false);

  // Data States
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceLog[]>([]);
  const [leaveApps, setLeaveApps] = useState<LeaveApplication[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [holidays, setHolidays] = useState<WorkCalendarDay[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState<number>(0);

  // Modal State for Add Event
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [newType, setNewType] = useState<"event" | "leave" | "wfh" | "exception" | "reminder">("event");
  const [newTitle, setNewTitle] = useState<string>("");
  const [newDesc, setNewDesc] = useState<string>("");
  const [newStartDate, setNewStartDate] = useState<string>(todayStr);
  const [newStartTime, setNewStartTime] = useState<string>("09:00");
  const [newEndDate, setNewEndDate] = useState<string>(todayStr);
  const [newEndTime, setNewEndTime] = useState<string>("10:00");
  const [newAssigneeId, setNewAssigneeId] = useState<string>(user?.uid || "");
  const [isSavingEvent, setIsSavingEvent] = useState<boolean>(false);

  // Modal State for View Event Detail
  const [viewingItem, setViewingItem] = useState<CalendarItem | null>(null);

  // Shifts / Holidays Sub-view Mode
  const [shiftViewMode, setShiftViewMode] = useState<"shifts" | "holidays">("shifts");

  /* ==========================================================================
     3. DATA FETCHING
     ========================================================================== */
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (!allowed || !user?.companyCode) return;
      setLoading(true);
      setError(null);

      const period = `${year}-${String(month + 1).padStart(2, "0")}`;
      const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
      const startDate = `${period}-01`;
      const endDate = `${period}-${String(lastDayOfMonth).padStart(2, "0")}`;

      const tasks: Promise<any>[] = [
        hrCalendar.list(user.companyCode).then((data) => {
          if (active) setItems(data);
        }),
        attendance.history(user.uid, user.companyCode, startDate, endDate).then((data) => {
          if (active) setAttendanceLogs(data);
        }).catch(() => {}),
        leave.listApplications(1, 40).then((res) => {
          if (active) setLeaveApps(res.data || []);
        }).catch(() => {}),
        attendance.shifts().then((res) => {
          if (active) setShifts(res || []);
        }).catch(() => {}),
        workCalendar.list(year).then((res) => {
          if (active) setHolidays(res || []);
        }).catch(() => {}),
        roster.list(user.companyCode, selectedBranch?._id).then((res) => {
          if (active) setEmployees(res || []);
        }).catch(() => {}),
      ];

      Promise.allSettled(tasks)
        .catch((e) => {
          if (active) setError(messageOf(e));
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [allowed, user?.companyCode, user?.uid, selectedBranch?._id, year, month, revision])
  );

  /* ==========================================================================
     4. MONTH NAVIGATION HANDLERS
     ========================================================================== */
  function prevMonth() {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  function goToToday() {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDateStr(todayStr);
  }

  /* ==========================================================================
     5. CALENDAR GRID COMPUTATION
     ========================================================================== */
  const daysInMonth = useMemo(() => {
    return new Date(year, month + 1, 0).getDate();
  }, [year, month]);

  const firstDayWeekday = useMemo(() => {
    return new Date(year, month, 1).getDay(); // 0 = CN, 1 = T2, ...
  }, [year, month]);

  // Calendar cells: empty padding + month days
  const calendarCells = useMemo(() => {
    const cells: Array<{ dayNumber: number; dateStr: string; isCurrentMonth: boolean }> = [];

    // Preceding padding
    for (let i = 0; i < firstDayWeekday; i++) {
      cells.push({ dayNumber: 0, dateStr: "", isCurrentMonth: false });
    }

    // Days of current month
    const mStr = String(month + 1).padStart(2, "0");
    for (let d = 1; d <= daysInMonth; d++) {
      const dStr = String(d).padStart(2, "0");
      cells.push({
        dayNumber: d,
        dateStr: `${year}-${mStr}-${dStr}`,
        isCurrentMonth: true,
      });
    }

    return cells;
  }, [year, month, daysInMonth, firstDayWeekday]);

  // Map events to date strings (YYYY-MM-DD)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    items.forEach((item) => {
      if (!item.startDate) return;
      const dKey = item.startDate.slice(0, 10);
      const cur = map.get(dKey) || [];
      cur.push(item);
      map.set(dKey, cur);
    });
    return map;
  }, [items]);

  // Filtered events for the active month / filters
  const filteredMonthItems = useMemo(() => {
    const periodPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    return items.filter((item) => {
      if (!item.startDate || !item.startDate.startsWith(periodPrefix)) return false;
      if (selectedEventType !== "all" && item.type !== selectedEventType) return false;
      if (onlyMine && item.employeeId !== user?.uid && item.assigneeId !== user?.uid && item.creatorId !== user?.uid) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.title || "").toLowerCase().includes(q);
        const matchDesc = (item.description || "").toLowerCase().includes(q);
        const matchEmp = (item.employeeName || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchEmp) return false;
      }
      return true;
    });
  }, [items, year, month, selectedEventType, onlyMine, searchQuery, user?.uid]);

  // Events of the currently selected date
  const eventsOfSelectedDate = useMemo(() => {
    if (!selectedDateStr) return [];
    const dateEvents = eventsByDate.get(selectedDateStr) || [];
    return dateEvents.filter((item) => {
      if (selectedEventType !== "all" && item.type !== selectedEventType) return false;
      if (onlyMine && item.employeeId !== user?.uid && item.assigneeId !== user?.uid && item.creatorId !== user?.uid) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.title || "").toLowerCase().includes(q);
        const matchDesc = (item.description || "").toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [eventsByDate, selectedDateStr, selectedEventType, onlyMine, searchQuery, user?.uid]);

  // Quick Stats Counts
  const statsCounts = useMemo(() => {
    const counts = { total: 0, event: 0, leave: 0, wfh: 0, exception: 0, reminder: 0 };
    const periodPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    items.forEach((item) => {
      if (item.startDate && item.startDate.startsWith(periodPrefix)) {
        counts.total++;
        if (counts[item.type] !== undefined) counts[item.type]++;
      }
    });
    return counts;
  }, [items, year, month]);

  /* ==========================================================================
     6. CRUD EVENT HANDLERS
     ========================================================================== */
  async function handleCreateEvent() {
    if (!newTitle.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tiêu đề sự kiện.");
      return;
    }
    if (!newStartDate || !newEndDate) {
      Alert.alert("Lỗi", "Vui lòng nhập ngày bắt đầu và kết thúc.");
      return;
    }

    try {
      setIsSavingEvent(true);
      const startIso = `${newStartDate}T${newStartTime}:00`;
      const endIso = `${newEndDate}T${newEndTime}:00`;
      const selectedEmp = employees.find((e) => e.uid === newAssigneeId);

      const payload: CalendarItemInput = {
        companyCode: user?.companyCode || "",
        type: newType,
        title: newTitle.trim(),
        description: newDesc.trim() || undefined,
        startDate: startIso,
        endDate: endIso,
        employeeId: newAssigneeId || user?.uid,
        employeeName: selectedEmp?.displayName || user?.displayName,
        assigneeId: newAssigneeId || user?.uid,
        status: "approved",
      };

      await hrCalendar.create(payload);
      Alert.alert("Thành công", "Đã thêm lịch trình mới.");
      setIsAddModalOpen(false);
      setNewTitle("");
      setNewDesc("");
      setRevision((v) => v + 1);
    } catch (err) {
      Alert.alert("Lỗi", messageOf(err));
    } finally {
      setIsSavingEvent(false);
    }
  }

  async function handleDeleteEvent(id?: string) {
    if (!id) return;
    Alert.alert("Xác nhận xóa", "Bạn có chắc chắn muốn xóa mục lịch trình này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            await hrCalendar.remove(id);
            setViewingItem(null);
            setRevision((v) => v + 1);
          } catch (err) {
            Alert.alert("Lỗi", messageOf(err));
          }
        },
      },
    ]);
  }

  /* ==========================================================================
     7. RENDER SUB-TAB 1: LỊCH TRÌNH (SCHEDULE)
     ========================================================================== */
  const renderScheduleTab = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>
      {/* Month Navigator Toolbar */}
      <View style={s.monthNavBox}>
        <Pressable onPress={prevMonth} style={s.navArrowBtn}>
          <Text style={s.navArrowTxt}>{"<"}</Text>
        </Pressable>
        <View style={{ alignItems: "center" }}>
          <Text style={s.monthTitle}>Tháng {month + 1}, {year}</Text>
          <Text style={s.monthSubtitle}>{filteredMonthItems.length} mục lịch trình</Text>
        </View>
        <Pressable onPress={nextMonth} style={s.navArrowBtn}>
          <Text style={s.navArrowTxt}>{">"}</Text>
        </Pressable>
        <Pressable onPress={goToToday} style={s.todayBtn}>
          <Text style={s.todayBtnTxt}>Hôm nay</Text>
        </Pressable>
      </View>

      {/* View Mode Toggle: Grid vs List */}
      <View style={s.scheduleViewToggleRow}>
        <View style={s.modeSegment}>
          <Pressable
            style={[s.modeBtn, scheduleViewMode === "grid" && s.modeBtnActive]}
            onPress={() => setScheduleViewMode("grid")}
          >
            <Text style={[s.modeBtnTxt, scheduleViewMode === "grid" ? s.modeBtnTxtActive : s.modeBtnTxtInactive]}>
              📆 Lưới tháng
            </Text>
          </Pressable>
          <Pressable
            style={[s.modeBtn, scheduleViewMode === "list" && s.modeBtnActive]}
            onPress={() => setScheduleViewMode("list")}
          >
            <Text style={[s.modeBtnTxt, scheduleViewMode === "list" ? s.modeBtnTxtActive : s.modeBtnTxtInactive]}>
              📋 Danh sách
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[s.filterMineBtn, onlyMine && s.filterMineBtnActive]}
          onPress={() => setOnlyMine((v) => !v)}
        >
          <Text style={[s.filterMineTxt, onlyMine && s.filterMineTxtActive]}>
            {onlyMine ? "✓ Của tôi" : "Toàn công ty"}
          </Text>
        </Pressable>
      </View>

      {/* Quick Stats Badges Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statsPillRow}>
        <View style={[s.statPill, { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }]}>
          <Text style={s.statPillVal}>{statsCounts.total}</Text>
          <Text style={s.statPillLbl}>Tổng</Text>
        </View>
        <View style={[s.statPill, { backgroundColor: EVENT_TYPE_MAP.event.bg, borderColor: EVENT_TYPE_MAP.event.border }]}>
          <Text style={[s.statPillVal, { color: EVENT_TYPE_MAP.event.text }]}>{statsCounts.event}</Text>
          <Text style={[s.statPillLbl, { color: EVENT_TYPE_MAP.event.text }]}>Sự kiện</Text>
        </View>
        <View style={[s.statPill, { backgroundColor: EVENT_TYPE_MAP.leave.bg, borderColor: EVENT_TYPE_MAP.leave.border }]}>
          <Text style={[s.statPillVal, { color: EVENT_TYPE_MAP.leave.text }]}>{statsCounts.leave}</Text>
          <Text style={[s.statPillLbl, { color: EVENT_TYPE_MAP.leave.text }]}>Nghỉ phép</Text>
        </View>
        <View style={[s.statPill, { backgroundColor: EVENT_TYPE_MAP.wfh.bg, borderColor: EVENT_TYPE_MAP.wfh.border }]}>
          <Text style={[s.statPillVal, { color: EVENT_TYPE_MAP.wfh.text }]}>{statsCounts.wfh}</Text>
          <Text style={[s.statPillLbl, { color: EVENT_TYPE_MAP.wfh.text }]}>WFH</Text>
        </View>
        <View style={[s.statPill, { backgroundColor: EVENT_TYPE_MAP.exception.bg, borderColor: EVENT_TYPE_MAP.exception.border }]}>
          <Text style={[s.statPillVal, { color: EVENT_TYPE_MAP.exception.text }]}>{statsCounts.exception}</Text>
          <Text style={[s.statPillLbl, { color: EVENT_TYPE_MAP.exception.text }]}>Giải trình</Text>
        </View>
        <View style={[s.statPill, { backgroundColor: EVENT_TYPE_MAP.reminder.bg, borderColor: EVENT_TYPE_MAP.reminder.border }]}>
          <Text style={[s.statPillVal, { color: EVENT_TYPE_MAP.reminder.text }]}>{statsCounts.reminder}</Text>
          <Text style={[s.statPillLbl, { color: EVENT_TYPE_MAP.reminder.text }]}>Nhắc việc</Text>
        </View>
      </ScrollView>

      {/* Filter Horizontal List (Type Selector) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterTypeRow}>
        <Pressable
          style={[s.typeFilterPill, selectedEventType === "all" && s.typeFilterPillActive]}
          onPress={() => setSelectedEventType("all")}
        >
          <Text style={[s.typeFilterTxt, selectedEventType === "all" && s.typeFilterTxtActive]}>Tất cả</Text>
        </Pressable>
        {Object.entries(EVENT_TYPE_MAP).map(([typeKey, meta]) => {
          const isSelected = selectedEventType === typeKey;
          return (
            <Pressable
              key={typeKey}
              style={[
                s.typeFilterPill,
                isSelected && { backgroundColor: meta.bg, borderColor: meta.border },
              ]}
              onPress={() => setSelectedEventType(typeKey)}
            >
              <View style={[s.dotIndicator, { backgroundColor: meta.dot }]} />
              <Text style={[s.typeFilterTxt, isSelected && { color: meta.text, fontWeight: "800" }]}>
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Search Bar */}
      <View style={s.searchBox}>
        <Text style={{ color: "#94a3b8", fontSize: 13, marginRight: 6 }}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Tìm tiêu đề, nội dung, nhân sự…"
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {!!searchQuery && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={6}>
            <Text style={{ color: "#94a3b8", fontWeight: "700", paddingHorizontal: 4 }}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* GRID VIEW RENDERING */}
      {scheduleViewMode === "grid" && (
        <View style={s.gridContainer}>
          {/* Weekday headers */}
          <View style={s.gridHeaderRow}>
            {WEEKDAY_NAMES.map((w, idx) => (
              <View key={w} style={s.weekdayCell}>
                <Text style={[s.weekdayTxt, idx === 0 && { color: "#f43f5e" }]}>{w}</Text>
              </View>
            ))}
          </View>

          {/* Days cells */}
          <View style={s.gridDaysRow}>
            {calendarCells.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return <View key={`empty-${idx}`} style={s.dayCellEmpty} />;
              }

              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDateStr;
              const cellEvents = eventsByDate.get(cell.dateStr) || [];
              const hasEvents = cellEvents.length > 0;

              return (
                <Pressable
                  key={cell.dateStr}
                  style={[
                    s.dayCell,
                    isToday && s.dayCellToday,
                    isSelected && s.dayCellSelected,
                  ]}
                  onPress={() => setSelectedDateStr(cell.dateStr)}
                >
                  <Text
                    style={[
                      s.dayCellNum,
                      isToday && s.dayCellNumToday,
                      isSelected && s.dayCellNumSelected,
                    ]}
                  >
                    {cell.dayNumber}
                  </Text>

                  {/* Dots representing events */}
                  {hasEvents && (
                    <View style={s.cellDotsRow}>
                      {cellEvents.slice(0, 3).map((item, i) => {
                        const dotCol = EVENT_TYPE_MAP[item.type]?.dot || "#4f46e5";
                        return <View key={i} style={[s.cellDot, { backgroundColor: dotCol }]} />;
                      })}
                      {cellEvents.length > 3 && (
                        <View style={[s.cellDot, { backgroundColor: "#94a3b8" }]} />
                      )}
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Selected Date Events Section */}
          <View style={s.dayEventsBlock}>
            <View style={s.dayEventsHeader}>
              <Text style={s.dayEventsTitle}>
                Sự kiện ngày {formatDateDisplay(selectedDateStr)}
              </Text>
              <Text style={s.dayEventsCount}>{eventsOfSelectedDate.length} mục</Text>
            </View>

            {eventsOfSelectedDate.length === 0 ? (
              <View style={s.noDayEventsBox}>
                <Text style={s.noDayEventsTxt}>Không có lịch trình trong ngày này</Text>
              </View>
            ) : (
              eventsOfSelectedDate.map((item) => {
                const meta = EVENT_TYPE_MAP[item.type] || EVENT_TYPE_MAP.event;
                return (
                  <Pressable
                    key={item.id || item._id}
                    style={[s.eventCard, { borderLeftColor: meta.dot }]}
                    onPress={() => setViewingItem(item)}
                  >
                    <View style={s.eventCardTop}>
                      <View style={[s.eventBadge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                        <Text style={[s.eventBadgeTxt, { color: meta.text }]}>{meta.label}</Text>
                      </View>
                      <Text style={s.eventTimeTxt}>
                        {formatTimeOnly(item.startDate)} - {formatTimeOnly(item.endDate)}
                      </Text>
                    </View>
                    <Text style={s.eventCardTitle} numberOfLines={2}>{item.title}</Text>
                    {!!item.description && (
                      <Text style={s.eventCardDesc} numberOfLines={2}>{item.description}</Text>
                    )}
                    {!!item.employeeName && (
                      <Text style={s.eventCardEmp}>👤 {item.employeeName}</Text>
                    )}
                  </Pressable>
                );
              })
            )}
          </View>
        </View>
      )}

      {/* LIST VIEW RENDERING */}
      {scheduleViewMode === "list" && (
        <View style={s.listViewContainer}>
          {filteredMonthItems.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📅</Text>
              <Text style={s.emptyTitle}>Không tìm thấy lịch trình</Text>
              <Text style={s.emptySub}>Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</Text>
            </View>
          ) : (
            filteredMonthItems.map((item) => {
              const meta = EVENT_TYPE_MAP[item.type] || EVENT_TYPE_MAP.event;
              return (
                <Pressable
                  key={item.id || item._id}
                  style={[s.listCard, { borderLeftColor: meta.dot }]}
                  onPress={() => setViewingItem(item)}
                >
                  <View style={s.eventCardTop}>
                    <View style={[s.eventBadge, { backgroundColor: meta.bg, borderColor: meta.border }]}>
                      <Text style={[s.eventBadgeTxt, { color: meta.text }]}>{meta.label}</Text>
                    </View>
                    <Text style={s.listDateTxt}>{formatDateDisplay(item.startDate)}</Text>
                  </View>
                  <Text style={s.eventCardTitle}>{item.title}</Text>
                  <Text style={s.listRangeTxt}>
                    ⏰ {formatFullDateTime(item.startDate)} → {formatTimeOnly(item.endDate)}
                  </Text>
                  {!!item.description && (
                    <Text style={s.eventCardDesc} numberOfLines={2}>{item.description}</Text>
                  )}
                  {!!item.employeeName && (
                    <Text style={s.eventCardEmp}>👤 {item.employeeName}</Text>
                  )}
                </Pressable>
              );
            })
          )}
        </View>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );

  /* ==========================================================================
     8. RENDER SUB-TAB 2: CHẤM CÔNG (ATTENDANCE)
     ========================================================================== */
  const renderAttendanceTab = () => {
    let totalPresent = 0;
    let totalLate = 0;
    let totalEarly = 0;

    attendanceLogs.forEach((log) => {
      const st = (log.status || "").toLowerCase();
      if (st.includes("present") || st.includes("đúng giờ") || st.includes("có mặt")) totalPresent++;
      if (st.includes("late") || st.includes("muộn")) totalLate++;
      if (st.includes("early") || st.includes("sớm")) totalEarly++;
    });

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>
        {/* Month Summary Bar */}
        <View style={s.attendanceStatsRow}>
          <View style={[s.kpiBox, { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }]}>
            <Text style={[s.kpiVal, { color: "#047857" }]}>{totalPresent}</Text>
            <Text style={[s.kpiLbl, { color: "#047857" }]}>Có mặt</Text>
          </View>
          <View style={[s.kpiBox, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
            <Text style={[s.kpiVal, { color: "#b45309" }]}>{totalLate}</Text>
            <Text style={[s.kpiLbl, { color: "#b45309" }]}>Đi muộn</Text>
          </View>
          <View style={[s.kpiBox, { backgroundColor: "#eff6ff", borderColor: "#bfdbfe" }]}>
            <Text style={[s.kpiVal, { color: "#1d4ed8" }]}>{totalEarly}</Text>
            <Text style={[s.kpiLbl, { color: "#1d4ed8" }]}>Về sớm</Text>
          </View>
          <View style={[s.kpiBox, { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }]}>
            <Text style={[s.kpiVal, { color: "#0f172a" }]}>{attendanceLogs.length}</Text>
            <Text style={[s.kpiLbl, { color: "#64748b" }]}>Tổng ngày</Text>
          </View>
        </View>

        {/* Quick Check-in Button */}
        <Pressable
          style={s.quickCheckInBtn}
          onPress={() => router.push("/(tabs)/attendance")}
        >
          <Text style={{ fontSize: 18, marginRight: 6 }}>⏱️</Text>
          <Text style={s.quickCheckInTxt}>Mở máy chấm công trực tiếp</Text>
          <Text style={{ color: "#ffffff", fontWeight: "700", marginLeft: 4 }}>›</Text>
        </Pressable>

        {/* Attendance Logs List */}
        <View style={{ marginTop: 14 }}>
          <Text style={s.sectionHeader}>Nhật ký chấm công tháng {month + 1}/{year}</Text>
          {attendanceLogs.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>📝</Text>
              <Text style={s.emptyTitle}>Chưa có bản ghi chấm công</Text>
              <Text style={s.emptySub}>Bản ghi sẽ xuất hiện sau khi bạn thực hiện chấm công</Text>
            </View>
          ) : (
            attendanceLogs.map((log, idx) => {
              const inStr = log.checkIn?.time ? String(log.checkIn.time) : undefined;
              const outStr = log.checkOut?.time ? String(log.checkOut.time) : undefined;
              const duration = calculateWorkedDuration(inStr, outStr);

              return (
                <View key={log._id || `log-${idx}`} style={s.attendCard}>
                  <View style={s.attendCardTop}>
                    <Text style={s.attendDate}>{formatDateDisplay(log.date)}</Text>
                    <View style={[s.statusBadge, { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }]}>
                      <Text style={[s.statusBadgeTxt, { color: "#047857" }]}>{log.status || "Đúng giờ"}</Text>
                    </View>
                  </View>
                  <View style={s.attendTimesRow}>
                    <View style={s.timeCol}>
                      <Text style={s.timeColLbl}>Giờ vào</Text>
                      <Text style={s.timeColVal}>{formatTimeOnly(inStr)}</Text>
                    </View>
                    <View style={s.timeDivider} />
                    <View style={s.timeCol}>
                      <Text style={s.timeColLbl}>Giờ ra</Text>
                      <Text style={s.timeColVal}>{formatTimeOnly(outStr)}</Text>
                    </View>
                    <View style={s.timeDivider} />
                    <View style={s.timeCol}>
                      <Text style={s.timeColLbl}>Thời gian làm</Text>
                      <Text style={s.timeColVal}>{duration}</Text>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    );
  };

  /* ==========================================================================
     9. RENDER SUB-TAB 3: ĐƠN TỪ (REQUESTS)
     ========================================================================== */
  const renderRequestsTab = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>
      {/* Action Header */}
      <View style={s.requestsActionHeader}>
        <View>
          <Text style={s.sectionHeader}>Danh sách đơn từ</Text>
          <Text style={s.sectionSub}>Nghỉ phép, làm từ xa & giải trình chấm công</Text>
        </View>
        <Pressable style={s.createReqBtn} onPress={() => router.push("/(tabs)/leave")}>
          <Text style={s.createReqTxt}>+ Nộp đơn</Text>
        </Pressable>
      </View>

      {/* Applications List */}
      {leaveApps.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>📄</Text>
          <Text style={s.emptyTitle}>Chưa có đơn từ nào</Text>
          <Text style={s.emptySub}>Bấm "+ Nộp đơn" để gửi yêu cầu nghỉ phép hoặc làm từ xa</Text>
        </View>
      ) : (
        leaveApps.map((app) => {
          const isApproved = app.status === "approved";
          const isRejected = app.status === "rejected";
          const badgeBg = isApproved ? "#ecfdf5" : isRejected ? "#fff1f2" : "#fffbeb";
          const badgeBorder = isApproved ? "#a7f3d0" : isRejected ? "#fecdd3" : "#fde68a";
          const badgeCol = isApproved ? "#047857" : isRejected ? "#be123c" : "#b45309";
          const statusText = isApproved ? "Đã duyệt" : isRejected ? "Từ chối" : "Chờ duyệt";

          return (
            <View key={app._id} style={s.reqCard}>
              <View style={s.reqCardTop}>
                <Text style={s.reqTitle}>{app.type || "Đơn xin nghỉ phép"}</Text>
                <View style={[s.statusBadge, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
                  <Text style={[s.statusBadgeTxt, { color: badgeCol }]}>{statusText}</Text>
                </View>
              </View>
              <Text style={s.reqDates}>
                📅 {formatDateDisplay(app.startDate)} → {formatDateDisplay(app.endDate)}{" "}
                {app.chargeableDays ? `(${app.chargeableDays} ngày)` : ""}
              </Text>
              {!!app.reason && <Text style={s.reqReason}>Lý do: {app.reason}</Text>}
              {!!app.employeeName && <Text style={s.reqApplicant}>👤 Người nộp: {app.employeeName}</Text>}
            </View>
          );
        })
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );

  /* ==========================================================================
     10. RENDER SUB-TAB 4: CA & NGÀY LỄ (SHIFTS & HOLIDAYS)
     ========================================================================== */
  const renderShiftsHolidaysTab = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>
      {/* Sub-toggle: Shifts vs Holidays */}
      <View style={s.shiftSubToggleRow}>
        <Pressable
          style={[s.shiftSubBtn, shiftViewMode === "shifts" && s.shiftSubBtnActive]}
          onPress={() => setShiftViewMode("shifts")}
        >
          <Text style={[s.shiftSubTxt, shiftViewMode === "shifts" ? s.shiftSubTxtActive : s.shiftSubTxtInactive]}>
            ⏰ Ca làm việc ({shifts.length})
          </Text>
        </Pressable>
        <Pressable
          style={[s.shiftSubBtn, shiftViewMode === "holidays" && s.shiftSubBtnActive]}
          onPress={() => setShiftViewMode("holidays")}
        >
          <Text style={[s.shiftSubTxt, shiftViewMode === "holidays" ? s.shiftSubTxtActive : s.shiftSubTxtInactive]}>
            🏖️ Lịch nghỉ lễ ({holidays.length})
          </Text>
        </Pressable>
      </View>

      {shiftViewMode === "shifts" ? (
        <View style={{ marginTop: 10 }}>
          {shifts.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>⏰</Text>
              <Text style={s.emptyTitle}>Chưa cấu hình ca làm việc</Text>
            </View>
          ) : (
            shifts.map((sh) => {
              const breakInfo = sh.breakPeriods && sh.breakPeriods.length > 0 ? sh.breakPeriods[0] : null;

              return (
                <View key={sh._id || sh.code} style={s.shiftCard}>
                  <View style={s.shiftCardTop}>
                    <Text style={s.shiftName}>{sh.name}</Text>
                    <View style={s.shiftCodeBadge}>
                      <Text style={s.shiftCodeTxt}>{sh.code}</Text>
                    </View>
                  </View>
                  <Text style={s.shiftTime}>
                    ⏰ Giờ làm: {sh.startTime} - {sh.endTime}
                  </Text>
                  {breakInfo && (
                    <Text style={s.shiftBreak}>
                      ☕ Nghỉ trưa: {breakInfo.startTime} - {breakInfo.endTime}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </View>
      ) : (
        <View style={{ marginTop: 10 }}>
          {holidays.length === 0 ? (
            <View style={s.emptyBox}>
              <Text style={{ fontSize: 32, marginBottom: 8 }}>🏖️</Text>
              <Text style={s.emptyTitle}>Chưa có lịch nghỉ lễ trong năm {year}</Text>
            </View>
          ) : (
            holidays.map((h, i) => (
              <View key={h._id || `holiday-${i}`} style={s.holidayCard}>
                <View style={s.holidayCardTop}>
                  <Text style={s.holidayName}>{h.name || "Ngày nghỉ lễ"}</Text>
                  <Text style={s.holidayDate}>{formatDateDisplay(h.date)}</Text>
                </View>
                <Text style={s.holidayReason}>{h.adminReason || "Lịch nghỉ lễ theo quy định"}</Text>
              </View>
            ))
          )}
        </View>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );

  /* ==========================================================================
     11. HEADER COMPONENT
     ========================================================================== */
  const Header = () => (
    <View style={s.header}>
      <Pressable onPress={() => router.back()} style={s.iconBtn}>
        <Text style={{ fontSize: 18, color: "#0f172a", fontWeight: "700" }}>{"<"}</Text>
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Lịch làm việc</Text>
        <Text style={s.subtitle}>
          {user?.companyCode} · {selectedBranch?.name || "Tất cả chi nhánh"}
        </Text>
      </View>
      {subTab === "schedule" && (
        <Pressable style={s.addBtn} onPress={() => setIsAddModalOpen(true)}>
          <Text style={s.addBtnTxt}>+ Thêm</Text>
        </Pressable>
      )}
      <Pressable style={s.iconBtn} onPress={() => setRevision((v) => v + 1)}>
        <Text style={{ fontSize: 17 }}>↺</Text>
      </Pressable>
    </View>
  );

  /* ==========================================================================
     12. MAIN RENDER
     ========================================================================== */
  if (!allowed) {
    return (
      <SafeAreaView edges={["top"]} style={s.root}>
        <Header />
        <View style={s.centerBox}>
          <Text style={s.emptyTitle}>Cần phân hệ nhân sự (HR) để sử dụng Lịch làm việc</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={s.root}>
      <Header />

      {/* Subtab Navigator Bar */}
      <View style={s.subTabBar}>
        <Pressable
          style={[s.subTabBtn, subTab === "schedule" && s.subTabBtnActive]}
          onPress={() => setSubTab("schedule")}
        >
          <Text style={[s.subTabTxt, subTab === "schedule" && s.subTabTxtActive]}>
            📅 Lịch trình
          </Text>
        </Pressable>
        <Pressable
          style={[s.subTabBtn, subTab === "attendance" && s.subTabBtnActive]}
          onPress={() => setSubTab("attendance")}
        >
          <Text style={[s.subTabTxt, subTab === "attendance" && s.subTabTxtActive]}>
            ⏱️ Chấm công
          </Text>
        </Pressable>
        <Pressable
          style={[s.subTabBtn, subTab === "requests" && s.subTabBtnActive]}
          onPress={() => setSubTab("requests")}
        >
          <Text style={[s.subTabTxt, subTab === "requests" && s.subTabTxtActive]}>
            📝 Đơn từ
          </Text>
        </Pressable>
        <Pressable
          style={[s.subTabBtn, subTab === "shifts" && s.subTabBtnActive]}
          onPress={() => setSubTab("shifts")}
        >
          <Text style={[s.subTabTxt, subTab === "shifts" && s.subTabTxtActive]}>
            🏢 Ca & Lễ
          </Text>
        </Pressable>
      </View>

      {/* Content Area */}
      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={s.loadingText}>Đang tải dữ liệu lịch làm việc…</Text>
        </View>
      ) : error ? (
        <View style={s.centerBox}>
          <Text style={s.errorText}>{error}</Text>
          <Pressable style={s.retryBtn} onPress={() => setRevision((v) => v + 1)}>
            <Text style={s.retryTxt}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {subTab === "schedule" && renderScheduleTab()}
          {subTab === "attendance" && renderAttendanceTab()}
          {subTab === "requests" && renderRequestsTab()}
          {subTab === "shifts" && renderShiftsHolidaysTab()}
        </>
      )}

      {/* MODAL: ADD EVENT */}
      <Modal visible={isAddModalOpen} animationType="slide" transparent onRequestClose={() => setIsAddModalOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setIsAddModalOpen(false)}>
          <Pressable style={s.modalSheet} onPress={() => {}}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Thêm lịch trình mới</Text>

            {/* Type selector */}
            <Text style={s.formLabel}>Loại lịch trình</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
              {(["event", "leave", "wfh", "exception", "reminder"] as const).map((tKey) => {
                const meta = EVENT_TYPE_MAP[tKey];
                const active = newType === tKey;
                return (
                  <Pressable
                    key={tKey}
                    style={[s.modalTypePill, active && { backgroundColor: meta.bg, borderColor: meta.border }]}
                    onPress={() => setNewType(tKey)}
                  >
                    <View style={[s.dotIndicator, { backgroundColor: meta.dot }]} />
                    <Text style={[s.modalTypeTxt, active && { color: meta.text, fontWeight: "800" }]}>
                      {meta.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Title */}
            <Text style={s.formLabel}>Tiêu đề *</Text>
            <TextInput
              style={s.formInput}
              placeholder="VD: Họp giao ban, Nghỉ phép cá nhân..."
              placeholderTextColor="#94a3b8"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            {/* Description */}
            <Text style={s.formLabel}>Mô tả</Text>
            <TextInput
              style={[s.formInput, { height: 60, textAlignVertical: "top" }]}
              placeholder="Chi tiết công việc hoặc ghi chú..."
              placeholderTextColor="#94a3b8"
              multiline
              value={newDesc}
              onChangeText={setNewDesc}
            />

            {/* Date & Time Row */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.formLabel}>Bắt đầu (YYYY-MM-DD)</Text>
                <TextInput
                  style={s.formInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={newStartDate}
                  onChangeText={setNewStartDate}
                />
              </View>
              <View style={{ width: 80 }}>
                <Text style={s.formLabel}>Giờ</Text>
                <TextInput
                  style={s.formInput}
                  placeholder="HH:mm"
                  placeholderTextColor="#94a3b8"
                  value={newStartTime}
                  onChangeText={setNewStartTime}
                />
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.formLabel}>Kết thúc (YYYY-MM-DD)</Text>
                <TextInput
                  style={s.formInput}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94a3b8"
                  value={newEndDate}
                  onChangeText={setNewEndDate}
                />
              </View>
              <View style={{ width: 80 }}>
                <Text style={s.formLabel}>Giờ</Text>
                <TextInput
                  style={s.formInput}
                  placeholder="HH:mm"
                  placeholderTextColor="#94a3b8"
                  value={newEndTime}
                  onChangeText={setNewEndTime}
                />
              </View>
            </View>

            {/* Action buttons */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
              <Pressable
                style={[s.modalBtn, { backgroundColor: "#f1f5f9" }]}
                onPress={() => setIsAddModalOpen(false)}
              >
                <Text style={{ fontWeight: "700", color: "#475569" }}>Hủy</Text>
              </Pressable>
              <Pressable
                style={[s.modalBtn, { backgroundColor: "#4f46e5" }]}
                onPress={handleCreateEvent}
                disabled={isSavingEvent}
              >
                {isSavingEvent ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text style={{ fontWeight: "800", color: "#ffffff" }}>Tạo lịch trình</Text>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* MODAL: VIEW EVENT DETAIL */}
      <Modal visible={!!viewingItem} animationType="slide" transparent onRequestClose={() => setViewingItem(null)}>
        <Pressable style={s.modalBackdrop} onPress={() => setViewingItem(null)}>
          <Pressable style={s.modalSheet} onPress={() => {}}>
            <View style={s.modalHandle} />
            {viewingItem && (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <View
                    style={[
                      s.eventBadge,
                      {
                        backgroundColor: EVENT_TYPE_MAP[viewingItem.type]?.bg,
                        borderColor: EVENT_TYPE_MAP[viewingItem.type]?.border,
                      },
                    ]}
                  >
                    <Text style={[s.eventBadgeTxt, { color: EVENT_TYPE_MAP[viewingItem.type]?.text }]}>
                      {EVENT_TYPE_MAP[viewingItem.type]?.label || viewingItem.type}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: "#64748b", fontWeight: "600" }}>
                    Trạng thái: {viewingItem.status === "approved" ? "Đã duyệt" : viewingItem.status}
                  </Text>
                </View>

                <Text style={s.detailTitle}>{viewingItem.title}</Text>

                <View style={s.detailInfoBlock}>
                  <View style={s.detailRow}>
                    <Text style={s.detailLbl}>Thời gian bắt đầu:</Text>
                    <Text style={s.detailVal}>{formatFullDateTime(viewingItem.startDate)}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={s.detailLbl}>Thời gian kết thúc:</Text>
                    <Text style={s.detailVal}>{formatFullDateTime(viewingItem.endDate)}</Text>
                  </View>
                  {!!viewingItem.employeeName && (
                    <View style={s.detailRow}>
                      <Text style={s.detailLbl}>Nhân sự:</Text>
                      <Text style={s.detailVal}>{viewingItem.employeeName}</Text>
                    </View>
                  )}
                  {!!viewingItem.description && (
                    <View style={{ paddingVertical: 8 }}>
                      <Text style={s.detailLbl}>Mô tả chi tiết:</Text>
                      <Text style={[s.detailVal, { marginTop: 4, lineHeight: 20 }]}>{viewingItem.description}</Text>
                    </View>
                  )}
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                  {(isManager || viewingItem.creatorId === user?.uid) && (
                    <Pressable
                      style={[s.modalBtn, { backgroundColor: "#fff1f2", borderWidth: 1, borderColor: "#fecdd3" }]}
                      onPress={() => handleDeleteEvent(viewingItem.id || viewingItem._id)}
                    >
                      <Text style={{ fontWeight: "700", color: "#be123c" }}>Xóa lịch này</Text>
                    </Pressable>
                  )}
                  <Pressable
                    style={[s.modalBtn, { backgroundColor: "#f1f5f9" }]}
                    onPress={() => setViewingItem(null)}
                  >
                    <Text style={{ fontWeight: "700", color: "#475569" }}>Đóng</Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* ==========================================================================
   13. STYLESHEET
   ========================================================================== */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontWeight: "800", color: "#0f172a", letterSpacing: -0.3 },
  subtitle: { fontSize: 11, color: "#64748b", marginTop: 1 },
  addBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#4f46e5",
  },
  addBtnTxt: { fontSize: 12, fontWeight: "800", color: "#ffffff" },

  /* SubTab Bar */
  subTabBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  subTabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  subTabBtnActive: {
    backgroundColor: "#eef2ff",
  },
  subTabTxt: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  subTabTxtActive: { color: "#4f46e5", fontWeight: "800" },

  tabScroll: { padding: 12 },

  /* Month Navigator Box */
  monthNavBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 10,
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  navArrowTxt: { fontSize: 15, fontWeight: "800", color: "#0f172a" },
  monthTitle: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  monthSubtitle: { fontSize: 10, color: "#64748b", marginTop: 1 },
  todayBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  todayBtnTxt: { fontSize: 11, fontWeight: "700", color: "#4f46e5" },

  /* Mode Segment & Mine toggle */
  scheduleViewToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  modeSegment: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 2,
  },
  modeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  modeBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  modeBtnTxt: { fontSize: 11, fontWeight: "700" },
  modeBtnTxtActive: { color: "#4f46e5" },
  modeBtnTxtInactive: { color: "#64748b" },
  filterMineBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  filterMineBtnActive: {
    backgroundColor: "#eef2ff",
    borderColor: "#c7d2fe",
  },
  filterMineTxt: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  filterMineTxtActive: { color: "#4f46e5" },

  /* Quick Stats Pill Row */
  statsPillRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statPillVal: { fontSize: 11, fontWeight: "900", color: "#0f172a" },
  statPillLbl: { fontSize: 10, fontWeight: "700", color: "#64748b" },

  /* Filter Type Row */
  filterTypeRow: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 10,
  },
  typeFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  typeFilterPillActive: {
    backgroundColor: "#0f172a",
    borderColor: "#0f172a",
  },
  typeFilterTxt: { fontSize: 11, fontWeight: "600", color: "#475569" },
  typeFilterTxtActive: { color: "#ffffff", fontWeight: "800" },
  dotIndicator: { width: 6, height: 6, borderRadius: 3 },

  /* Search Box */
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 13, color: "#0f172a", paddingVertical: 0 },

  /* Grid View */
  gridContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  gridHeaderRow: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 8,
  },
  weekdayCell: { flex: 1, alignItems: "center" },
  weekdayTxt: { fontSize: 11, fontWeight: "800", color: "#64748b" },
  gridDaysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: 4,
  },
  dayCellEmpty: {
    width: "14.285%",
    height: 48,
  },
  dayCell: {
    width: "14.285%",
    height: 48,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 4,
  },
  dayCellToday: {
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
  },
  dayCellSelected: {
    backgroundColor: "#eef2ff",
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#4f46e5",
  },
  dayCellNum: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1e293b",
  },
  dayCellNumToday: { color: "#16a34a", fontWeight: "900" },
  dayCellNumSelected: { color: "#4f46e5", fontWeight: "900" },
  cellDotsRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 3,
  },
  cellDot: { width: 4, height: 4, borderRadius: 2 },

  /* Day Events Section */
  dayEventsBlock: {
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    padding: 12,
    backgroundColor: "#fcfdfe",
  },
  dayEventsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  dayEventsTitle: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  dayEventsCount: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  noDayEventsBox: {
    paddingVertical: 16,
    alignItems: "center",
  },
  noDayEventsTxt: { fontSize: 12, color: "#94a3b8" },

  /* Event Card */
  eventCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
    padding: 10,
    marginBottom: 8,
  },
  eventCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  eventBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  eventBadgeTxt: { fontSize: 9, fontWeight: "800" },
  eventTimeTxt: { fontSize: 11, fontWeight: "700", color: "#64748b" },
  eventCardTitle: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  eventCardDesc: { fontSize: 11, color: "#64748b", marginTop: 2 },
  eventCardEmp: { fontSize: 10, color: "#94a3b8", marginTop: 4, fontWeight: "600" },

  /* List View */
  listViewContainer: { gap: 8 },
  listCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 4,
    padding: 12,
  },
  listDateTxt: { fontSize: 11, fontWeight: "800", color: "#0f172a" },
  listRangeTxt: { fontSize: 11, color: "#4f46e5", fontWeight: "700", marginTop: 2 },

  /* Attendance Subtab */
  attendanceStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  kpiBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  kpiVal: { fontSize: 16, fontWeight: "900" },
  kpiLbl: { fontSize: 10, fontWeight: "700", marginTop: 2 },
  quickCheckInBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
    borderRadius: 12,
    paddingVertical: 12,
    shadowColor: "#059669",
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  quickCheckInTxt: { color: "#ffffff", fontWeight: "800", fontSize: 13 },
  sectionHeader: { fontSize: 14, fontWeight: "800", color: "#0f172a" },
  sectionSub: { fontSize: 11, color: "#64748b", marginTop: 1 },
  attendCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    marginTop: 8,
  },
  attendCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  attendDate: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeTxt: { fontSize: 9, fontWeight: "800" },
  attendTimesRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  timeCol: { flex: 1, alignItems: "center" },
  timeColLbl: { fontSize: 9, color: "#64748b", fontWeight: "600" },
  timeColVal: { fontSize: 12, fontWeight: "800", color: "#0f172a", marginTop: 2 },
  timeDivider: { width: 1, height: 20, backgroundColor: "#e2e8f0" },

  /* Requests Subtab */
  requestsActionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  createReqBtn: {
    backgroundColor: "#4f46e5",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  createReqTxt: { color: "#ffffff", fontWeight: "800", fontSize: 11 },
  reqCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    marginBottom: 8,
  },
  reqCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  reqTitle: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  reqDates: { fontSize: 11, fontWeight: "700", color: "#4f46e5", marginTop: 2 },
  reqReason: { fontSize: 11, color: "#64748b", marginTop: 4 },
  reqApplicant: { fontSize: 10, color: "#94a3b8", marginTop: 4, fontWeight: "600" },

  /* Shifts & Holidays Subtab */
  shiftSubToggleRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 3,
    marginBottom: 10,
  },
  shiftSubBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
  shiftSubBtnActive: { backgroundColor: "#f1f5f9" },
  shiftSubTxt: { fontSize: 11, fontWeight: "700" },
  shiftSubTxtActive: { color: "#0f172a", fontWeight: "800" },
  shiftSubTxtInactive: { color: "#64748b" },
  shiftCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    marginBottom: 8,
  },
  shiftCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  shiftName: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  shiftCodeBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  shiftCodeTxt: { fontSize: 10, fontWeight: "800", color: "#475569" },
  shiftTime: { fontSize: 11, fontWeight: "700", color: "#4f46e5", marginTop: 2 },
  shiftBreak: { fontSize: 11, color: "#64748b", marginTop: 2 },
  holidayCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    marginBottom: 8,
  },
  holidayCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  holidayName: { fontSize: 13, fontWeight: "800", color: "#0f172a" },
  holidayDate: { fontSize: 11, fontWeight: "800", color: "#f43f5e" },
  holidayReason: { fontSize: 11, color: "#64748b" },

  /* Center / Empty states */
  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: { marginTop: 12, color: "#64748b", fontSize: 14 },
  errorText: { color: "#e11d48", fontWeight: "700", fontSize: 15, textAlign: "center" },
  retryBtn: {
    marginTop: 18,
    backgroundColor: "#4f46e5",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryTxt: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  emptyBox: { alignItems: "center", paddingVertical: 40 },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: "#475569" },
  emptySub: { fontSize: 11, color: "#94a3b8", marginTop: 4 },

  /* Modals */
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    maxHeight: "90%",
  },
  modalHandle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#0f172a", marginBottom: 12 },
  formLabel: { fontSize: 11, fontWeight: "700", color: "#475569", marginBottom: 4 },
  formInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: "#0f172a",
    marginBottom: 10,
  },
  modalTypePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  modalTypeTxt: { fontSize: 11, fontWeight: "700", color: "#475569" },
  modalBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 12,
  },

  /* Detail Modal */
  detailTitle: { fontSize: 16, fontWeight: "800", color: "#0f172a", marginBottom: 10 },
  detailInfoBlock: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  detailLbl: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  detailVal: { fontSize: 12, fontWeight: "700", color: "#0f172a" },
});
