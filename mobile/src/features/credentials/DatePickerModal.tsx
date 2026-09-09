import React, { useState, useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  value: string; // YYYY-MM-DD or ""
  onChange: (dateStr: string) => void;
  title?: string;
  allowClear?: boolean;
  baseDateForShortcuts?: string; // YYYY-MM-DD
}

const WEEK_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const MONTH_NAMES = [
  "Tháng 1",
  "Tháng 2",
  "Tháng 3",
  "Tháng 4",
  "Tháng 5",
  "Tháng 6",
  "Tháng 7",
  "Tháng 8",
  "Tháng 9",
  "Tháng 10",
  "Tháng 11",
  "Tháng 12",
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseDateStr(str: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split("-").map(Number);
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
      return { year: y, month: m - 1, day: d };
    }
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth(), day: now.getDate() };
}

export function DatePickerModal({
  visible,
  onClose,
  value,
  onChange,
  title = "Chọn ngày",
  allowClear = false,
  baseDateForShortcuts,
}: DatePickerModalProps) {
  const initial = useMemo(() => parseDateStr(value), [value]);
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [selectedDate, setSelectedDate] = useState(value);

  // Sync when opening
  React.useEffect(() => {
    if (visible) {
      const p = parseDateStr(value);
      setViewYear(p.year);
      setViewMonth(p.month);
      setSelectedDate(value);
    }
  }, [visible, value]);

  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  const startDayOfWeek = useMemo(() => {
    // Monday = 0, ..., Sunday = 6
    const d = new Date(viewYear, viewMonth, 1).getDay();
    return (d + 6) % 7;
  }, [viewYear, viewMonth]);

  const prevMonthDays = useMemo(() => {
    return new Date(viewYear, viewMonth, 0).getDate();
  }, [viewYear, viewMonth]);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const formatted = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
    setSelectedDate(formatted);
    onChange(formatted);
    onClose();
  };

  const handleQuickToday = () => {
    const now = new Date();
    const formatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    setSelectedDate(formatted);
    onChange(formatted);
    onClose();
  };

  const handleQuickAddYears = (years: number) => {
    const base = baseDateForShortcuts && /^\d{4}-\d{2}-\d{2}$/.test(baseDateForShortcuts)
      ? parseDateStr(baseDateForShortcuts)
      : parseDateStr(value || "");
    const newYear = base.year + years;
    const formatted = `${newYear}-${pad(base.month + 1)}-${pad(base.day)}`;
    setSelectedDate(formatted);
    onChange(formatted);
    onClose();
  };

  const handleClear = () => {
    setSelectedDate("");
    onChange("");
    onClose();
  };

  // Build calendar matrix
  const calendarCells = [];
  // Leading empty/prev month days
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    calendarCells.push({ day: prevMonthDays - i, isCurrentMonth: false });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push({ day: d, isCurrentMonth: true });
  }
  // Trailing next month days to fill complete weeks
  const totalCells = Math.ceil(calendarCells.length / 7) * 7;
  let nextD = 1;
  while (calendarCells.length < totalCells) {
    calendarCells.push({ day: nextD++, isCurrentMonth: false });
  }

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropDismiss} onPress={onClose} />

        <View style={styles.dialog}>
          {/* Header */}
          <View style={styles.dialogHeader}>
            <View>
              <Text style={styles.dialogTitle}>{title}</Text>
              <Text style={styles.dialogSubtitle}>
                {selectedDate
                  ? `Đang chọn: ${selectedDate.split("-").reverse().join("/")}`
                  : "Chưa chọn ngày"}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Month / Year Navigator */}
          <View style={styles.navRow}>
            <Pressable onPress={handlePrevMonth} hitSlop={8} style={styles.navArrowBtn}>
              <Text style={styles.navArrowText}>‹</Text>
            </Pressable>

            <View style={styles.navMonthYear}>
              <Text style={styles.navMonthText}>{MONTH_NAMES[viewMonth]}</Text>
              <View style={styles.yearButtonsRow}>
                <Pressable onPress={() => setViewYear((y) => y - 1)} hitSlop={6} style={styles.yearChangeBtn}>
                  <Text style={styles.yearChangeText}>-1</Text>
                </Pressable>
                <Text style={styles.navYearText}>{viewYear}</Text>
                <Pressable onPress={() => setViewYear((y) => y + 1)} hitSlop={6} style={styles.yearChangeBtn}>
                  <Text style={styles.yearChangeText}>+1</Text>
                </Pressable>
              </View>
            </View>

            <Pressable onPress={handleNextMonth} hitSlop={8} style={styles.navArrowBtn}>
              <Text style={styles.navArrowText}>›</Text>
            </Pressable>
          </View>

          {/* Weekday headers */}
          <View style={styles.weekDaysRow}>
            {WEEK_DAYS.map((w, idx) => (
              <View key={w} style={styles.weekDayCell}>
                <Text
                  style={[
                    styles.weekDayText,
                    idx === 6 && { color: "#e11d48" }, // Sunday
                    idx === 5 && { color: "#0284c7" }, // Saturday
                  ]}
                >
                  {w}
                </Text>
              </View>
            ))}
          </View>

          {/* Days Grid */}
          <View style={styles.daysGrid}>
            {calendarCells.map((cell, idx) => {
              if (!cell.isCurrentMonth) {
                return (
                  <View key={`cell-${idx}`} style={styles.dayCell}>
                    <Text style={styles.otherMonthText}>{cell.day}</Text>
                  </View>
                );
              }

              const cellDateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(cell.day)}`;
              const isSelected = selectedDate === cellDateStr;
              const isToday = todayStr === cellDateStr;

              return (
                <Pressable
                  key={`cell-${idx}`}
                  style={[
                    styles.dayCell,
                    isSelected && styles.dayCellSelected,
                    isToday && !isSelected && styles.dayCellToday,
                  ]}
                  onPress={() => handleSelectDay(cell.day)}
                >
                  <Text
                    style={[
                      styles.dayText,
                      isSelected && styles.dayTextSelected,
                      isToday && !isSelected && styles.dayTextToday,
                    ]}
                  >
                    {cell.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Quick Shortcuts */}
          <View style={styles.shortcutsRow}>
            <Pressable style={styles.shortcutChip} onPress={handleQuickToday}>
              <Text style={styles.shortcutChipText}>Hôm nay</Text>
            </Pressable>

            {allowClear && (
              <>
                <Pressable style={styles.shortcutChip} onPress={() => handleQuickAddYears(1)}>
                  <Text style={styles.shortcutChipText}>+1 năm</Text>
                </Pressable>
                <Pressable style={styles.shortcutChip} onPress={() => handleQuickAddYears(3)}>
                  <Text style={styles.shortcutChipText}>+3 năm</Text>
                </Pressable>
                <Pressable style={styles.shortcutChip} onPress={() => handleQuickAddYears(5)}>
                  <Text style={styles.shortcutChipText}>+5 năm</Text>
                </Pressable>
                <Pressable style={[styles.shortcutChip, styles.shortcutChipClear]} onPress={handleClear}>
                  <Text style={styles.shortcutChipClearText}>Không thời hạn</Text>
                </Pressable>
              </>
            )}
          </View>

          <SafeAreaView edges={["bottom"]} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    justifyContent: "center",
    padding: 16,
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  dialog: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 10,
  },
  dialogTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  dialogSubtitle: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  navArrowBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  navArrowText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 22,
  },
  navMonthYear: {
    alignItems: "center",
    gap: 2,
  },
  navMonthText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
  },
  yearButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  yearChangeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: "#e2e8f0",
    borderRadius: 6,
  },
  yearChangeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#475569",
  },
  navYearText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
  },
  weekDaysRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  weekDayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  weekDayText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 4,
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1.1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  dayCellSelected: {
    backgroundColor: "#059669",
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: "#059669",
  },
  dayText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  dayTextSelected: {
    color: "#ffffff",
    fontWeight: "800",
  },
  dayTextToday: {
    color: "#059669",
    fontWeight: "800",
  },
  otherMonthText: {
    fontSize: 13,
    color: "#cbd5e1",
  },
  shortcutsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 12,
  },
  shortcutChip: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  shortcutChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0f172a",
  },
  shortcutChipClear: {
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
  },
  shortcutChipClearText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#be123c",
  },
});
