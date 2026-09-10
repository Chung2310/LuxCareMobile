import React, { useState, useMemo } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
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
  clearLabel?: string;
  showYearShortcuts?: boolean;
  baseDateForShortcuts?: string; // YYYY-MM-DD
}

/**
 * Chuyển đổi định dạng ISO (YYYY-MM-DD) sang định dạng ngày Việt Nam (dd/MM/yyyy)
 */
export function formatDateVN(dateStr?: string | null): string {
  if (!dateStr) return "";
  const clean = dateStr.slice(0, 10);
  const parts = clean.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
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
  clearLabel = "Không thời hạn",
  showYearShortcuts = true,
  baseDateForShortcuts,
}: DatePickerModalProps) {
  const initial = useMemo(() => parseDateStr(value), [value]);
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [selectedDate, setSelectedDate] = useState(value);

  const [pickerMode, setPickerMode] = useState<"calendar" | "year" | "month">("calendar");

  // Sync when opening
  React.useEffect(() => {
    if (visible) {
      const p = parseDateStr(value);
      setViewYear(p.year);
      setViewMonth(p.month);
      setSelectedDate(value);
      setPickerMode("calendar");
    }
  }, [visible, value]);

  const yearsList = useMemo(() => {
    const list: number[] = [];
    const currentY = new Date().getFullYear();
    for (let y = currentY + 5; y >= 1940; y--) {
      list.push(y);
    }
    return list;
  }, []);

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
  const calendarCells: { day: number; isCurrentMonth: boolean }[] = [];
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

  // Chia calendarCells thành từng hàng tuần đúng 7 cột (T2 -> CN), tránh lỗi flexWrap bị rớt cột CN
  const calendarWeeks = useMemo(() => {
    const weeks: { day: number; isCurrentMonth: boolean }[][] = [];
    for (let i = 0; i < calendarCells.length; i += 7) {
      weeks.push(calendarCells.slice(i, i + 7));
    }
    return weeks;
  }, [calendarCells]);

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
                  ? `Đang chọn: ${formatDateVN(selectedDate)}`
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
              <Pressable
                onPress={() => setPickerMode((m) => (m === "month" ? "calendar" : "month"))}
                style={[styles.navSelectBtn, pickerMode === "month" && styles.navSelectBtnActive]}
                hitSlop={6}
              >
                <Text style={styles.navMonthText}>{MONTH_NAMES[viewMonth]} ▾</Text>
              </Pressable>
              <View style={styles.yearButtonsRow}>
                <Pressable onPress={() => setViewYear((y) => y - 10)} hitSlop={6} style={styles.yearChangeBtn}>
                  <Text style={styles.yearChangeText}>-10</Text>
                </Pressable>
                <Pressable onPress={() => setViewYear((y) => y - 1)} hitSlop={6} style={styles.yearChangeBtn}>
                  <Text style={styles.yearChangeText}>-1</Text>
                </Pressable>
                <Pressable
                  onPress={() => setPickerMode((m) => (m === "year" ? "calendar" : "year"))}
                  style={[styles.navYearBtn, pickerMode === "year" && styles.navSelectBtnActive]}
                  hitSlop={6}
                >
                  <Text style={styles.navYearText}>{viewYear} ▾</Text>
                </Pressable>
                <Pressable onPress={() => setViewYear((y) => y + 1)} hitSlop={6} style={styles.yearChangeBtn}>
                  <Text style={styles.yearChangeText}>+1</Text>
                </Pressable>
                <Pressable onPress={() => setViewYear((y) => y + 10)} hitSlop={6} style={styles.yearChangeBtn}>
                  <Text style={styles.yearChangeText}>+10</Text>
                </Pressable>
              </View>
            </View>

            <Pressable onPress={handleNextMonth} hitSlop={8} style={styles.navArrowBtn}>
              <Text style={styles.navArrowText}>›</Text>
            </Pressable>
          </View>

          {/* Body: Year picker grid, Month picker grid, or Days calendar */}
          {pickerMode === "year" ? (
            <View style={styles.selectorContainer}>
              <Text style={styles.selectorHeaderHint}>Chọn năm sinh / năm làm việc:</Text>
              <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={true}>
                <View style={styles.selectorGrid}>
                  {yearsList.map((y) => {
                    const isSelected = y === viewYear;
                    return (
                      <Pressable
                        key={y}
                        style={[styles.selectorChip, isSelected && styles.selectorChipActive]}
                        onPress={() => {
                          setViewYear(y);
                          setPickerMode("calendar");
                        }}
                      >
                        <Text style={[styles.selectorChipText, isSelected && styles.selectorChipTextActive]}>
                          {y}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          ) : pickerMode === "month" ? (
            <View style={styles.selectorContainer}>
              <Text style={styles.selectorHeaderHint}>Chọn tháng:</Text>
              <View style={styles.selectorGrid}>
                {MONTH_NAMES.map((mName, mIdx) => {
                  const isSelected = mIdx === viewMonth;
                  return (
                    <Pressable
                      key={mName}
                      style={[styles.selectorChip, styles.selectorChipMonth, isSelected && styles.selectorChipActive]}
                      onPress={() => {
                        setViewMonth(mIdx);
                        setPickerMode("calendar");
                      }}
                    >
                      <Text style={[styles.selectorChipText, isSelected && styles.selectorChipTextActive]}>
                        {mName}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <>
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

              {/* Days Grid - hiển thị theo từng tuần cố định 7 ngày */}
              <View style={styles.daysGrid}>
                {calendarWeeks.map((week, wIdx) => (
                  <View key={`week-${wIdx}`} style={styles.weekRow}>
                    {week.map((cell, dayColIdx) => {
                      const isSunday = dayColIdx === 6;
                      const isSaturday = dayColIdx === 5;

                      if (!cell.isCurrentMonth) {
                        return (
                          <View key={`cell-${dayColIdx}`} style={styles.dayCell}>
                            <Text style={styles.otherMonthText}>{cell.day}</Text>
                          </View>
                        );
                      }

                      const cellDateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(cell.day)}`;
                      const isSelected = selectedDate === cellDateStr;
                      const isToday = todayStr === cellDateStr;

                      return (
                        <Pressable
                          key={`cell-${dayColIdx}`}
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
                              isSunday && !isSelected && { color: "#e11d48", fontWeight: "700" },
                              isSaturday && !isSelected && { color: "#0284c7" },
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
                ))}
              </View>
            </>
          )}

          {/* Quick Shortcuts */}
          <View style={styles.shortcutsRow}>
            <Pressable style={styles.shortcutChip} onPress={handleQuickToday}>
              <Text style={styles.shortcutChipText}>Hôm nay</Text>
            </Pressable>

            {allowClear && (
              <>
                {showYearShortcuts && (
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
                  </>
                )}
                <Pressable style={[styles.shortcutChip, styles.shortcutChipClear]} onPress={handleClear}>
                  <Text style={styles.shortcutChipClearText}>{clearLabel}</Text>
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
  navSelectBtn: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  navSelectBtnActive: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  navYearBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#ecfdf5",
  },
  selectorContainer: {
    paddingVertical: 4,
  },
  selectorHeaderHint: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 8,
  },
  selectorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  selectorChip: {
    width: "22%",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  selectorChipMonth: {
    width: "31%",
    paddingVertical: 12,
  },
  selectorChipActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  selectorChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  selectorChipTextActive: {
    color: "#ffffff",
    fontWeight: "800",
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
    gap: 4,
  },
  weekRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  dayCell: {
    flex: 1,
    height: 38,
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
