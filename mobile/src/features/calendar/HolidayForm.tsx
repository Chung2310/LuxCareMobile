import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import type {
  WorkCalendarDay,
  WorkCalendarDayType,
} from "../../../../src/services/companyWorkCalendarService";
import { workCalendar } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { calendarInput, DAY_TYPES } from "./model";

interface HolidayFormProps {
  holiday?: WorkCalendarDay | null;
  year: number;
  onClose: () => void;
  onSuccess: () => void;
  setLocked?: (locked: boolean) => void;
}

const TYPE_CONFIGS: Record<
  WorkCalendarDayType,
  { label: string; sub: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }
> = {
  holiday: {
    label: "Nghỉ lễ",
    sub: "Nghỉ lễ hưởng nguyên lương",
    icon: "sunny-outline",
    color: "#059669",
    bg: "#ecfdf5",
  },
  substitute_holiday: {
    label: "Nghỉ bù",
    sub: "Nghỉ bù do ngày lễ trùng cuối tuần",
    icon: "repeat-outline",
    color: "#d97706",
    bg: "#fffbeb",
  },
  working_override: {
    label: "Làm bù",
    sub: "Ngày đi làm bù cho kỳ nghỉ lễ",
    icon: "briefcase-outline",
    color: "#4f46e5",
    bg: "#eef2ff",
  },
};

function formatViDate(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return dateStr;
  const days = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];
  return `${days[date.getDay()]}, ngày ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function HolidayForm({
  holiday,
  year,
  onClose,
  onSuccess,
  setLocked,
}: HolidayFormProps) {
  const isEditing = !!holiday;
  const [date, setDate] = useState(holiday ? holiday.date : `${year}-01-01`);
  const [name, setName] = useState(holiday ? holiday.name : "");
  const [dayType, setDayType] = useState<WorkCalendarDayType>(
    holiday ? holiday.dayType : "holiday",
  );
  const [isApplied, setIsApplied] = useState<boolean>(
    holiday ? holiday.isApplied : true,
  );
  const [adminReason, setAdminReason] = useState(
    holiday?.adminReason || "",
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);

  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked?.(true);
    setError(null);
    try {
      await action();
      onSuccess();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked?.(false);
    }
  };

  const save = () =>
    run(async () => {
      const input = calendarInput(date.trim(), name, dayType);
      if (isEditing && holiday) {
        await workCalendar.update(holiday._id, {
          ...input,
          isApplied,
          adminReason: adminReason.trim() || undefined,
        });
      } else {
        await workCalendar.create(input);
      }
    });

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={s.topBar}>
        <View style={s.dragHandle} />
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>
              {isEditing ? "Chỉnh sửa ngày lễ" : "Thêm ngày nghỉ lễ mới"}
            </Text>
            <Text style={s.headerSubtitle}>
              Cấu hình ngày nghỉ lễ & lịch làm bù toàn doanh nghiệp
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
        {/* Date Field */}
        <View style={s.fieldBox}>
          <Text style={s.label}>
            Ngày áp dụng (YYYY-MM-DD) <Text style={{ color: "#e11d48" }}>*</Text>
          </Text>
          <View style={s.inputWrap}>
            <Ionicons name="calendar-outline" size={18} color="#059669" />
            <TextInput
              style={s.input}
              placeholder="VD: 2026-09-02"
              placeholderTextColor="#94a3b8"
              value={date}
              onChangeText={setDate}
              maxLength={10}
              editable={!busy}
            />
          </View>
          {/^\d{4}-\d{2}-\d{2}$/.test(date) && (
            <Text style={s.datePreview}>{formatViDate(date)}</Text>
          )}
        </View>

        {/* Holiday Name */}
        <View style={s.fieldBox}>
          <Text style={s.label}>
            Tên ngày nghỉ lễ <Text style={{ color: "#e11d48" }}>*</Text>
          </Text>
          <View style={s.inputWrap}>
            <Ionicons name="bookmark-outline" size={18} color="#64748b" />
            <TextInput
              style={s.input}
              placeholder="VD: Quốc Khánh 2/9, Tết Nguyên Đán, v.v."
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              maxLength={200}
              editable={!busy}
            />
          </View>
        </View>

        {/* Day Type Selection */}
        <View style={s.fieldBox}>
          <Text style={s.label}>
            Loại ngày <Text style={{ color: "#e11d48" }}>*</Text>
          </Text>
          <View style={s.typeGrid}>
            {(Object.keys(TYPE_CONFIGS) as WorkCalendarDayType[]).map((k) => {
              const cfg = TYPE_CONFIGS[k];
              const isSelected = dayType === k;
              return (
                <Pressable
                  key={k}
                  style={[
                    s.typeCard,
                    isSelected && {
                      backgroundColor: cfg.bg,
                      borderColor: cfg.color,
                      borderWidth: 2,
                    },
                  ]}
                  onPress={() => setDayType(k)}
                  disabled={busy}
                >
                  <View style={[s.typeIconBox, { backgroundColor: cfg.color }]}>
                    <Ionicons name={cfg.icon} size={18} color="#ffffff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        s.typeTitle,
                        isSelected && { color: cfg.color, fontWeight: "700" },
                      ]}
                    >
                      {cfg.label}
                    </Text>
                    <Text style={s.typeSub} numberOfLines={2}>
                      {cfg.sub}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={cfg.color} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Editing options: isApplied & adminReason */}
        {isEditing && (
          <View style={s.editCard}>
            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.switchTitle}>Áp dụng vào lịch làm việc</Text>
                <Text style={s.switchSub}>
                  {isApplied
                    ? "Đang áp dụng: Nhân viên được tính công nghỉ lễ"
                    : "Đã tắt: Ngày này sẽ được tính như ngày làm việc bình thường"}
                </Text>
              </View>
              <Switch
                value={isApplied}
                onValueChange={setIsApplied}
                trackColor={{ false: "#cbd5e1", true: "#a7f3d0" }}
                thumbColor={isApplied ? "#059669" : "#f1f5f9"}
                disabled={busy}
              />
            </View>

            <View style={{ gap: 6, marginTop: 10 }}>
              <Text style={s.label}>Ghi chú / Lý do điều chỉnh</Text>
              <TextInput
                style={s.textArea}
                placeholder="VD: Thay đổi theo thông báo nghỉ lễ mới của Ban Giám Đốc..."
                placeholderTextColor="#94a3b8"
                value={adminReason}
                onChangeText={setAdminReason}
                multiline
                numberOfLines={3}
                editable={!busy}
              />
            </View>
          </View>
        )}

        {/* Error message */}
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
          <Pressable
            style={s.cancelBtn}
            onPress={onClose}
            disabled={busy}
          >
            <Text style={s.cancelBtnText}>Hủy</Text>
          </Pressable>

          <Pressable
            style={[
              s.saveBtn,
              (!name.trim() || !date.trim() || busy) && s.saveBtnDisabled,
            ]}
            onPress={save}
            disabled={!name.trim() || !date.trim() || busy}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark-sharp" size={18} color="#ffffff" />
                <Text style={s.saveBtnText}>
                  {isEditing ? "Cập nhật ngày lễ" : "Thêm ngày lễ"}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </SafeAreaView>
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
    gap: 16,
  },
  fieldBox: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    padding: 0,
  },
  datePreview: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "600",
    paddingLeft: 4,
  },
  typeGrid: {
    gap: 8,
  },
  typeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  typeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  typeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  typeSub: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  editCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  switchSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
    paddingRight: 10,
  },
  textArea: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: "#0f172a",
    minHeight: 65,
    textAlignVertical: "top",
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
