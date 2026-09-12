import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

export interface DateTimePickerModalProps {
  visible: boolean;
  onClose: () => void;
  value: string; // "YYYY-MM-DD HH:mm" or ""
  onChange: (val: string) => void;
  title?: string;
  allowClear?: boolean;
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

const COMMON_HOURS = [
  { label: "08:00", h: 8, m: 0 },
  { label: "09:00", h: 9, m: 0 },
  { label: "12:00", h: 12, m: 0 },
  { label: "14:00", h: 14, m: 0 },
  { label: "17:00", h: 17, m: 0 },
  { label: "18:00", h: 18, m: 0 },
  { label: "20:00", h: 20, m: 0 },
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function parseDateTimeStr(str: string) {
  const match = str?.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/);
  if (match) {
    const y = parseInt(match[1], 10);
    const m = parseInt(match[2], 10) - 1;
    const d = parseInt(match[3], 10);
    const hour = match[4] ? parseInt(match[4], 10) : 18;
    const minute = match[5] ? parseInt(match[5], 10) : 0;
    return { year: y, month: m, day: d, hour, minute };
  }
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth(),
    day: now.getDate(),
    hour: 18,
    minute: 0,
  };
}

export function DateTimePickerModal({
  visible,
  onClose,
  value,
  onChange,
  title = "Chọn thời gian",
  allowClear = true,
}: DateTimePickerModalProps) {
  const initial = useMemo(() => parseDateTimeStr(value), [value]);
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [selectedDay, setSelectedDay] = useState(initial.day);
  const [selectedHour, setSelectedHour] = useState(initial.hour);
  const [selectedMinute, setSelectedMinute] = useState(initial.minute);

  useEffect(() => {
    if (visible) {
      const p = parseDateTimeStr(value);
      setViewYear(p.year);
      setViewMonth(p.month);
      setSelectedDay(p.day);
      setSelectedHour(p.hour);
      setSelectedMinute(p.minute);
    }
  }, [visible, value]);

  const daysInMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  const startDayOfWeek = useMemo(() => {
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

  const handleConfirm = () => {
    const formatted = `${viewYear}-${pad(viewMonth + 1)}-${pad(selectedDay)} ${pad(selectedHour)}:${pad(selectedMinute)}`;
    onChange(formatted);
    onClose();
  };

  const handleClear = () => {
    onChange("");
    onClose();
  };

  const handleQuickPreset = (dayOffset: number, h = 18, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDay(d.getDate());
    setSelectedHour(h);
    setSelectedMinute(m);
    const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(h)}:${pad(m)}`;
    onChange(formatted);
    onClose();
  };

  // Calendar cells
  const calendarCells: { day: number; isCurrentMonth: boolean }[] = [];
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    calendarCells.push({ day: prevMonthDays - i, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push({ day: d, isCurrentMonth: true });
  }
  const totalCells = Math.ceil(calendarCells.length / 7) * 7;
  let nextD = 1;
  while (calendarCells.length < totalCells) {
    calendarCells.push({ day: nextD++, isCurrentMonth: false });
  }

  // Chia calendarCells thành từng hàng tuần đúng 7 cột (T2 -> CN)
  const calendarWeeks = useMemo(() => {
    const weeks: { day: number; isCurrentMonth: boolean }[][] = [];
    for (let i = 0; i < calendarCells.length; i += 7) {
      weeks.push(calendarCells.slice(i, i + 7));
    }
    return weeks;
  }, [calendarCells]);

  const today = new Date();
  const isViewingCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();

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
            <View style={{ flex: 1 }}>
              <Text style={styles.dialogTitle}>{title}</Text>
              <Text style={styles.dialogSubtitle}>
                {`${pad(selectedDay)}/${pad(viewMonth + 1)}/${viewYear} lúc ${pad(selectedHour)}:${pad(selectedMinute)}`}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={18} color="#64748b" />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: 420 }}
            contentContainerStyle={{ paddingBottom: 6 }}
          >
            {/* Quick Presets */}
            <View style={styles.quickPresetsRow}>
              <Pressable
                style={styles.quickPill}
                onPress={() => handleQuickPreset(0, 18, 0)}
              >
                <Text style={styles.quickPillText}>Hôm nay 18h</Text>
              </Pressable>
              <Pressable
                style={styles.quickPill}
                onPress={() => handleQuickPreset(1, 18, 0)}
              >
                <Text style={styles.quickPillText}>Ngày mai</Text>
              </Pressable>
              <Pressable
                style={styles.quickPill}
                onPress={() => handleQuickPreset(3, 18, 0)}
              >
                <Text style={styles.quickPillText}>+3 ngày</Text>
              </Pressable>
              <Pressable
                style={styles.quickPill}
                onPress={() => handleQuickPreset(7, 18, 0)}
              >
                <Text style={styles.quickPillText}>+1 tuần</Text>
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
                  <Pressable
                    onPress={() => setViewYear((y) => y - 1)}
                    hitSlop={6}
                    style={styles.yearChangeBtn}
                  >
                    <Text style={styles.yearChangeText}>-1</Text>
                  </Pressable>
                  <Text style={styles.navYearText}>{viewYear}</Text>
                  <Pressable
                    onPress={() => setViewYear((y) => y + 1)}
                    hitSlop={6}
                    style={styles.yearChangeBtn}
                  >
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
                      idx === 6 && { color: "#e11d48" },
                      idx === 5 && { color: "#0284c7" },
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

                    const isSelected = selectedDay === cell.day;
                    const isToday = isViewingCurrentMonth && today.getDate() === cell.day;

                    return (
                      <Pressable
                        key={`cell-${dayColIdx}`}
                        style={[
                          styles.dayCell,
                          isSelected && styles.dayCellSelected,
                          isToday && !isSelected && styles.dayCellToday,
                        ]}
                        onPress={() => setSelectedDay(cell.day)}
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

            {/* Time Picker Section */}
            <View style={styles.timeSection}>
              <Text style={styles.sectionLabel}>GIỜ & PHÚT</Text>

              {/* Time Steppers */}
              <View style={styles.timeStepperRow}>
                {/* Hour */}
                <View style={styles.stepperBox}>
                  <Text style={styles.stepperLabel}>Giờ</Text>
                  <View style={styles.stepperControls}>
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() => setSelectedHour((h) => (h === 0 ? 23 : h - 1))}
                    >
                      <Text style={styles.stepperBtnText}>-</Text>
                    </Pressable>
                    <Text style={styles.stepperValue}>{pad(selectedHour)}</Text>
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() => setSelectedHour((h) => (h === 23 ? 0 : h + 1))}
                    >
                      <Text style={styles.stepperBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>

                <Text style={styles.timeColon}>:</Text>

                {/* Minute */}
                <View style={styles.stepperBox}>
                  <Text style={styles.stepperLabel}>Phút</Text>
                  <View style={styles.stepperControls}>
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() => setSelectedMinute((m) => (m <= 0 ? 45 : m - 15))}
                    >
                      <Text style={styles.stepperBtnText}>-</Text>
                    </Pressable>
                    <Text style={styles.stepperValue}>{pad(selectedMinute)}</Text>
                    <Pressable
                      style={styles.stepperBtn}
                      onPress={() => setSelectedMinute((m) => (m >= 45 ? 0 : m + 15))}
                    >
                      <Text style={styles.stepperBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Common hour chips */}
              <View style={styles.commonHoursRow}>
                {COMMON_HOURS.map((ch) => {
                  const active = selectedHour === ch.h && selectedMinute === ch.m;
                  return (
                    <Pressable
                      key={ch.label}
                      style={[styles.commonHourPill, active && styles.commonHourPillActive]}
                      onPress={() => {
                        setSelectedHour(ch.h);
                        setSelectedMinute(ch.m);
                      }}
                    >
                      <Text style={[styles.commonHourText, active && styles.commonHourTextActive]}>
                        {ch.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.actionFooter}>
            {allowClear && (
              <Pressable style={styles.clearBtn} onPress={handleClear}>
                <Text style={styles.clearBtnText}>Xóa ngày</Text>
              </Pressable>
            )}

            <Pressable style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Chọn thời gian này</Text>
            </Pressable>
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
    maxHeight: "90%",
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 10,
  },
  dialogTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  dialogSubtitle: {
    fontSize: 13,
    color: "#008852",
    fontWeight: "700",
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
  quickPresetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 10,
  },
  quickPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  quickPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#047857",
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  navArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  navArrowText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    lineHeight: 20,
  },
  navMonthYear: {
    alignItems: "center",
    gap: 1,
  },
  navMonthText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  yearButtonsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  yearChangeBtn: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: "#e2e8f0",
    borderRadius: 4,
  },
  yearChangeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#475569",
  },
  navYearText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#008852",
  },
  weekDaysRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekDayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 2,
  },
  weekDayText: {
    fontSize: 11,
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
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  dayCellSelected: {
    backgroundColor: "#008852",
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: "#008852",
  },
  dayText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  dayTextSelected: {
    color: "#ffffff",
    fontWeight: "800",
  },
  dayTextToday: {
    color: "#008852",
    fontWeight: "800",
  },
  otherMonthText: {
    fontSize: 12,
    color: "#cbd5e1",
  },
  timeSection: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  timeStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stepperBox: {
    alignItems: "center",
    gap: 4,
  },
  stepperLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "600",
  },
  stepperControls: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 4,
    gap: 8,
  },
  stepperBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#334155",
    lineHeight: 18,
  },
  stepperValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    minWidth: 26,
    textAlign: "center",
  },
  timeColon: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 16,
  },
  commonHoursRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  commonHourPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  commonHourPillActive: {
    backgroundColor: "#e0f2fe",
    borderColor: "#7dd3fc",
  },
  commonHourText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  commonHourTextActive: {
    color: "#0369a1",
    fontWeight: "700",
  },
  actionFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#fff1f2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#be123c",
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: "#008852",
    alignItems: "center",
    justifyContent: "center",
  },
  confirmBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
