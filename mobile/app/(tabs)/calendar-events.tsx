import { useAppAlert } from "../../src/components/AppAlert";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { Ionicons } from "@expo/vector-icons";
import {
  Calendar,
  CalendarDays,
  Clock,
  User,
  Users,
  Search,
  X,
  Check,
  Coffee,
  Hourglass,
  Moon,
  Palmtree,
  Building2,
  Edit2,
  List,
} from "lucide-react-native";
import { ShiftForm } from "../../src/features/shifts/ShiftForm";
import { HolidayForm } from "../../src/features/calendar/HolidayForm";
import type { CalendarItem, CalendarItemInput } from "../../../src/services/hrCalendarService";
import type { WorkShift, ShiftEmployee } from "../../../src/services/attendanceService";
import type { WorkCalendarDay } from "../../../src/services/companyWorkCalendarService";
import type { UserProfile } from "../../../src/types/common";
import {
  attendance,
  hrCalendar,
  roster,
  workCalendar,
} from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { canUseModule, hasPermission } from "../../src/auth/access";

/* ==========================================================================
   1. TYPES & COLOR CONSTANTS (Chuẩn LuxCare Web)
   ========================================================================== */
type SubTabType = "schedule" | "shifts";

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

function parseToVietnamDate(isoString?: string): Date | null {
  if (!isoString) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) {
    return new Date(`${isoString}T00:00:00+07:00`);
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(isoString)) {
    return new Date(`${isoString}+07:00`);
  }
  const d = new Date(isoString);
  return isNaN(d.getTime()) ? null : d;
}

function toLocalDateStr(isoString?: string): string {
  if (!isoString) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoString)) return isoString;
  const d = parseToVietnamDate(isoString);
  if (!d) return isoString.slice(0, 10);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const vn = new Date(utc + 7 * 3600000);
    const y = vn.getFullYear();
    const m = String(vn.getMonth() + 1).padStart(2, "0");
    const day = String(vn.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
}

function formatTimeOnly(isoString?: string): string {
  if (!isoString) return "--:--";
  try {
    const d = parseToVietnamDate(isoString);
    if (!d) return "--:--";
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    });
  } catch {
    return "--:--";
  }
}

function formatDateDisplay(isoString?: string): string {
  if (!isoString) return "--/--/----";
  try {
    const d = parseToVietnamDate(isoString);
    if (!d) return "--/--/----";
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    });
  } catch {
    return "--/--/----";
  }
}

function formatFullDateTime(isoString?: string): string {
  if (!isoString) return "--";
  try {
    const d = parseToVietnamDate(isoString);
    if (!d) return "--";
    const dateStr = d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    });
    const timeStr = d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    });
    return `${dateStr} lúc ${timeStr}`;
  } catch {
    return "--";
  }
}

function parseIsoDatePart(isoString?: string): string {
  return toLocalDateStr(isoString);
}

function parseIsoTimePart(isoString?: string): string {
  if (!isoString) return "09:00";
  try {
    const d = parseToVietnamDate(isoString);
    if (!d) return "09:00";
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    });
  } catch {
    return "09:00";
  }
}



/* ==========================================================================
   2. MAIN COMPONENT: WORK SCHEDULE (LỊCH LÀM VIỆC)
   ========================================================================== */
export default function CalendarEvents() {
  const { showAlert, alertView } = useAppAlert();
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
    return toLocalDateStr(new Date().toISOString());
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
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [shiftEmployees, setShiftEmployees] = useState<ShiftEmployee[]>([]);
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

  // Modal State for Edit Schedule Event & Hours
  const [editingCalendarItem, setEditingCalendarItem] = useState<CalendarItem | null>(null);
  const [editType, setEditType] = useState<"event" | "leave" | "wfh" | "exception" | "reminder">("event");
  const [editTitle, setEditTitle] = useState<string>("");
  const [editDesc, setEditDesc] = useState<string>("");
  const [editStartDate, setEditStartDate] = useState<string>("");
  const [editStartTime, setEditStartTime] = useState<string>("09:00");
  const [editEndDate, setEditEndDate] = useState<string>("");
  const [editEndTime, setEditEndTime] = useState<string>("10:00");
  const [editAssigneeId, setEditAssigneeId] = useState<string>("");
  const [isUpdatingEvent, setIsUpdatingEvent] = useState<boolean>(false);

  // Shifts / Employee Assignments / Holidays Sub-view Mode & CRUD states
  const [shiftViewMode, setShiftViewMode] = useState<"shifts" | "employees" | "holidays">("shifts");
  const [editingShift, setEditingShift] = useState<WorkShift | "new" | null>(null);
  const [editingHoliday, setEditingHoliday] = useState<WorkCalendarDay | "new" | null>(null);
  const [isSyncingHolidays, setIsSyncingHolidays] = useState<boolean>(false);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState<string>("");

  // Modal State for Edit Employee Shift & Hours
  const [editingEmployeeShift, setEditingEmployeeShift] = useState<ShiftEmployee | null>(null);
  const hasOpenCalendarModal = isAddModalOpen || !!viewingItem ||
    editingCalendarItem !== null || editingEmployeeShift !== null ||
    editingShift !== null || editingHoliday !== null;
  const [assignShiftId, setAssignShiftId] = useState<string>("");
  const [assignEffectiveFrom, setAssignEffectiveFrom] = useState<string>(todayStr);
  const [assignEffectiveTo, setAssignEffectiveTo] = useState<string>("");
  const [assignDaysOfWeek, setAssignDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);
  const [isCustomHoursMode, setIsCustomHoursMode] = useState<boolean>(false);
  const [customStartTime, setCustomStartTime] = useState<string>("08:00");
  const [customEndTime, setCustomEndTime] = useState<string>("17:00");
  const [customShiftName, setCustomShiftName] = useState<string>("");
  const [isSavingEmployeeShift, setIsSavingEmployeeShift] = useState<boolean>(false);

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
        attendance.shifts().then((res) => {
          if (active) setShifts(res || []);
        }).catch(() => {}),
        attendance.assignments().then((res) => {
          if (active) setShiftEmployees(res || []);
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
      const startKey = toLocalDateStr(item.startDate);
      if (!startKey) return;
      const endKey = item.endDate ? toLocalDateStr(item.endDate) : startKey;

      if (!endKey || endKey <= startKey) {
        const cur = map.get(startKey) || [];
        cur.push(item);
        map.set(startKey, cur);
      } else {
        // Multi-day span across calendar cells (capped at 35 days)
        try {
          const curD = new Date(`${startKey}T00:00:00+07:00`);
          const endD = new Date(`${endKey}T00:00:00+07:00`);
          let count = 0;
          while (curD <= endD && count < 35) {
            const k = toLocalDateStr(curD.toISOString());
            const cur = map.get(k) || [];
            cur.push(item);
            map.set(k, cur);
            curD.setDate(curD.getDate() + 1);
            count++;
          }
        } catch {
          const cur = map.get(startKey) || [];
          cur.push(item);
          map.set(startKey, cur);
        }
      }
    });
    return map;
  }, [items]);

  // Filtered events for the active month / filters
  const filteredMonthItems = useMemo(() => {
    const periodPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    return items.filter((item) => {
      if (!item.startDate) return false;
      const sKey = toLocalDateStr(item.startDate);
      const eKey = item.endDate ? toLocalDateStr(item.endDate) : sKey;
      const overlapsMonth = (sKey && sKey.startsWith(periodPrefix)) || (eKey && eKey.startsWith(periodPrefix));
      if (!overlapsMonth) return false;
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
      if (!item.startDate) return;
      const sKey = toLocalDateStr(item.startDate);
      const eKey = item.endDate ? toLocalDateStr(item.endDate) : sKey;
      if ((sKey && sKey.startsWith(periodPrefix)) || (eKey && eKey.startsWith(periodPrefix))) {
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
      showAlert("Lỗi", "Vui lòng nhập tiêu đề sự kiện.", undefined, "error");
      return;
    }
    if (!newStartDate || !newEndDate) {
      showAlert("Lỗi", "Vui lòng nhập ngày bắt đầu và kết thúc.", undefined, "error");
      return;
    }

    try {
      setIsSavingEvent(true);
      const startIso = `${newStartDate}T${newStartTime}:00+07:00`;
      const endIso = `${newEndDate}T${newEndTime}:00+07:00`;
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
      showAlert("Thành công", "Đã thêm lịch trình mới.", undefined, "success");
      setIsAddModalOpen(false);
      setNewTitle("");
      setNewDesc("");
      setRevision((v) => v + 1);
    } catch (err) {
      showAlert("Lỗi", messageOf(err), undefined, "error");
    } finally {
      setIsSavingEvent(false);
    }
  }

  async function handleDeleteEvent(id?: string) {
    if (!id) return;
    showAlert("Xác nhận xóa", "Bạn có chắc chắn muốn xóa mục lịch trình này?", [
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
            showAlert("Lỗi", messageOf(err), undefined, "error");
          }
        },
      },
    ]);
  }

  function handleOpenEditEvent(item: CalendarItem) {
    setEditingCalendarItem(item);
    setEditType(item.type || "event");
    setEditTitle(item.title || "");
    setEditDesc(item.description || "");
    setEditStartDate(parseIsoDatePart(item.startDate) || todayStr);
    setEditStartTime(parseIsoTimePart(item.startDate));
    setEditEndDate(parseIsoDatePart(item.endDate) || todayStr);
    setEditEndTime(parseIsoTimePart(item.endDate));
    setEditAssigneeId(item.employeeId || item.assigneeId || user?.uid || "");
    setViewingItem(null);
  }

  async function handleSaveEditEvent() {
    if (!editingCalendarItem) return;
    if (!editTitle.trim()) {
      showAlert("Lỗi", "Vui lòng nhập tiêu đề sự kiện.", undefined, "error");
      return;
    }
    if (!editStartDate || !editEndDate) {
      showAlert("Lỗi", "Vui lòng nhập ngày bắt đầu và kết thúc.", undefined, "error");
      return;
    }

    try {
      setIsUpdatingEvent(true);
      const startIso = `${editStartDate}T${editStartTime}:00+07:00`;
      const endIso = `${editEndDate}T${editEndTime}:00+07:00`;
      const selectedEmp = employees.find((e) => e.uid === editAssigneeId);

      const targetId = editingCalendarItem.id || editingCalendarItem._id;
      if (!targetId) throw new Error("Không tìm thấy mã lịch trình.");

      const payload: Partial<CalendarItemInput> = {
        title: editTitle.trim(),
        description: editDesc.trim() || undefined,
        type: editType,
        startDate: startIso,
        endDate: endIso,
        employeeId: editAssigneeId || undefined,
        employeeName: selectedEmp?.displayName || editingCalendarItem.employeeName,
        assigneeId: editAssigneeId || undefined,
        status: "approved",
      };

      await hrCalendar.update(targetId, payload);
      showAlert("Thành công", "Đã cập nhật giờ làm và lịch trình.", undefined, "success");
      setEditingCalendarItem(null);
      setRevision((v) => v + 1);
    } catch (err) {
      showAlert("Lỗi", messageOf(err), undefined, "error");
    } finally {
      setIsUpdatingEvent(false);
    }
  }

  function handleOpenEditEmployeeShift(emp: ShiftEmployee) {
    setEditingEmployeeShift(emp);
    const currentShiftId = emp.assignment?.shiftId || (shifts[0]?._id || "");
    setAssignShiftId(currentShiftId);
    setAssignEffectiveFrom(emp.assignment?.effectiveFrom || todayStr);
    setAssignEffectiveTo(emp.assignment?.effectiveTo || "");

    const currentShift = shifts.find((s) => s._id === currentShiftId);
    if (emp.assignment?.daysOfWeek && emp.assignment.daysOfWeek.length > 0) {
      setAssignDaysOfWeek(emp.assignment.daysOfWeek);
    } else if (currentShift?.workingDays && currentShift.workingDays.length > 0) {
      setAssignDaysOfWeek(currentShift.workingDays);
    } else {
      setAssignDaysOfWeek([1, 2, 3, 4, 5]);
    }

    setIsCustomHoursMode(false);
    setCustomStartTime(currentShift?.startTime || "08:30");
    setCustomEndTime(currentShift?.endTime || "17:30");
    setCustomShiftName(`Ca riêng - ${emp.displayName || emp.email.split("@")[0]}`);
  }

  function toggleAssignDay(dayVal: number) {
    setAssignDaysOfWeek((prev) =>
      prev.includes(dayVal) ? prev.filter((d) => d !== dayVal) : [...prev, dayVal].sort()
    );
  }

  async function handleSaveEmployeeShift() {
    if (!editingEmployeeShift) return;
    if (!assignEffectiveFrom.trim()) {
      showAlert("Lỗi", "Vui lòng nhập ngày bắt đầu hiệu lực.", undefined, "error");
      return;
    }
    if (assignDaysOfWeek.length === 0) {
      showAlert("Lỗi", "Vui lòng chọn ít nhất một ngày làm việc trong tuần.", undefined, "error");
      return;
    }

    try {
      setIsSavingEmployeeShift(true);
      let finalShiftId = assignShiftId;

      if (isCustomHoursMode) {
        if (!customStartTime || !customEndTime) {
          showAlert("Lỗi", "Vui lòng nhập đầy đủ giờ bắt đầu và kết thúc.", undefined, "error");
          setIsSavingEmployeeShift(false);
          return;
        }
        const sName = customShiftName.trim() || `Ca ${customStartTime}-${customEndTime} (${editingEmployeeShift.displayName || "NV"})`;
        const sCode = `CUSTOM_${Date.now().toString().slice(-4)}`;
        const newShift = await attendance.createShift({
          code: sCode,
          name: sName,
          color: "#6366f1",
          startTime: customStartTime,
          endTime: customEndTime,
          crossesMidnight: customStartTime > customEndTime,
          workingDays: assignDaysOfWeek,
          allowedLateMinutes: 15,
          allowedEarlyLeaveMinutes: 15,
          isDefault: false,
          isActive: true,
        });
        finalShiftId = newShift._id;
      }

      if (!finalShiftId) {
        showAlert("Lỗi", "Vui lòng chọn ca làm việc.", undefined, "error");
        setIsSavingEmployeeShift(false);
        return;
      }

      await attendance.assign({
        employeeIds: [editingEmployeeShift._id],
        shiftId: finalShiftId,
        effectiveFrom: assignEffectiveFrom.trim(),
        effectiveTo: assignEffectiveTo.trim() || undefined,
        daysOfWeek: assignDaysOfWeek,
      });

      showAlert("Thành công", `Đã lưu phân ca và giờ làm việc cho ${editingEmployeeShift.displayName || editingEmployeeShift.email}.`, undefined, "success");
      setEditingEmployeeShift(null);
      setRevision((v) => v + 1);
    } catch (err) {
      showAlert("Lỗi", messageOf(err), undefined, "error");
    } finally {
      setIsSavingEmployeeShift(false);
    }
  }

  const filteredShiftEmployees = useMemo(() => {
    if (!employeeSearchQuery.trim()) return shiftEmployees;
    const q = employeeSearchQuery.toLowerCase();
    return shiftEmployees.filter((emp) => {
      const nameMatch = (emp.displayName || "").toLowerCase().includes(q);
      const emailMatch = (emp.email || "").toLowerCase().includes(q);
      const deptMatch = (emp.department || "").toLowerCase().includes(q);
      return nameMatch || emailMatch || deptMatch;
    });
  }, [shiftEmployees, employeeSearchQuery]);

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
            style={[s.modeBtn, scheduleViewMode === "grid" && s.modeBtnActive, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }]}
            onPress={() => setScheduleViewMode("grid")}
          >
            <CalendarDays size={13} color={scheduleViewMode === "grid" ? "#4338ca" : "#64748b"} />
            <Text style={[s.modeBtnTxt, scheduleViewMode === "grid" ? s.modeBtnTxtActive : s.modeBtnTxtInactive]}>
              Lưới tháng
            </Text>
          </Pressable>
          <Pressable
            style={[s.modeBtn, scheduleViewMode === "list" && s.modeBtnActive, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }]}
            onPress={() => setScheduleViewMode("list")}
          >
            <List size={13} color={scheduleViewMode === "list" ? "#4338ca" : "#64748b"} />
            <Text style={[s.modeBtnTxt, scheduleViewMode === "list" ? s.modeBtnTxtActive : s.modeBtnTxtInactive]}>
              Danh sách
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[s.filterMineBtn, onlyMine && s.filterMineBtnActive, { flexDirection: "row", alignItems: "center", gap: 4 }]}
          onPress={() => setOnlyMine((v) => !v)}
        >
          {onlyMine && <Check size={12} color="#ffffff" strokeWidth={3} />}
          <Text style={[s.filterMineTxt, onlyMine && s.filterMineTxtActive]}>
            {onlyMine ? "Của tôi" : "Toàn công ty"}
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
        <Search size={14} color="#94a3b8" style={{ marginRight: 6 }} />
        <TextInput
          style={s.searchInput}
          placeholder="Tìm tiêu đề, nội dung, nhân sự…"
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {!!searchQuery && (
          <Pressable onPress={() => setSearchQuery("")} hitSlop={6}>
            <X size={14} color="#94a3b8" />
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
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={s.eventTimeTxt}>
                          {formatTimeOnly(item.startDate)} - {formatTimeOnly(item.endDate)}
                        </Text>
                        {(isManager || item.creatorId === user?.uid || item.employeeId === user?.uid) && (
                          <Pressable
                            hitSlop={8}
                            onPress={(e) => {
                              e.stopPropagation?.();
                              handleOpenEditEvent(item);
                            }}
                            style={s.miniEditBtn}
                          >
                            <Ionicons name="pencil" size={13} color="#4f46e5" />
                          </Pressable>
                        )}
                      </View>
                    </View>
                    <Text style={s.eventCardTitle} numberOfLines={2}>{item.title}</Text>
                    {!!item.description && (
                      <Text style={s.eventCardDesc} numberOfLines={2}>{item.description}</Text>
                    )}
                    {!!item.employeeName && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <User size={12} color="#64748b" />
                        <Text style={s.eventCardEmp}>{item.employeeName}</Text>
                      </View>
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
              <Calendar size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
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
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={s.listDateTxt}>{formatDateDisplay(item.startDate)}</Text>
                      {(isManager || item.creatorId === user?.uid || item.employeeId === user?.uid) && (
                        <Pressable
                          hitSlop={8}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            handleOpenEditEvent(item);
                          }}
                          style={s.miniEditBtn}
                        >
                          <Ionicons name="pencil" size={13} color="#4f46e5" />
                        </Pressable>
                      )}
                    </View>
                  </View>
                  <Text style={s.eventCardTitle}>{item.title}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Clock size={12} color="#64748b" />
                    <Text style={s.listRangeTxt}>
                      {formatFullDateTime(item.startDate)} → {formatTimeOnly(item.endDate)}
                    </Text>
                  </View>
                  {!!item.description && (
                    <Text style={s.eventCardDesc} numberOfLines={2}>{item.description}</Text>
                  )}
                  {!!item.employeeName && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <User size={12} color="#64748b" />
                      <Text style={s.eventCardEmp}>{item.employeeName}</Text>
                    </View>
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
     10. CRUD HANDLERS & RENDER SUB-TAB 4: CA & NGÀY LỄ (SHIFTS & HOLIDAYS)
     ========================================================================== */
  const handleDeleteShift = (sh: WorkShift) => {
    showAlert(
      "Xóa ca làm việc?",
      `Bạn có chắc chắn muốn xóa ca "${sh.name}" (${sh.code})? Ca đã được phân cho nhân viên có thể bị backend từ chối xóa; hãy ngừng hoạt động nếu cần.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await attendance.removeShift(sh._id);
              setRevision((v) => v + 1);
            } catch (e) {
              showAlert("Lỗi xóa ca", messageOf(e), undefined, "error");
            }
          },
        },
      ],
    );
  };

  const handleDeleteHoliday = (h: WorkCalendarDay) => {
    showAlert(
      "Xóa ngày nghỉ lễ?",
      `Bạn có chắc chắn muốn xóa ngày lễ "${h.name}" (${h.date})?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await workCalendar.remove(h._id);
              setRevision((v) => v + 1);
            } catch (e) {
              showAlert("Lỗi xóa ngày lễ", messageOf(e), undefined, "error");
            }
          },
        },
      ],
    );
  };

  const handleToggleHolidayApplied = (h: WorkCalendarDay) => {
    if (h.isApplied) {
      showAlert(
        "Tắt áp dụng ngày lễ?",
        `Tắt áp dụng ngày "${h.name}" (${h.date}). Ngày này sẽ được tính như ngày làm việc bình thường.`,
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Xác nhận tắt",
            style: "destructive",
            onPress: async () => {
              try {
                await workCalendar.update(h._id, { isApplied: false, adminReason: "Tắt bởi quản lý" });
                setRevision((v) => v + 1);
              } catch (e) {
                showAlert("Lỗi", messageOf(e), undefined, "error");
              }
            },
          },
        ],
      );
    } else {
      showAlert(
        "Bật áp dụng ngày lễ?",
        `Bật lại ngày "${h.name}" (${h.date}) để nhân viên được tính công nghỉ lễ.`,
        [
          { text: "Hủy", style: "cancel" },
          {
            text: "Bật áp dụng",
            onPress: async () => {
              try {
                await workCalendar.update(h._id, { isApplied: true });
                setRevision((v) => v + 1);
              } catch (e) {
                showAlert("Lỗi", messageOf(e), undefined, "error");
              }
            },
          },
        ],
      );
    }
  };

  const handleSyncHolidays = () => {
    showAlert(
      "Đồng bộ ngày lễ quốc gia?",
      `Đồng bộ toàn bộ lịch nghỉ lễ chuẩn quốc gia năm ${year} cho doanh nghiệp.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Đồng bộ",
          onPress: async () => {
            setIsSyncingHolidays(true);
            try {
              await workCalendar.sync(year);
              setRevision((v) => v + 1);
              showAlert("Thành công", `Đã đồng bộ lịch nghỉ lễ năm ${year}`, undefined, "success");
            } catch (e) {
              showAlert("Lỗi đồng bộ", messageOf(e), undefined, "error");
            } finally {
              setIsSyncingHolidays(false);
            }
          },
        },
      ],
    );
  };

  const renderShiftsHolidaysTab = () => (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={s.tabScroll} showsVerticalScrollIndicator={false}>
      {/* Sub-toggle: Shifts vs Employee Assignments vs Holidays */}
      <View style={s.shiftSubToggleRow}>
        <Pressable
          style={[s.shiftSubBtn, shiftViewMode === "shifts" && s.shiftSubBtnActive, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }]}
          onPress={() => setShiftViewMode("shifts")}
        >
          <Clock size={12} color={shiftViewMode === "shifts" ? "#4338ca" : "#64748b"} />
          <Text style={[s.shiftSubTxt, shiftViewMode === "shifts" ? s.shiftSubTxtActive : s.shiftSubTxtInactive]}>
            Ca làm ({shifts.length})
          </Text>
        </Pressable>
        <Pressable
          style={[s.shiftSubBtn, shiftViewMode === "employees" && s.shiftSubBtnActive, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }]}
          onPress={() => setShiftViewMode("employees")}
        >
          <Users size={12} color={shiftViewMode === "employees" ? "#4338ca" : "#64748b"} />
          <Text style={[s.shiftSubTxt, shiftViewMode === "employees" ? s.shiftSubTxtActive : s.shiftSubTxtInactive]}>
            Phân ca & Giờ ({shiftEmployees.length})
          </Text>
        </Pressable>
        <Pressable
          style={[s.shiftSubBtn, shiftViewMode === "holidays" && s.shiftSubBtnActive, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }]}
          onPress={() => setShiftViewMode("holidays")}
        >
          <Palmtree size={12} color={shiftViewMode === "holidays" ? "#4338ca" : "#64748b"} />
          <Text style={[s.shiftSubTxt, shiftViewMode === "holidays" ? s.shiftSubTxtActive : s.shiftSubTxtInactive]}>
            Nghỉ lễ ({holidays.length})
          </Text>
        </Pressable>
      </View>

      {shiftViewMode === "shifts" ? (
        <View style={{ marginTop: 10, gap: 10 }}>
          {/* Action Header for Shifts */}
          <View style={s.subSectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionHeader}>Danh sách ca làm việc</Text>
              <Text style={s.sectionSub}>Khung giờ chấm công & ngày làm việc</Text>
            </View>
            {isManager && (
              <Pressable
                style={({ pressed }) => [s.actionHeaderBtn, pressed && { opacity: 0.85 }]}
                onPress={() => setEditingShift("new")}
              >
                <Ionicons name="add" size={16} color="#ffffff" />
                <Text style={s.actionHeaderBtnText}>Thêm ca</Text>
              </Pressable>
            )}
          </View>

          {shifts.length === 0 ? (
            <View style={s.emptyBox}>
              <Clock size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
              <Text style={s.emptyTitle}>Chưa cấu hình ca làm việc</Text>
              <Text style={s.emptySub}>Bấm "Thêm ca" bên trên để tạo ca làm việc đầu tiên</Text>
              {isManager && (
                <Pressable style={s.emptyActionBtn} onPress={() => setEditingShift("new")}>
                  <Text style={s.emptyActionBtnText}>+ Thêm ca làm việc</Text>
                </Pressable>
              )}
            </View>
          ) : (
            shifts.map((sh) => {
              const breakInfo = sh.breakPeriods && sh.breakPeriods.length > 0 ? sh.breakPeriods[0] : null;
              const isOvernight = sh.crossesMidnight || sh.startTime > sh.endTime;

              return (
                <View key={sh._id || sh.code} style={s.shiftCard}>
                  {/* Top: Name & Code */}
                  <View style={s.shiftCardTop}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                      <View style={[s.shiftColorDot, { backgroundColor: sh.color || "#059669" }]} />
                      <Text style={s.shiftName}>{sh.name}</Text>
                      {sh.isDefault && (
                        <View style={s.defaultBadge}>
                          <Text style={s.defaultBadgeText}>Mặc định</Text>
                        </View>
                      )}
                    </View>
                    <View style={s.shiftCodeBadge}>
                      <Text style={s.shiftCodeTxt}>{sh.code}</Text>
                    </View>
                  </View>

                  {/* Hours & Overnight */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Clock size={12} color="#64748b" />
                      <Text style={s.shiftTime}>
                        Giờ làm: {sh.startTime} – {sh.endTime}
                      </Text>
                    </View>
                    {isOvernight && (
                      <View style={[s.overnightBadge, { flexDirection: "row", alignItems: "center", gap: 3 }]}>
                        <Moon size={11} color="#7c3aed" />
                        <Text style={s.overnightText}>Qua đêm</Text>
                      </View>
                    )}
                  </View>

                  {/* Working days pills */}
                  <View style={s.shiftDaysWrap}>
                    <Text style={s.shiftDaysLabel}>Ngày làm:</Text>
                    {[
                      { v: 1, l: "T2" },
                      { v: 2, l: "T3" },
                      { v: 3, l: "T4" },
                      { v: 4, l: "T5" },
                      { v: 5, l: "T6" },
                      { v: 6, l: "T7" },
                      { v: 0, l: "CN" },
                    ].map((d) => {
                      const active = (sh.workingDays || []).includes(d.v);
                      return (
                        <View key={d.v} style={[s.shiftDayMiniPill, active && s.shiftDayMiniPillActive]}>
                          <Text style={[s.shiftDayMiniText, active && s.shiftDayMiniTextActive]}>
                            {d.l}
                          </Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Break & Tolerance info */}
                  {breakInfo && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                      <Coffee size={12} color="#64748b" />
                      <Text style={s.shiftBreak}>
                        Nghỉ trưa: {breakInfo.startTime} – {breakInfo.endTime}
                      </Text>
                    </View>
                  )}

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Hourglass size={12} color="#64748b" />
                      <Text style={s.shiftTolerance}>
                        Trễ: {sh.allowedLateMinutes}p · Sớm: {sh.allowedEarlyLeaveMinutes}p
                      </Text>
                    </View>
                    <View style={[s.statusPill, { backgroundColor: sh.isActive ? "#ecfdf5" : "#f1f5f9" }]}>
                      <Text style={[s.statusPillText, { color: sh.isActive ? "#059669" : "#94a3b8" }]}>
                        {sh.isActive ? "● Hoạt động" : "○ Tạm ngừng"}
                      </Text>
                    </View>
                  </View>

                  {/* Manager Action Buttons */}
                  {isManager && (
                    <View style={s.cardActionRow}>
                      <Pressable
                        style={({ pressed }) => [s.editActionBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => setEditingShift(sh)}
                      >
                        <Ionicons name="pencil" size={14} color="#0284c7" />
                        <Text style={s.editActionText}>Sửa ca</Text>
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [s.deleteActionBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => handleDeleteShift(sh)}
                      >
                        <Ionicons name="trash-outline" size={14} color="#e11d48" />
                        <Text style={s.deleteActionText}>Xóa</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      ) : shiftViewMode === "employees" ? (
        <View style={{ marginTop: 10, gap: 10 }}>
          {/* Action Header for Employee Shifts */}
          <View style={s.subSectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionHeader}>Phân ca & Giờ làm từng nhân sự</Text>
              <Text style={s.sectionSub}>Sửa khung giờ làm việc và ca trực cụ thể cho từng nhân viên</Text>
            </View>
          </View>

          {/* Search Box for Employees */}
          <View style={s.searchBox}>
            <Search size={14} color="#94a3b8" style={{ marginRight: 6 }} />
            <TextInput
              style={s.searchInput}
              placeholder="Tìm nhân viên theo tên, email, phòng ban…"
              placeholderTextColor="#94a3b8"
              value={employeeSearchQuery}
              onChangeText={setEmployeeSearchQuery}
            />
            {!!employeeSearchQuery && (
              <Pressable onPress={() => setEmployeeSearchQuery("")} hitSlop={6}>
                <X size={14} color="#94a3b8" />
              </Pressable>
            )}
          </View>

          {filteredShiftEmployees.length === 0 ? (
            <View style={s.emptyBox}>
              <Users size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
              <Text style={s.emptyTitle}>Không tìm thấy nhân viên nào</Text>
              <Text style={s.emptySub}>Thử tìm kiếm với từ khóa khác hoặc tải lại</Text>
            </View>
          ) : (
            filteredShiftEmployees.map((emp) => {
              const currentShift = shifts.find((sh) => sh._id === emp.assignment?.shiftId);
              const hasAssignment = !!emp.assignment && !!currentShift;
              const assignedDays = emp.assignment?.daysOfWeek || currentShift?.workingDays || [];

              return (
                <View key={emp._id} style={s.empShiftCard}>
                  {/* Top row: Avatar, Name, Department */}
                  <View style={s.empCardTop}>
                    <View style={s.empAvatar}>
                      <Text style={s.empAvatarText}>
                        {(emp.displayName || emp.email || "NV").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <Text style={s.empName}>{emp.displayName || emp.email}</Text>
                        {!!emp.department && (
                          <View style={s.empDeptBadge}>
                            <Text style={s.empDeptText}>{emp.department}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={s.empEmail}>{emp.email}</Text>
                    </View>
                  </View>

                  {/* Shift & Work Hours detail */}
                  <View style={s.empShiftBox}>
                    {hasAssignment ? (
                      <>
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <View style={[s.shiftColorDot, { backgroundColor: currentShift.color || "#4f46e5" }]} />
                            <Text style={s.empAssignedShiftName}>{currentShift.name}</Text>
                            <Text style={s.shiftCodeMini}>({currentShift.code})</Text>
                          </View>
                          <View style={[s.empHoursPill, { flexDirection: "row", alignItems: "center", gap: 4 }]}>
                            <Clock size={11} color="#4338ca" />
                            <Text style={s.empHoursPillText}>
                              {currentShift.startTime} – {currentShift.endTime}
                            </Text>
                          </View>
                        </View>

                        {/* Active working days */}
                        <View style={s.empDaysRow}>
                          <Text style={s.empDaysLabel}>Ngày làm:</Text>
                          {[
                            { v: 1, l: "T2" },
                            { v: 2, l: "T3" },
                            { v: 3, l: "T4" },
                            { v: 4, l: "T5" },
                            { v: 5, l: "T6" },
                            { v: 6, l: "T7" },
                            { v: 0, l: "CN" },
                          ].map((d) => {
                            const active = assignedDays.includes(d.v);
                            return (
                              <View key={d.v} style={[s.empDayPill, active && s.empDayPillActive]}>
                                <Text style={[s.empDayPillText, active && s.empDayPillTextActive]}>
                                  {d.l}
                                </Text>
                              </View>
                            );
                          })}
                        </View>

                        {/* Effective period */}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                          <Calendar size={12} color="#64748b" />
                          <Text style={s.empPeriodText}>
                            Hiệu lực: {emp.assignment?.effectiveFrom || "--"}
                            {emp.assignment?.effectiveTo ? ` → ${emp.assignment.effectiveTo}` : " (Vô thời hạn)"}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <View style={s.unassignedBox}>
                        <Ionicons name="alert-circle-outline" size={16} color="#d97706" />
                        <Text style={s.unassignedText}>Chưa cài đặt giờ làm việc cố định</Text>
                      </View>
                    )}
                  </View>

                  {/* Action Row */}
                  {isManager && (
                    <View style={s.empActionRow}>
                      <Pressable
                        style={({ pressed }) => [s.editHoursBtn, pressed && { opacity: 0.8 }]}
                        onPress={() => handleOpenEditEmployeeShift(emp)}
                      >
                        <Ionicons name="time-outline" size={15} color="#4f46e5" />
                        <Text style={s.editHoursBtnText}>Sửa giờ / Đổi ca</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      ) : (
        <View style={{ marginTop: 10, gap: 10 }}>
          {/* Action Header for Holidays */}
          <View style={s.subSectionHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.sectionHeader}>Lịch nghỉ lễ năm {year}</Text>
              <Text style={s.sectionSub}>Lễ hưởng lương & làm bù</Text>
            </View>
            {isManager && (
              <View style={{ flexDirection: "row", gap: 6 }}>
                <Pressable
                  style={({ pressed }) => [s.syncHeaderBtn, pressed && { opacity: 0.85 }]}
                  onPress={handleSyncHolidays}
                  disabled={isSyncingHolidays}
                >
                  <Ionicons name="cloud-download-outline" size={15} color="#475569" />
                  <Text style={s.syncHeaderBtnText}>
                    {isSyncingHolidays ? "Đang đồng bộ..." : "Đồng bộ lễ"}
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [s.actionHeaderBtn, pressed && { opacity: 0.85 }]}
                  onPress={() => setEditingHoliday("new")}
                >
                  <Ionicons name="add" size={16} color="#ffffff" />
                  <Text style={s.actionHeaderBtnText}>Thêm ngày</Text>
                </Pressable>
              </View>
            )}
          </View>

          {holidays.length === 0 ? (
            <View style={s.emptyBox}>
              <Palmtree size={36} color="#94a3b8" style={{ marginBottom: 8 }} />
              <Text style={s.emptyTitle}>Chưa có lịch nghỉ lễ trong năm {year}</Text>
              <Text style={s.emptySub}>Bấm nút bên dưới để đồng bộ lịch nghỉ lễ quốc gia hoặc thêm ngày mới</Text>
              {isManager && (
                <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                  <Pressable style={s.emptyActionBtn} onPress={handleSyncHolidays}>
                    <Text style={s.emptyActionBtnText}>Đồng bộ lễ quốc gia</Text>
                  </Pressable>
                  <Pressable style={[s.emptyActionBtn, { backgroundColor: "#059669" }]} onPress={() => setEditingHoliday("new")}>
                    <Text style={s.emptyActionBtnText}>+ Thêm ngày mới</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ) : (
            holidays.map((h, i) => {
              const dayTypeLabel =
                h.dayType === "substitute_holiday"
                  ? "Nghỉ bù"
                  : h.dayType === "working_override"
                    ? "Làm bù"
                    : "Nghỉ lễ";
              const dayTypeBg =
                h.dayType === "substitute_holiday"
                  ? "#fffbeb"
                  : h.dayType === "working_override"
                    ? "#eef2ff"
                    : "#ecfdf5";
              const dayTypeCol =
                h.dayType === "substitute_holiday"
                  ? "#d97706"
                  : h.dayType === "working_override"
                    ? "#4f46e5"
                    : "#059669";

              return (
                <View key={h._id || `holiday-${i}`} style={s.holidayCard}>
                  {/* Top: Name & Day Type badge */}
                  <View style={s.holidayCardTop}>
                    <Text style={s.holidayName}>{h.name || "Ngày nghỉ lễ"}</Text>
                    <View style={[s.holidayTypeTag, { backgroundColor: dayTypeBg }]}>
                      <Text style={[s.holidayTypeTagText, { color: dayTypeCol }]}>
                        {dayTypeLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Date & Metadata */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <Text style={s.holidayDate}>{formatDateDisplay(h.date)}</Text>
                    <Text style={{ fontSize: 11, color: "#94a3b8" }}>·</Text>
                    <Text style={s.holidaySourceText}>
                      {h.source === "system" ? "Lễ quốc gia" : "Tự tạo"}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#94a3b8" }}>·</Text>
                    <View style={[s.statusPill, { backgroundColor: h.isApplied ? "#ecfdf5" : "#fff1f2" }]}>
                      <Text style={[s.statusPillText, { color: h.isApplied ? "#059669" : "#e11d48" }]}>
                        {h.isApplied ? "Đang áp dụng" : "Đã tắt"}
                      </Text>
                    </View>
                  </View>

                  {/* Admin Reason if any */}
                  {!!h.adminReason && (
                    <Text style={s.holidayReason}>Ghi chú: {h.adminReason}</Text>
                  )}

                  {/* Manager Action Buttons */}
                  {isManager && (
                    <View style={s.cardActionRow}>
                      <Pressable
                        style={({ pressed }) => [s.toggleActionBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => handleToggleHolidayApplied(h)}
                      >
                        <Ionicons
                          name={h.isApplied ? "eye-off-outline" : "checkmark-circle-outline"}
                          size={14}
                          color={h.isApplied ? "#d97706" : "#059669"}
                        />
                        <Text style={[s.toggleActionText, { color: h.isApplied ? "#d97706" : "#059669" }]}>
                          {h.isApplied ? "Tắt áp dụng" : "Bật áp dụng"}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={({ pressed }) => [s.editActionBtn, pressed && { opacity: 0.7 }]}
                        onPress={() => setEditingHoliday(h)}
                      >
                        <Ionicons name="pencil" size={14} color="#0284c7" />
                        <Text style={s.editActionText}>Sửa</Text>
                      </Pressable>

                      {h.source === "admin" && (
                        <Pressable
                          style={({ pressed }) => [s.deleteActionBtn, pressed && { opacity: 0.7 }]}
                          onPress={() => handleDeleteHoliday(h)}
                        >
                          <Ionicons name="trash-outline" size={14} color="#e11d48" />
                          <Text style={s.deleteActionText}>Xóa</Text>
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              );
            })
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
        {!hasOpenCalendarModal && alertView}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={s.root}>
      <Header />

      {/* Subtab Navigator Bar */}
      <View style={s.subTabBar}>
        <Pressable
          style={[s.subTabBtn, subTab === "schedule" && s.subTabBtnActive, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }]}
          onPress={() => setSubTab("schedule")}
        >
          <Calendar size={14} color={subTab === "schedule" ? "#4338ca" : "#64748b"} />
          <Text style={[s.subTabTxt, subTab === "schedule" && s.subTabTxtActive]}>
            Lịch trình
          </Text>
        </Pressable>

        <Pressable
          style={[s.subTabBtn, subTab === "shifts" && s.subTabBtnActive, { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 }]}
          onPress={() => setSubTab("shifts")}
        >
          <Building2 size={14} color={subTab === "shifts" ? "#4338ca" : "#64748b"} />
          <Text style={[s.subTabTxt, subTab === "shifts" && s.subTabTxtActive]}>
            Ca & Lễ
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
          {subTab === "shifts" && renderShiftsHolidaysTab()}
        </>
      )}

      {/* MODAL: ADD EVENT */}
      <Modal visible={isAddModalOpen} animationType="slide" transparent onRequestClose={() => setIsAddModalOpen(false)}>
        <Pressable style={s.modalBackdrop} onPress={() => setIsAddModalOpen(false)}>
          <Pressable style={[s.modalSheet, { maxHeight: "92%" }]} onPress={() => {}}>
            <View style={s.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>Thêm lịch trình mới</Text>

              {/* Employee / Assignee selector */}
              <Text style={s.formLabel}>Nhân sự áp dụng</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
                {employees.map((emp) => {
                  const isSelected = newAssigneeId === emp.uid;
                  return (
                    <Pressable
                      key={emp.uid}
                      style={[s.empPickPill, isSelected && s.empPickPillActive]}
                      onPress={() => setNewAssigneeId(emp.uid)}
                    >
                      <View style={[s.miniAvatar, isSelected && { backgroundColor: "#4f46e5" }]}>
                        <Text style={[s.miniAvatarText, isSelected && { color: "#ffffff" }]}>
                          {(emp.displayName || emp.email).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[s.empPickPillText, isSelected && s.empPickPillTextActive]}>
                        {emp.displayName || emp.email}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

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

              {/* Quick time chips */}
              <Text style={s.formLabel}>Gợi ý khung giờ nhanh</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
                {[
                  { l: "Cả ngày (08:00 – 17:30)", s: "08:00", e: "17:30" },
                  { l: "Ca sáng (08:00 – 12:00)", s: "08:00", e: "12:00" },
                  { l: "Ca chiều (13:30 – 17:30)", s: "13:30", e: "17:30" },
                  { l: "09:00 – 10:00", s: "09:00", e: "10:00" },
                  { l: "14:00 – 15:00", s: "14:00", e: "15:00" },
                ].map((p, idx) => (
                  <Pressable
                    key={idx}
                    style={s.presetTimeChip}
                    onPress={() => {
                      setNewStartTime(p.s);
                      setNewEndTime(p.e);
                    }}
                  >
                    <Text style={s.presetTimeText}>{p.l}</Text>
                  </Pressable>
                ))}
              </ScrollView>

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
                <View style={{ width: 85 }}>
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
                <View style={{ width: 85 }}>
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
            </ScrollView>
          </Pressable>
        </Pressable>
        {isAddModalOpen && alertView}
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

                <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
                  {(isManager || viewingItem.creatorId === user?.uid || viewingItem.employeeId === user?.uid) && (
                    <Pressable
                      style={[s.modalBtn, { backgroundColor: "#eef2ff", borderWidth: 1, borderColor: "#c7d2fe", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 }]}
                      onPress={() => handleOpenEditEvent(viewingItem)}
                    >
                      <Edit2 size={13} color="#4338ca" />
                      <Text style={{ fontWeight: "700", color: "#4338ca" }}>Sửa giờ</Text>
                    </Pressable>
                  )}
                  {(isManager || viewingItem.creatorId === user?.uid) && (
                    <Pressable
                      style={[s.modalBtn, { backgroundColor: "#fff1f2", borderWidth: 1, borderColor: "#fecdd3" }]}
                      onPress={() => handleDeleteEvent(viewingItem.id || viewingItem._id)}
                    >
                      <Text style={{ fontWeight: "700", color: "#be123c" }}>Xóa</Text>
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
        {!!viewingItem && alertView}
      </Modal>

      {/* MODAL: EDIT CALENDAR EVENT & WORK HOURS */}
      <Modal
        visible={editingCalendarItem !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingCalendarItem(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setEditingCalendarItem(null)}>
          <Pressable style={[s.modalSheet, { maxHeight: "92%" }]} onPress={() => {}}>
            <View style={s.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>Sửa giờ làm & Lịch trình</Text>

              {/* Assignee / Employee Picker */}
              <Text style={s.formLabel}>Nhân sự thực hiện *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
                {employees.map((emp) => {
                  const isSelected = editAssigneeId === emp.uid;
                  return (
                    <Pressable
                      key={emp.uid}
                      style={[s.empPickPill, isSelected && s.empPickPillActive]}
                      onPress={() => setEditAssigneeId(emp.uid)}
                    >
                      <View style={[s.miniAvatar, isSelected && { backgroundColor: "#4f46e5" }]}>
                        <Text style={[s.miniAvatarText, isSelected && { color: "#ffffff" }]}>
                          {(emp.displayName || emp.email).charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <Text style={[s.empPickPillText, isSelected && s.empPickPillTextActive]}>
                        {emp.displayName || emp.email}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Type selector */}
              <Text style={s.formLabel}>Loại lịch trình</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
                {(["event", "leave", "wfh", "exception", "reminder"] as const).map((tKey) => {
                  const meta = EVENT_TYPE_MAP[tKey];
                  const active = editType === tKey;
                  return (
                    <Pressable
                      key={tKey}
                      style={[s.modalTypePill, active && { backgroundColor: meta.bg, borderColor: meta.border }]}
                      onPress={() => setEditType(tKey)}
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
                placeholder="Tiêu đề sự kiện hoặc lịch làm việc..."
                placeholderTextColor="#94a3b8"
                value={editTitle}
                onChangeText={setEditTitle}
              />

              {/* Description */}
              <Text style={s.formLabel}>Mô tả</Text>
              <TextInput
                style={[s.formInput, { height: 60, textAlignVertical: "top" }]}
                placeholder="Chi tiết công việc hoặc ghi chú..."
                placeholderTextColor="#94a3b8"
                multiline
                value={editDesc}
                onChangeText={setEditDesc}
              />

              {/* Quick time chips */}
              <Text style={s.formLabel}>Gợi ý khung giờ nhanh</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
                {[
                  { l: "Cả ngày (08:00 – 17:30)", s: "08:00", e: "17:30" },
                  { l: "Ca sáng (08:00 – 12:00)", s: "08:00", e: "12:00" },
                  { l: "Ca chiều (13:30 – 17:30)", s: "13:30", e: "17:30" },
                  { l: "09:00 – 10:00", s: "09:00", e: "10:00" },
                  { l: "14:00 – 15:00", s: "14:00", e: "15:00" },
                ].map((p, idx) => (
                  <Pressable
                    key={idx}
                    style={s.presetTimeChip}
                    onPress={() => {
                      setEditStartTime(p.s);
                      setEditEndTime(p.e);
                    }}
                  >
                    <Text style={s.presetTimeText}>{p.l}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              {/* Start Date & Time */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Bắt đầu (YYYY-MM-DD) *</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={editStartDate}
                    onChangeText={setEditStartDate}
                  />
                </View>
                <View style={{ width: 85 }}>
                  <Text style={s.formLabel}>Giờ (HH:mm) *</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="HH:mm"
                    placeholderTextColor="#94a3b8"
                    value={editStartTime}
                    onChangeText={setEditStartTime}
                  />
                </View>
              </View>

              {/* End Date & Time */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Kết thúc (YYYY-MM-DD) *</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={editEndDate}
                    onChangeText={setEditEndDate}
                  />
                </View>
                <View style={{ width: 85 }}>
                  <Text style={s.formLabel}>Giờ (HH:mm) *</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="HH:mm"
                    placeholderTextColor="#94a3b8"
                    value={editEndTime}
                    onChangeText={setEditEndTime}
                  />
                </View>
              </View>

              {/* Action buttons */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <Pressable
                  style={[s.modalBtn, { backgroundColor: "#f1f5f9" }]}
                  onPress={() => setEditingCalendarItem(null)}
                >
                  <Text style={{ fontWeight: "700", color: "#475569" }}>Hủy</Text>
                </Pressable>
                <Pressable
                  style={[s.modalBtn, { backgroundColor: "#4f46e5" }]}
                  onPress={handleSaveEditEvent}
                  disabled={isUpdatingEvent}
                >
                  {isUpdatingEvent ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={{ fontWeight: "800", color: "#ffffff" }}>Cập nhật lịch</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
        {editingCalendarItem !== null && alertView}
      </Modal>

      {/* MODAL: EDIT EMPLOYEE SHIFT & WORK HOURS */}
      <Modal
        visible={editingEmployeeShift !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setEditingEmployeeShift(null)}
      >
        <Pressable style={s.modalBackdrop} onPress={() => setEditingEmployeeShift(null)}>
          <Pressable style={[s.modalSheet, { maxHeight: "92%" }]} onPress={() => {}}>
            <View style={s.modalHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.modalTitle}>Sửa giờ làm & Phân ca</Text>
              {editingEmployeeShift && (
                <View style={s.modalEmpBanner}>
                  <View style={s.empAvatar}>
                    <Text style={s.empAvatarText}>
                      {(editingEmployeeShift.displayName || editingEmployeeShift.email || "NV").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "800", color: "#0f172a" }}>
                      {editingEmployeeShift.displayName || editingEmployeeShift.email}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#64748b" }}>{editingEmployeeShift.email}</Text>
                    {!!editingEmployeeShift.department && (
                      <Text style={{ fontSize: 11, color: "#4f46e5", fontWeight: "600", marginTop: 2 }}>
                        {editingEmployeeShift.department}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Mode switch: Existing shift vs Custom hours */}
              <Text style={s.formLabel}>Phương thức phân ca & giờ làm</Text>
              <View style={s.modeSegmentBox}>
                <Pressable
                  style={[s.modeSegmentBtn, !isCustomHoursMode && s.modeSegmentBtnActive]}
                  onPress={() => setIsCustomHoursMode(false)}
                >
                  <Text style={[s.modeSegmentBtnText, !isCustomHoursMode && s.modeSegmentBtnTextActive]}>
                    Chọn ca có sẵn ({shifts.length})
                  </Text>
                </Pressable>
                <Pressable
                  style={[s.modeSegmentBtn, isCustomHoursMode && s.modeSegmentBtnActive]}
                  onPress={() => setIsCustomHoursMode(true)}
                >
                  <Text style={[s.modeSegmentBtnText, isCustomHoursMode && s.modeSegmentBtnTextActive]}>
                    Tùy chỉnh giờ riêng
                  </Text>
                </Pressable>
              </View>

              {!isCustomHoursMode ? (
                <>
                  <Text style={s.formLabel}>Chọn ca làm việc *</Text>
                  <View style={{ gap: 8, marginBottom: 12 }}>
                    {shifts.map((sh) => {
                      const isSelected = assignShiftId === sh._id;
                      return (
                        <Pressable
                          key={sh._id}
                          style={[s.shiftPickCard, isSelected && s.shiftPickCardSelected]}
                          onPress={() => {
                            setAssignShiftId(sh._id);
                            if (sh.workingDays && sh.workingDays.length > 0) {
                              setAssignDaysOfWeek(sh.workingDays);
                            }
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                            <View style={[s.shiftColorDot, { backgroundColor: sh.color || "#4f46e5" }]} />
                            <View>
                              <Text style={[s.shiftPickName, isSelected && { color: "#4338ca", fontWeight: "800" }]}>
                                {sh.name}
                              </Text>
                              <Text style={s.shiftPickCode}>{sh.code}</Text>
                            </View>
                          </View>
                          <View style={[s.shiftPickHoursBadge, isSelected && { backgroundColor: "#e0e7ff" }, { flexDirection: "row", alignItems: "center", gap: 4 }]}>
                            <Clock size={11} color={isSelected ? "#3730a3" : "#475569"} />
                            <Text style={[s.shiftPickHoursText, isSelected && { color: "#3730a3" }]}>
                              {sh.startTime} – {sh.endTime}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : (
                <>
                  <Text style={s.formLabel}>Tên ca làm tùy chỉnh</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="VD: Ca part-time, Ca điều dưỡng sáng..."
                    placeholderTextColor="#94a3b8"
                    value={customShiftName}
                    onChangeText={setCustomShiftName}
                  />

                  {/* Quick time preset chips */}
                  <Text style={s.formLabel}>Gợi ý khung giờ nhanh</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 10 }}>
                    {[
                      { l: "08:00 – 17:00", s: "08:00", e: "17:00" },
                      { l: "08:30 – 17:30", s: "08:30", e: "17:30" },
                      { l: "09:00 – 18:00", s: "09:00", e: "18:00" },
                      { l: "Ca sáng (08:00 – 12:00)", s: "08:00", e: "12:00" },
                      { l: "Ca chiều (13:30 – 17:30)", s: "13:30", e: "17:30" },
                      { l: "Ca tối (18:00 – 22:00)", s: "18:00", e: "22:00" },
                    ].map((p, idx) => (
                      <Pressable
                        key={idx}
                        style={s.presetTimeChip}
                        onPress={() => {
                          setCustomStartTime(p.s);
                          setCustomEndTime(p.e);
                        }}
                      >
                        <Text style={s.presetTimeText}>{p.l}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>

                  <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.formLabel}>Giờ bắt đầu (HH:mm) *</Text>
                      <TextInput
                        style={s.formInput}
                        placeholder="08:30"
                        placeholderTextColor="#94a3b8"
                        value={customStartTime}
                        onChangeText={setCustomStartTime}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.formLabel}>Giờ kết thúc (HH:mm) *</Text>
                      <TextInput
                        style={s.formInput}
                        placeholder="17:30"
                        placeholderTextColor="#94a3b8"
                        value={customEndTime}
                        onChangeText={setCustomEndTime}
                      />
                    </View>
                  </View>
                </>
              )}

              {/* Working Days of Week Toggle */}
              <Text style={s.formLabel}>Các ngày làm việc trong tuần *</Text>
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
                {[
                  { v: 1, l: "T2" },
                  { v: 2, l: "T3" },
                  { v: 3, l: "T4" },
                  { v: 4, l: "T5" },
                  { v: 5, l: "T6" },
                  { v: 6, l: "T7" },
                  { v: 0, l: "CN" },
                ].map((d) => {
                  const active = assignDaysOfWeek.includes(d.v);
                  return (
                    <Pressable
                      key={d.v}
                      style={[s.dayToggleBtn, active && s.dayToggleBtnActive]}
                      onPress={() => toggleAssignDay(d.v)}
                    >
                      <Text style={[s.dayToggleBtnText, active && s.dayToggleBtnTextActive]}>
                        {d.l}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* Effective Date Range */}
              <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Hiệu lực từ (YYYY-MM-DD) *</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={assignEffectiveFrom}
                    onChangeText={setAssignEffectiveFrom}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.formLabel}>Đến ngày (tùy chọn)</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#94a3b8"
                    value={assignEffectiveTo}
                    onChangeText={setAssignEffectiveTo}
                  />
                </View>
              </View>

              {/* Action buttons */}
              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                <Pressable
                  style={[s.modalBtn, { backgroundColor: "#f1f5f9" }]}
                  onPress={() => setEditingEmployeeShift(null)}
                >
                  <Text style={{ fontWeight: "700", color: "#475569" }}>Hủy</Text>
                </Pressable>
                <Pressable
                  style={[s.modalBtn, { backgroundColor: "#4f46e5" }]}
                  onPress={handleSaveEmployeeShift}
                  disabled={isSavingEmployeeShift}
                >
                  {isSavingEmployeeShift ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={{ fontWeight: "800", color: "#ffffff" }}>Lưu giờ làm & Phân ca</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
        {editingEmployeeShift !== null && alertView}
      </Modal>

      {/* MODAL: SHIFT CRUD */}
      <Modal
        visible={editingShift !== null}
        animationType="slide"
        onRequestClose={() => setEditingShift(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }} edges={["top"]}>
          {editingShift !== null && (
            <ShiftForm
              shift={editingShift === "new" ? undefined : editingShift}
              onClose={() => setEditingShift(null)}
              onSuccess={() => {
                setEditingShift(null);
                setRevision((v) => v + 1);
              }}
              setLocked={() => {}}
            />
          )}
        </SafeAreaView>
        {editingShift !== null && alertView}
      </Modal>

      {/* MODAL: HOLIDAY CRUD */}
      <Modal
        visible={editingHoliday !== null}
        animationType="slide"
        onRequestClose={() => setEditingHoliday(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }} edges={["top"]}>
          {editingHoliday !== null && (
            <HolidayForm
              holiday={editingHoliday === "new" ? undefined : editingHoliday}
              year={year}
              onClose={() => setEditingHoliday(null)}
              onSuccess={() => {
                setEditingHoliday(null);
                setRevision((v) => v + 1);
              }}
            />
          )}
        </SafeAreaView>
        {editingHoliday !== null && alertView}
      </Modal>
      {!hasOpenCalendarModal && alertView}
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
  holidayReason: { fontSize: 11, color: "#64748b", marginTop: 4 },
  subSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  actionHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#059669",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionHeaderBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  syncHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  syncHeaderBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  emptyActionBtn: {
    marginTop: 8,
    backgroundColor: "#4f46e5",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  shiftColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  defaultBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#b45309",
  },
  overnightBadge: {
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  overnightText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7c3aed",
  },
  shiftDaysWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  shiftDaysLabel: {
    fontSize: 11,
    color: "#64748b",
    marginRight: 2,
  },
  shiftDayMiniPill: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#f1f5f9",
  },
  shiftDayMiniPillActive: {
    backgroundColor: "#059669",
  },
  shiftDayMiniText: {
    fontSize: 10,
    color: "#94a3b8",
    fontWeight: "600",
  },
  shiftDayMiniTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  shiftTolerance: {
    fontSize: 11,
    color: "#64748b",
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  cardActionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  editActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  editActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0284c7",
  },
  deleteActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  deleteActionText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#e11d48",
  },
  toggleActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  toggleActionText: {
    fontSize: 11,
    fontWeight: "700",
  },
  holidayTypeTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  holidayTypeTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  holidaySourceText: {
    fontSize: 11,
    color: "#64748b",
  },

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

  miniEditBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: "#eef2ff",
  },

  /* Employee Shift Cards */
  empShiftCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  empCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  empAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#4f46e5",
    alignItems: "center",
    justifyContent: "center",
  },
  empAvatarText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#ffffff",
  },
  empName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#0f172a",
  },
  empEmail: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  empDeptBadge: {
    backgroundColor: "#eef2ff",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  empDeptText: {
    fontSize: 10,
    color: "#4f46e5",
    fontWeight: "700",
  },
  empShiftBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
  },
  empAssignedShiftName: {
    fontSize: 12,
    fontWeight: "800",
    color: "#0f172a",
  },
  shiftCodeMini: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  empHoursPill: {
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  empHoursPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#047857",
  },
  empDaysRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  empDaysLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748b",
    marginRight: 2,
  },
  empDayPill: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  empDayPillActive: {
    backgroundColor: "#4f46e5",
  },
  empDayPillText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#64748b",
  },
  empDayPillTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  empPeriodText: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  unassignedBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  unassignedText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#d97706",
  },
  empActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  editHoursBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editHoursBtnText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4338ca",
  },

  /* Modals for Shift & Hour Edit */
  modalEmpBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 10,
    marginBottom: 12,
  },
  modeSegmentBox: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 3,
    marginBottom: 12,
  },
  modeSegmentBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 8,
  },
  modeSegmentBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  modeSegmentBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  modeSegmentBtnTextActive: {
    color: "#4f46e5",
    fontWeight: "800",
  },
  shiftPickCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
  },
  shiftPickCardSelected: {
    backgroundColor: "#eef2ff",
    borderColor: "#818cf8",
  },
  shiftPickName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  shiftPickCode: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 1,
  },
  shiftPickHoursBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  shiftPickHoursText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
  },
  presetTimeChip: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  presetTimeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  dayToggleBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dayToggleBtnActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  dayToggleBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  dayToggleBtnTextActive: {
    color: "#ffffff",
    fontWeight: "800",
  },
  empPickPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  empPickPillActive: {
    backgroundColor: "#eef2ff",
    borderColor: "#6366f1",
  },
  miniAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  miniAvatarText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#475569",
  },
  empPickPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  empPickPillTextActive: {
    color: "#4f46e5",
    fontWeight: "800",
  },
});
