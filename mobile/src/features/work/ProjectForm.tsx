import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Project } from "../../../../src/types/hr";
import type { ProjectInput } from "../../../../src/services/kanbanService";
import { kanban } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { projectDraft, projectPayload, PROJECT_STATUSES, PROJECT_PRIORITIES } from "./project";
import { localDateTime } from "./model";
import { DateTimePickerModal } from "./DateTimePickerModal";

function formatDisplayDate(str: string): string {
  if (!str) return "";
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]} lúc ${match[4]}:${match[5]}`;
  }
  return str;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  not_started: { label: "Chưa bắt đầu", color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" },
  in_progress: { label: "Đang làm", color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd" },
  paused: { label: "Tạm dừng", color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
  completed: { label: "Hoàn thành", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
  cancelled: { label: "Đã hủy", color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  urgent: { label: "Khẩn cấp 🔴", color: "#b91c1c", bg: "#fef2f2", border: "#fca5a5" },
  high: { label: "Cao 🟠", color: "#c2410c", bg: "#fff7ed", border: "#fed7aa" },
  medium: { label: "Trung bình 🔵", color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  low: { label: "Thấp ⚪", color: "#475569", bg: "#f8fafc", border: "#e2e8f0" },
};

function formatNowPlusDays(days: number, hour = 18): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return localDateTime(d.toISOString());
}

export function ProjectForm({
  project,
  onClose,
  onSaved,
  setLocked,
}: {
  project?: Project;
  onClose: () => void;
  onSaved: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => projectDraft(project));
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeDatePicker, setActiveDatePicker] = useState<"startAt" | "dueAt" | null>(null);
  const lock = useRef(false);

  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const input = projectPayload(draft, project);
      try {
        if (project) {
          if (Object.keys(input).length) await kanban.updateProject(project.id, input);
        } else {
          await kanban.createProject(input as ProjectInput);
        }
      } catch (err) {
        if (!(err && typeof err === "object" && "status" in err) || Number((err as any).status) >= 500) {
          setUncertain(true);
          throw new Error(
            "Chưa xác nhận được kết quả lưu. Vui lòng quay lại danh sách để kiểm tra trước khi thao tác tiếp.",
          );
        }
        throw err;
      }
      onSaved();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };

  const disabled = busy || uncertain;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Top Header */}
      <View style={styles.topHeader}>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
          hitSlop={12}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
        <Text style={styles.titleText}>{project ? "Sửa dự án" : "Tạo dự án mới"}</Text>
        <Pressable
          onPress={() => void save()}
          disabled={disabled || !draft.name.trim()}
          style={({ pressed }) => [
            styles.headerSaveBtn,
            (!draft.name.trim() || disabled) && styles.headerSaveBtnDisabled,
            pressed && { opacity: 0.8 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.headerSaveBtnText}>Lưu</Text>
          )}
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Error Banner */}
        {!!error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Section: Thông tin dự án */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>THÔNG TIN DỰ ÁN</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Tên dự án <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="VD: Triển khai chiến dịch chăm sóc khách hàng..."
              placeholderTextColor="#94a3b8"
              value={draft.name}
              editable={!disabled}
              onChangeText={(name) => setDraft((v) => ({ ...v, name }))}
            />
          </View>
        </View>

        {/* Section: Trạng thái */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>TRẠNG THÁI</Text>
          <View style={styles.chipsRow}>
            {PROJECT_STATUSES.filter((item) => !!project || item.value !== "completed").map((st) => {
              const selected = draft.status === st.value;
              const config = STATUS_CONFIG[st.value] || {
                label: st.label,
                color: "#475569",
                bg: "#f1f5f9",
                border: "#cbd5e1",
              };
              return (
                <Pressable
                  key={st.value}
                  disabled={disabled}
                  onPress={() => setDraft((v) => ({ ...v, status: st.value as Project["status"] }))}
                  style={[
                    styles.chip,
                    selected && {
                      backgroundColor: config.bg,
                      borderColor: config.border,
                      borderWidth: 1.5,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && { color: config.color, fontWeight: "700" },
                    ]}
                  >
                    {config.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section: Mức độ ưu tiên */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>MỨC ĐỘ ƯU TIÊN</Text>
          <View style={styles.chipsRow}>
            {PROJECT_PRIORITIES.map((pr) => {
              const selected = draft.priority === pr.value;
              const config = PRIORITY_CONFIG[pr.value] || {
                label: pr.label,
                color: "#475569",
                bg: "#f1f5f9",
                border: "#cbd5e1",
              };
              return (
                <Pressable
                  key={pr.value}
                  disabled={disabled}
                  onPress={() => setDraft((v) => ({ ...v, priority: pr.value as Project["priority"] }))}
                  style={[
                    styles.chip,
                    selected && {
                      backgroundColor: config.bg,
                      borderColor: config.border,
                      borderWidth: 1.5,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selected && { color: config.color, fontWeight: "700" },
                    ]}
                  >
                    {config.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section: Thời gian thực hiện */}
        <View style={styles.card}>
          <Text style={styles.cardSectionTitle}>THỜI GIAN THỰC HIỆN</Text>

          {/* Quick chips for dates */}
          <Text style={styles.quickLabel}>Chọn nhanh thời hạn:</Text>
          <View style={styles.quickRow}>
            <Pressable
              disabled={disabled}
              style={styles.quickPill}
              onPress={() => {
                setDraft((v) => ({
                  ...v,
                  startAt: formatNowPlusDays(0, 8),
                  dueAt: formatNowPlusDays(7, 18),
                }));
              }}
            >
              <Text style={styles.quickPillText}>⚡ 1 tuần</Text>
            </Pressable>
            <Pressable
              disabled={disabled}
              style={styles.quickPill}
              onPress={() => {
                setDraft((v) => ({
                  ...v,
                  startAt: formatNowPlusDays(0, 8),
                  dueAt: formatNowPlusDays(30, 18),
                }));
              }}
            >
              <Text style={styles.quickPillText}>📅 1 tháng</Text>
            </Pressable>
            <Pressable
              disabled={disabled}
              style={styles.quickPill}
              onPress={() => {
                setDraft((v) => ({
                  ...v,
                  startAt: formatNowPlusDays(0, 8),
                  dueAt: formatNowPlusDays(90, 18),
                }));
              }}
            >
              <Text style={styles.quickPillText}>🎯 1 quý</Text>
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Thời gian bắt đầu</Text>
            <Pressable
              onPress={() => setActiveDatePicker("startAt")}
              disabled={disabled}
              style={styles.datePickerTrigger}
            >
              <Text style={styles.datePickerIcon}>📅</Text>
              <Text
                style={[
                  styles.datePickerValue,
                  !draft.startAt && styles.datePickerPlaceholder,
                ]}
                numberOfLines={1}
              >
                {draft.startAt ? formatDisplayDate(draft.startAt) : "Chọn thời gian bắt đầu..."}
              </Text>
              {!!draft.startAt && (
                <Pressable
                  onPress={() => setDraft((v) => ({ ...v, startAt: "" }))}
                  hitSlop={8}
                  style={styles.dateClearBtn}
                >
                  <Text style={styles.dateClearText}>✕</Text>
                </Pressable>
              )}
            </Pressable>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Hạn chót dự án</Text>
            <Pressable
              onPress={() => setActiveDatePicker("dueAt")}
              disabled={disabled}
              style={styles.datePickerTrigger}
            >
              <Text style={styles.datePickerIcon}>📅</Text>
              <Text
                style={[
                  styles.datePickerValue,
                  !draft.dueAt && styles.datePickerPlaceholder,
                ]}
                numberOfLines={1}
              >
                {draft.dueAt ? formatDisplayDate(draft.dueAt) : "Chọn hạn chót hoàn thành..."}
              </Text>
              {!!draft.dueAt && (
                <Pressable
                  onPress={() => setDraft((v) => ({ ...v, dueAt: "" }))}
                  hitSlop={8}
                  style={styles.dateClearBtn}
                >
                  <Text style={styles.dateClearText}>✕</Text>
                </Pressable>
              )}
            </Pressable>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Date Time Picker Modal */}
      <DateTimePickerModal
        visible={activeDatePicker !== null}
        onClose={() => setActiveDatePicker(null)}
        title={activeDatePicker === "startAt" ? "Chọn thời gian bắt đầu" : "Chọn hạn chót dự án"}
        value={activeDatePicker ? draft[activeDatePicker] : ""}
        onChange={(val) => {
          if (activeDatePicker) {
            setDraft((v) => ({ ...v, [activeDatePicker]: val }));
          }
        }}
      />

      {/* Bottom Sticky Actions */}
      <View style={styles.bottomBar}>
        <Pressable
          onPress={onClose}
          disabled={busy}
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.cancelBtnText}>{uncertain ? "Quay lại danh sách" : "Hủy"}</Text>
        </Pressable>

        <Pressable
          onPress={() => void save()}
          disabled={disabled || !draft.name.trim()}
          style={({ pressed }) => [
            styles.submitBtn,
            (!draft.name.trim() || disabled) && styles.submitBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.submitBtnText}>{project ? "Lưu thay đổi" : "Tạo dự án"}</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  topHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#64748b",
  },
  titleText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  headerSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#008852",
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSaveBtnDisabled: {
    backgroundColor: "#cbd5e1",
  },
  headerSaveBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 14,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  errorIcon: {
    fontSize: 18,
  },
  errorText: {
    flex: 1,
    color: "#dc2626",
    fontSize: 13,
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardSectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.6,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  requiredStar: {
    color: "#dc2626",
  },
  textInput: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  chipText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  quickLabel: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  quickPillText: {
    fontSize: 12,
    color: "#047857",
    fontWeight: "600",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#008852",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#008852",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  submitBtnDisabled: {
    backgroundColor: "#cbd5e1",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
  datePickerTrigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  datePickerIcon: {
    fontSize: 16,
  },
  datePickerValue: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  datePickerPlaceholder: {
    fontWeight: "400",
    color: "#94a3b8",
  },
  dateClearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  dateClearText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },
});
