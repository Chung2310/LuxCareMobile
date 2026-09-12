import { useAppAlert } from "../../components/AppAlert";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { WorkShift } from "../../../../src/services/attendanceService";
import { attendance } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { DAYS, shiftDraft, shiftPayload } from "./model";

const COLOR_PRESETS = [
  "#059669", // Emerald
  "#0284c7", // Sky
  "#4f46e5", // Indigo
  "#7c3aed", // Purple
  "#d97706", // Amber
  "#e11d48", // Rose
  "#0f172a", // Slate
];

const TIME_PRESETS_START = ["07:30", "08:00", "08:30", "09:00", "13:00", "22:00"];
const TIME_PRESETS_END = ["16:30", "17:00", "17:30", "18:00", "22:00", "06:00"];

export function ShiftForm({
  shift,
  onClose,
  onSuccess,
  setLocked,
}: {
  shift?: WorkShift;
  onClose: () => void;
  onSuccess?: () => void;
  setLocked: (value: boolean) => void;
}) {
  const { showAlert, alertView } = useAppAlert();
  const isEditing = !!shift;
  const [draft, setDraft] = useState(() => shiftDraft(shift));
  const [standard, setStandard] = useState(() =>
    shift?.standardMinutes === undefined ? "" : String(shift.standardMinutes),
  );
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  // New break draft states
  const [breakName, setBreakName] = useState("Nghỉ trưa");
  const [breakStart, setBreakStart] = useState("12:00");
  const [breakEnd, setBreakEnd] = useState("13:00");
  const [breakPaid, setBreakPaid] = useState(false);
  const [showAddBreak, setShowAddBreak] = useState(false);

  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const input = shiftPayload({
        ...draft,
        standardMinutes: standard.trim() ? Number(standard) : undefined,
      });
      try {
        if (shift) await attendance.updateShift(shift._id, input);
        else await attendance.createShift(input);
      } catch (err) {
        if (!(err && typeof err === "object" && "status" in err) || Number(err.status) >= 500) {
          setUncertain(true);
          throw new Error(
            "Chưa xác nhận kết quả lưu. Đóng và tải lại danh sách trước khi thao tác tiếp.",
          );
        }
        throw err;
      }
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };

  const addBreakPeriod = () => {
    if (!breakName.trim() || !breakStart.trim() || !breakEnd.trim()) {
      showAlert("Thông báo", "Vui lòng nhập đầy đủ tên và giờ bắt đầu, kết thúc giờ nghỉ.", undefined, "info");
      return;
    }
    setDraft((cur) => ({
      ...cur,
      breakPeriods: [
        ...(cur.breakPeriods || []),
        {
          name: breakName.trim(),
          startTime: breakStart.trim(),
          endTime: breakEnd.trim(),
          paid: breakPaid,
        },
      ],
    }));
    setBreakName("Nghỉ giữa ca");
    setShowAddBreak(false);
  };

  const removeBreakPeriod = (index: number) => {
    setDraft((cur) => ({
      ...cur,
      breakPeriods: (cur.breakPeriods || []).filter((_, i) => i !== index),
    }));
  };

  const toggleDay = (dayVal: number) => {
    setDraft((cur) => {
      const exists = cur.workingDays.includes(dayVal);
      return {
        ...cur,
        workingDays: exists
          ? cur.workingDays.filter((v) => v !== dayVal)
          : [...cur.workingDays, dayVal],
      };
    });
  };

  const selectWeekdays = () => {
    setDraft((cur) => ({ ...cur, workingDays: [1, 2, 3, 4, 5] }));
  };

  const selectAllDays = () => {
    setDraft((cur) => ({ ...cur, workingDays: [1, 2, 3, 4, 5, 6, 0] }));
  };

  const isCrossMidnight = draft.startTime > draft.endTime;

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Top Header */}
      <View style={s.topBar}>
        <View style={s.dragHandle} />
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>
              {isEditing ? "Chỉnh sửa ca làm việc" : "Tạo ca làm việc mới"}
            </Text>
            <Text style={s.headerSubtitle}>
              Cấu hình khung giờ chấm công và ngày làm việc
            </Text>
          </View>
          <Pressable
            style={({ pressed }) => [s.closeCircle, pressed && s.pressedCircle]}
            onPress={onClose}
            disabled={busy}
          >
            <Ionicons name="close" size={20} color="#475569" />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Section 1: Basic Info */}
        <View style={s.card}>
          <Text style={s.cardTitle}>1. Thông tin chung</Text>

          <View style={s.rowFields}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.label}>
                Mã ca <Text style={{ color: "#e11d48" }}>*</Text>
              </Text>
              <TextInput
                style={s.input}
                placeholder="VD: CA1, HC, DEM"
                placeholderTextColor="#94a3b8"
                value={draft.code}
                onChangeText={(val) =>
                  setDraft((cur) => ({ ...cur, code: val.toUpperCase() }))
                }
                autoCapitalize="characters"
                maxLength={30}
                editable={!busy && !uncertain}
              />
            </View>

            <View style={{ flex: 1.5, gap: 6 }}>
              <Text style={s.label}>
                Tên ca làm <Text style={{ color: "#e11d48" }}>*</Text>
              </Text>
              <TextInput
                style={s.input}
                placeholder="VD: Ca Hành chính, Ca Sáng"
                placeholderTextColor="#94a3b8"
                value={draft.name}
                onChangeText={(val) => setDraft((cur) => ({ ...cur, name: val }))}
                maxLength={100}
                editable={!busy && !uncertain}
              />
            </View>
          </View>

          {/* Color Picker */}
          <View style={{ gap: 6, marginTop: 4 }}>
            <Text style={s.label}>Màu sắc nhận diện trên lịch</Text>
            <View style={s.paletteRow}>
              {COLOR_PRESETS.map((hex) => (
                <Pressable
                  key={hex}
                  style={[
                    s.colorDot,
                    { backgroundColor: hex },
                    draft.color === hex && s.colorDotSelected,
                  ]}
                  onPress={() => setDraft((cur) => ({ ...cur, color: hex }))}
                >
                  {draft.color === hex && (
                    <Ionicons name="checkmark" size={14} color="#ffffff" />
                  )}
                </Pressable>
              ))}
              <TextInput
                style={s.hexInput}
                value={draft.color}
                onChangeText={(val) => setDraft((cur) => ({ ...cur, color: val }))}
                maxLength={7}
                placeholder="#059669"
                placeholderTextColor="#94a3b8"
                editable={!busy && !uncertain}
              />
            </View>
          </View>
        </View>

        {/* Section 2: Working Hours */}
        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitle}>2. Khung giờ làm việc</Text>
            {isCrossMidnight && (
              <View style={s.overnightBadge}>
                <Ionicons name="moon" size={12} color="#7c3aed" />
                <Text style={s.overnightText}>Ca qua đêm (qua 00:00)</Text>
              </View>
            )}
          </View>

          <View style={s.rowFields}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.label}>Giờ bắt đầu (HH:mm)</Text>
              <TextInput
                style={s.input}
                placeholder="08:00"
                placeholderTextColor="#94a3b8"
                value={draft.startTime}
                onChangeText={(val) => setDraft((cur) => ({ ...cur, startTime: val }))}
                maxLength={5}
                editable={!busy && !uncertain}
              />
              {/* Presets */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.timePresetRow}>
                {TIME_PRESETS_START.map((t) => (
                  <Pressable
                    key={t}
                    style={[s.timeChip, draft.startTime === t && s.timeChipActive]}
                    onPress={() => setDraft((cur) => ({ ...cur, startTime: t }))}
                  >
                    <Text style={[s.timeChipText, draft.startTime === t && s.timeChipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.label}>Giờ kết thúc (HH:mm)</Text>
              <TextInput
                style={s.input}
                placeholder="17:00"
                placeholderTextColor="#94a3b8"
                value={draft.endTime}
                onChangeText={(val) => setDraft((cur) => ({ ...cur, endTime: val }))}
                maxLength={5}
                editable={!busy && !uncertain}
              />
              {/* Presets */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.timePresetRow}>
                {TIME_PRESETS_END.map((t) => (
                  <Pressable
                    key={t}
                    style={[s.timeChip, draft.endTime === t && s.timeChipActive]}
                    onPress={() => setDraft((cur) => ({ ...cur, endTime: t }))}
                  >
                    <Text style={[s.timeChipText, draft.endTime === t && s.timeChipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </View>
        </View>

        {/* Section 3: Working Days in Week */}
        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitle}>3. Ngày làm việc trong tuần</Text>
            <View style={{ flexDirection: "row", gap: 6 }}>
              <Pressable style={s.shortcutBtn} onPress={selectWeekdays}>
                <Text style={s.shortcutBtnText}>T2 - T6</Text>
              </Pressable>
              <Pressable style={s.shortcutBtn} onPress={selectAllDays}>
                <Text style={s.shortcutBtnText}>Cả tuần</Text>
              </Pressable>
            </View>
          </View>

          <View style={s.daysRow}>
            {DAYS.map((day) => {
              const active = draft.workingDays.includes(day.value);
              return (
                <Pressable
                  key={day.value}
                  style={[s.dayBtn, active && s.dayBtnActive]}
                  onPress={() => toggleDay(day.value)}
                  disabled={busy || uncertain}
                >
                  <Text style={[s.dayBtnText, active && s.dayBtnTextActive]}>
                    {day.label}
                  </Text>
                  {active && (
                    <Ionicons name="checkmark-circle" size={14} color="#ffffff" />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section 4: Breaks */}
        <View style={s.card}>
          <View style={s.cardHeaderRow}>
            <Text style={s.cardTitle}>
              4. Giờ nghỉ giữa ca ({draft.breakPeriods?.length || 0})
            </Text>
            <Pressable
              style={s.addBreakToggle}
              onPress={() => setShowAddBreak((v) => !v)}
              disabled={busy || uncertain}
            >
              <Ionicons
                name={showAddBreak ? "close" : "add"}
                size={16}
                color="#059669"
              />
              <Text style={s.addBreakToggleText}>
                {showAddBreak ? "Đóng" : "Thêm khoảng nghỉ"}
              </Text>
            </Pressable>
          </View>

          {/* List of existing breaks */}
          {(draft.breakPeriods || []).map((bp, idx) => (
            <View key={`${bp.name}-${idx}`} style={s.breakItem}>
              <View style={s.breakIconBox}>
                <Ionicons name="cafe-outline" size={18} color="#d97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.breakName}>{bp.name}</Text>
                <Text style={s.breakTime}>
                  {bp.startTime} - {bp.endTime} ·{" "}
                  {bp.paid ? "Có hưởng lương" : "Không hưởng lương"}
                </Text>
              </View>
              <Pressable
                onPress={() => removeBreakPeriod(idx)}
                style={s.breakRemoveBtn}
                hitSlop={6}
              >
                <Ionicons name="trash-outline" size={16} color="#e11d48" />
              </Pressable>
            </View>
          ))}

          {/* Inline Add Break Form */}
          {showAddBreak && (
            <View style={s.newBreakBox}>
              <Text style={{ fontSize: 12, fontWeight: "700", color: "#334155" }}>
                Thêm khoảng nghỉ mới
              </Text>
              <TextInput
                style={s.input}
                placeholder="Tên giờ nghỉ (VD: Nghỉ trưa)"
                placeholderTextColor="#94a3b8"
                value={breakName}
                onChangeText={setBreakName}
              />
              <View style={s.rowFields}>
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder="Từ (12:00)"
                  placeholderTextColor="#94a3b8"
                  value={breakStart}
                  onChangeText={setBreakStart}
                />
                <TextInput
                  style={[s.input, { flex: 1 }]}
                  placeholder="Đến (13:00)"
                  placeholderTextColor="#94a3b8"
                  value={breakEnd}
                  onChangeText={setBreakEnd}
                />
              </View>
              <View style={s.switchRow}>
                <Text style={{ fontSize: 13, color: "#475569" }}>Tính lương giờ nghỉ này?</Text>
                <Switch
                  value={breakPaid}
                  onValueChange={setBreakPaid}
                  trackColor={{ false: "#cbd5e1", true: "#a7f3d0" }}
                  thumbColor={breakPaid ? "#059669" : "#f1f5f9"}
                />
              </View>
              <Pressable style={s.addBreakConfirmBtn} onPress={addBreakPeriod}>
                <Text style={s.addBreakConfirmText}>Lưu khoảng nghỉ này</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Section 5: Attendance Rules & Standard Minutes */}
        <View style={s.card}>
          <Text style={s.cardTitle}>5. Quy tắc chấm công & Công chuẩn</Text>

          <View style={s.rowFields}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.label}>Đi muộn cho phép (phút)</Text>
              <TextInput
                style={s.input}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                value={String(draft.allowedLateMinutes)}
                onChangeText={(val) =>
                  setDraft((cur) => ({
                    ...cur,
                    allowedLateMinutes: Number(val) || 0,
                  }))
                }
                keyboardType="number-pad"
                editable={!busy && !uncertain}
              />
            </View>

            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.label}>Về sớm cho phép (phút)</Text>
              <TextInput
                style={s.input}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                value={String(draft.allowedEarlyLeaveMinutes)}
                onChangeText={(val) =>
                  setDraft((cur) => ({
                    ...cur,
                    allowedEarlyLeaveMinutes: Number(val) || 0,
                  }))
                }
                keyboardType="number-pad"
                editable={!busy && !uncertain}
              />
            </View>
          </View>

          <View style={{ gap: 6, marginTop: 6 }}>
            <Text style={s.label}>Công chuẩn (phút)</Text>
            <TextInput
              style={s.input}
              placeholder="Để trống để tự động tính theo giờ ca"
              placeholderTextColor="#94a3b8"
              value={standard}
              onChangeText={setStandard}
              keyboardType="number-pad"
              editable={!busy && !uncertain}
            />
            <Text style={s.hint}>
              Để trống hệ thống sẽ tự động tính số phút làm việc thực tế sau khi trừ các khoảng nghỉ không hưởng lương.
            </Text>
          </View>
        </View>

        {/* Section 6: Status Switches */}
        <View style={s.card}>
          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchTitle}>Ca làm việc mặc định</Text>
              <Text style={s.switchSub}>
                Tự động áp dụng cho nhân viên mới khi chưa được phân ca riêng
              </Text>
            </View>
            <Switch
              value={draft.isDefault}
              onValueChange={(val) => setDraft((cur) => ({ ...cur, isDefault: val }))}
              trackColor={{ false: "#cbd5e1", true: "#a7f3d0" }}
              thumbColor={draft.isDefault ? "#059669" : "#f1f5f9"}
              disabled={busy || uncertain}
            />
          </View>

          <View style={[s.switchRow, { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#f1f5f9" }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.switchTitle}>Kích hoạt sử dụng</Text>
              <Text style={s.switchSub}>
                Cho phép chọn và phân ca này cho nhân sự trong hệ thống
              </Text>
            </View>
            <Switch
              value={draft.isActive}
              onValueChange={(val) => setDraft((cur) => ({ ...cur, isActive: val }))}
              trackColor={{ false: "#cbd5e1", true: "#a7f3d0" }}
              thumbColor={draft.isActive ? "#059669" : "#f1f5f9"}
              disabled={busy || uncertain}
            />
          </View>
        </View>

        {/* Error notice */}
        {!!error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#e11d48" />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Footer */}
      <SafeAreaView edges={["bottom"]} style={s.bottomBar}>
        <View style={s.btnRow}>
          <Pressable style={s.cancelBtn} onPress={onClose} disabled={busy}>
            <Text style={s.cancelBtnText}>{uncertain ? "Quay lại" : "Hủy"}</Text>
          </Pressable>

          <Pressable
            style={[s.saveBtn, busy && s.saveBtnDisabled]}
            onPress={save}
            disabled={busy || uncertain}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-sharp" size={18} color="#ffffff" />
                <Text style={s.saveBtnText}>
                  {isEditing ? "Cập nhật ca" : "Lưu ca làm việc"}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
      {alertView}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  topBar: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#cbd5e1",
    alignSelf: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  closeCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  pressedCircle: {
    backgroundColor: "#e2e8f0",
  },
  content: {
    padding: 16,
    gap: 14,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowFields: {
    flexDirection: "row",
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: "#0f172a",
  },
  paletteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  colorDotSelected: {
    borderWidth: 2,
    borderColor: "#0f172a",
  },
  hexInput: {
    width: 80,
    height: 36,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 12,
    color: "#0f172a",
  },
  overnightBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ddd6fe",
  },
  overnightText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7c3aed",
  },
  timePresetRow: {
    flexDirection: "row",
    gap: 4,
    marginTop: 2,
  },
  timeChip: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#f1f5f9",
  },
  timeChipActive: {
    backgroundColor: "#059669",
  },
  timeChipText: {
    fontSize: 10,
    color: "#475569",
    fontWeight: "500",
  },
  timeChipTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  shortcutBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  shortcutBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#047857",
  },
  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  dayBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 2,
  },
  dayBtnActive: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  dayBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  dayBtnTextActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
  addBreakToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  addBreakToggleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#059669",
  },
  breakItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  breakIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#fffbeb",
    alignItems: "center",
    justifyContent: "center",
  },
  breakName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  breakTime: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  breakRemoveBtn: {
    padding: 6,
  },
  newBreakBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    gap: 8,
    marginTop: 4,
  },
  addBreakConfirmBtn: {
    backgroundColor: "#059669",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  addBreakConfirmText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
  },
  hint: {
    fontSize: 11,
    color: "#94a3b8",
    lineHeight: 16,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  switchSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
    paddingRight: 10,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    fontSize: 12,
    color: "#be123c",
    flex: 1,
  },
  bottomBar: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  saveBtn: {
    flex: 2,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#059669",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveBtnDisabled: {
    backgroundColor: "#94a3b8",
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
});
