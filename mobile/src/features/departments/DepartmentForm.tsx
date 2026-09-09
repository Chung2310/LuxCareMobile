import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import type { DepartmentRecord } from "../../../../src/services/departmentService";
import type { UserProfile } from "../../../../src/types/common";
import { departments } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";

const AVATAR_COLORS = [
  { bg: "#dbeafe", text: "#1d4ed8" },
  { bg: "#dcfce7", text: "#15803d" },
  { bg: "#fef3c7", text: "#b45309" },
  { bg: "#f3e8ff", text: "#7e22ce" },
  { bg: "#ffe4e6", text: "#be123c" },
  { bg: "#ccfbf1", text: "#0f766e" },
];

function getAvatarColors(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

export function DepartmentForm({
  editing,
  people,
  peopleLoading = false,
  peopleError = null,
  onRetryPeople,
  onClose,
  onSaved,
  onDelete,
  canManage,
}: {
  editing: DepartmentRecord | "new";
  people: UserProfile[];
  peopleLoading?: boolean;
  peopleError?: string | null;
  onRetryPeople?: () => void;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (id: string) => void;
  canManage: boolean;
}) {
  const isNew = editing === "new";
  const [code, setCode] = useState(isNew ? "" : editing.code);
  const [name, setName] = useState(isNew ? "" : editing.name);
  const [description, setDescription] = useState(isNew ? "" : editing.description || "");
  const [active, setActive] = useState(isNew ? true : editing.isActive);
  const [manager, setManager] = useState(isNew ? "" : editing.managerUid || "");
  const [sortOrder, setSortOrder] = useState(String(isNew ? 0 : editing.sortOrder));

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [managerSearch, setManagerSearch] = useState("");

  // Selected manager display
  const selectedPerson = people.find((item) => item.uid === manager);
  const managerDisplayName = selectedPerson
    ? selectedPerson.displayName || selectedPerson.email
    : !isNew && editing.managerUid && editing.managerUid === manager
    ? editing.managerName || "Người phụ trách hiện tại"
    : "Chưa phân công";

  const handleStepper = (delta: number) => {
    const current = Number(sortOrder) || 0;
    const next = Math.max(0, current + delta);
    setSortOrder(String(next));
  };

  const save = async () => {
    if (busy || !name.trim() || !code.trim()) return;
    setBusy(true);
    setFormError(null);
    try {
      const order = Number(sortOrder);
      if (!Number.isSafeInteger(order)) throw new Error("Thứ tự hiển thị phải là số nguyên.");

      const input = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        isActive: active,
        sortOrder: order,
      };

      if (isNew || manager !== (editing.managerUid || "")) {
        const person = people.find((item) => item.uid === manager);
        if (manager && !person && (!editing || editing === "new" || editing.managerUid !== manager)) {
          throw new Error("Vui lòng chọn người phụ trách trong danh sách.");
        }
        Object.assign(input, {
          managerUid: manager,
          managerName: person?.displayName || (manager ? managerDisplayName : ""),
        });
      }

      if (isNew) {
        await departments.create(input);
      } else {
        await departments.update(editing._id, input);
      }
      onSaved();
    } catch (err) {
      setFormError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteConfirm = () => {
    if (isNew || !onDelete) return;
    Alert.alert(
      "Xác nhận xóa phòng ban?",
      `Bạn có chắc chắn muốn xóa phòng ban "${editing.name}"? Các nhân sự đang thuộc phòng ban này sẽ cần được phân bổ lại.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa vĩnh viễn",
          style: "destructive",
          onPress: () => onDelete(editing._id),
        },
      ],
    );
  };

  const filteredPeople = people.filter((p) => {
    const q = managerSearch.trim().toLowerCase();
    if (!q) return true;
    const nameStr = (p.displayName || "").toLowerCase();
    const emailStr = (p.email || "").toLowerCase();
    const deptStr = (p.department || "").toLowerCase();
    return nameStr.includes(q) || emailStr.includes(q) || deptStr.includes(q);
  });

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            onPress={onClose}
            disabled={busy}
          >
            <Text style={styles.backBtnText}>✕</Text>
          </Pressable>

          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerTitle}>
              {isNew ? "Thêm phòng ban mới" : "Chỉnh sửa phòng ban"}
            </Text>
            <Text style={styles.headerSub}>
              {isNew ? "Tạo mã và phân công người phụ trách" : editing.name}
            </Text>
          </View>

          {canManage ? (
            <Pressable
              style={({ pressed }) => [
                styles.saveHeaderBtn,
                (busy || !code.trim() || !name.trim()) && styles.saveHeaderBtnDisabled,
                pressed && { opacity: 0.8 },
              ]}
              disabled={busy || !code.trim() || !name.trim()}
              onPress={() => void save()}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveHeaderBtnText}>Lưu</Text>
              )}
            </Pressable>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {/* Body Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {!!formError && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {formError}</Text>
            </View>
          )}

          {/* Section 1: Thông tin cơ bản */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionIcon}>🏢</Text>
              <Text style={styles.sectionTitle}>Thông tin phòng ban</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mã phòng ban *</Text>
              <TextInput
                style={[styles.input, { textTransform: "uppercase", fontWeight: "700" }]}
                value={code}
                editable={!busy && canManage}
                placeholder="VD: HR, IT, SALES, ACC"
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                onChangeText={(text) => setCode(text.toUpperCase())}
              />
              <Text style={styles.fieldHint}>
                Mã viết tắt viết hoa đại diện cho phòng ban (thường từ 2 đến 6 ký tự).
              </Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tên phòng ban *</Text>
              <TextInput
                style={styles.input}
                value={name}
                editable={!busy && canManage}
                placeholder="VD: Phòng Hành chính - Nhân sự"
                placeholderTextColor="#94a3b8"
                onChangeText={setName}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Thứ tự hiển thị</Text>
              <View style={styles.stepperRow}>
                <Pressable
                  style={styles.stepperBtn}
                  disabled={busy || !canManage}
                  onPress={() => handleStepper(-1)}
                >
                  <Text style={styles.stepperBtnText}>−</Text>
                </Pressable>
                <TextInput
                  style={[styles.input, styles.stepperInput]}
                  value={sortOrder}
                  editable={!busy && canManage}
                  keyboardType="number-pad"
                  onChangeText={setSortOrder}
                />
                <Pressable
                  style={styles.stepperBtn}
                  disabled={busy || !canManage}
                  onPress={() => handleStepper(1)}
                >
                  <Text style={styles.stepperBtnText}>+</Text>
                </Pressable>
              </View>
              <Text style={styles.fieldHint}>
                Số thứ tự nhỏ hơn sẽ hiển thị trước trên sơ đồ tổ chức.
              </Text>
            </View>
          </View>

          {/* Section 2: Người phụ trách */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionIcon}>👤</Text>
              <Text style={styles.sectionTitle}>Trưởng bộ phận / Người phụ trách</Text>
            </View>

            {peopleError ? (
              <View style={styles.errorBannerSmall}>
                <Text style={styles.errorBannerTextSmall}>⚠️ {peopleError}</Text>
                {onRetryPeople && (
                  <Pressable style={styles.retryBtn} onPress={onRetryPeople}>
                    <Text style={styles.retryBtnText}>Tải lại danh sách</Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.managerSelectBox,
                canManage && pressed && { opacity: 0.85 },
              ]}
              disabled={busy || !canManage}
              onPress={() => setManagerModalOpen(true)}
            >
              <View style={styles.managerAvatar}>
                <Text style={styles.managerAvatarText}>
                  {manager ? managerDisplayName.charAt(0).toUpperCase() : "?"}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.managerName}>{managerDisplayName}</Text>
                <Text style={styles.managerSub}>
                  {selectedPerson?.email || selectedPerson?.jobTitle || "Chạm để chọn người phụ trách"}
                </Text>
              </View>

              {canManage && (
                <View style={styles.changeBadge}>
                  <Text style={styles.changeBadgeText}>Chọn ›</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Section 3: Trạng thái & Mô tả */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionIcon}>⚙️</Text>
              <Text style={styles.sectionTitle}>Trạng thái & Mô tả</Text>
            </View>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchLabel}>Hoạt động</Text>
                <Text style={styles.switchSub}>
                  {active
                    ? "Phòng ban đang hoạt động và có thể gán nhân sự"
                    : "Tạm ngừng hoạt động (ẩn khỏi danh sách lựa chọn mới)"}
                </Text>
              </View>

              <Switch
                value={active}
                onValueChange={setActive}
                disabled={busy || !canManage}
                trackColor={{ false: "#cbd5e1", true: "#a7f3d0" }}
                thumbColor={active ? "#059669" : "#f1f5f9"}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mô tả chức năng nhiệm vụ</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                multiline
                numberOfLines={3}
                editable={!busy && canManage}
                placeholder="Mô tả chức năng, phạm vi phụ trách của phòng ban..."
                placeholderTextColor="#94a3b8"
                onChangeText={setDescription}
              />
            </View>
          </View>

          {/* Bottom Actions */}
          {canManage && (
            <View style={styles.bottomActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.submitBtn,
                  (busy || !code.trim() || !name.trim()) && styles.submitBtnDisabled,
                  pressed && { opacity: 0.88 },
                ]}
                disabled={busy || !code.trim() || !name.trim()}
                onPress={() => void save()}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitBtnText}>
                    {isNew ? "Thêm phòng ban" : "Lưu thay đổi"}
                  </Text>
                )}
              </Pressable>

              {!isNew && onDelete && (
                <Pressable
                  style={styles.deleteBtn}
                  disabled={busy}
                  onPress={handleDeleteConfirm}
                >
                  <Text style={styles.deleteBtnText}>🗑️ Xóa phòng ban này</Text>
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Colleague Select Modal */}
      <Modal
        visible={managerModalOpen}
        animationType="slide"
        onRequestClose={() => setManagerModalOpen(false)}
      >
        <SafeAreaView edges={["top", "bottom"]} style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chọn người phụ trách</Text>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => setManagerModalOpen(false)}
            >
              <Text style={styles.modalCloseBtnText}>✕</Text>
            </Pressable>
          </View>

          {/* Search Box */}
          <View style={styles.modalSearchBox}>
            <Text style={styles.modalSearchIcon}>🔍</Text>
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Tìm theo tên, email, chức danh..."
              placeholderTextColor="#94a3b8"
              value={managerSearch}
              onChangeText={setManagerSearch}
            />
            {managerSearch.length > 0 && (
              <Pressable onPress={() => setManagerSearch("")} style={{ padding: 4 }}>
                <Text style={{ fontSize: 13, color: "#94a3b8" }}>✕</Text>
              </Pressable>
            )}
          </View>

          {/* List of Colleagues */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: 16, gap: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {/* Option: None / Unassigned */}
            <Pressable
              style={[
                styles.colleagueItem,
                !manager && styles.colleagueItemSelected,
              ]}
              onPress={() => {
                setManager("");
                setManagerModalOpen(false);
              }}
            >
              <View style={[styles.colleagueAvatar, { backgroundColor: "#e2e8f0" }]}>
                <Text style={[styles.colleagueAvatarText, { color: "#64748b" }]}>✕</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.colleagueName}>Chưa phân công</Text>
                <Text style={styles.colleagueSub}>Để trống người phụ trách</Text>
              </View>
              {!manager && <Text style={styles.checkIcon}>✓</Text>}
            </Pressable>

            {/* Current manager fallback if not in list */}
            {!isNew &&
              editing.managerUid &&
              !people.some((p) => p.uid === editing.managerUid) && (
                <Pressable
                  style={[
                    styles.colleagueItem,
                    manager === editing.managerUid && styles.colleagueItemSelected,
                  ]}
                  onPress={() => {
                    setManager(editing.managerUid!);
                    setManagerModalOpen(false);
                  }}
                >
                  <View style={[styles.colleagueAvatar, { backgroundColor: "#dbeafe" }]}>
                    <Text style={[styles.colleagueAvatarText, { color: "#1d4ed8" }]}>👤</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.colleagueName}>
                      {editing.managerName || "Người phụ trách hiện tại"}
                    </Text>
                    <Text style={styles.colleagueSub}>Đang lưu trong hệ thống</Text>
                  </View>
                  {manager === editing.managerUid && <Text style={styles.checkIcon}>✓</Text>}
                </Pressable>
              )}

            {filteredPeople.map((person) => {
              const isSelected = manager === person.uid;
              const palette = getAvatarColors(person.displayName || person.email);

              return (
                <Pressable
                  key={person.uid}
                  style={[styles.colleagueItem, isSelected && styles.colleagueItemSelected]}
                  onPress={() => {
                    setManager(person.uid);
                    setManagerModalOpen(false);
                  }}
                >
                  <View
                    style={[
                      styles.colleagueAvatar,
                      { backgroundColor: palette.bg },
                    ]}
                  >
                    <Text style={[styles.colleagueAvatarText, { color: palette.text }]}>
                      {(person.displayName || person.email).charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.colleagueName}>
                      {person.displayName || person.email}
                    </Text>
                    <Text style={styles.colleagueSub}>
                      {person.jobTitle || person.department || person.email}
                    </Text>
                  </View>

                  {isSelected && <Text style={styles.checkIcon}>✓</Text>}
                </Pressable>
              );
            })}

            {filteredPeople.length === 0 && (
              <View style={styles.emptyColleaguesBox}>
                <Text style={styles.emptyColleaguesText}>
                  Không tìm thấy nhân sự phù hợp với từ khóa.
                </Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  backBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  saveHeaderBtn: {
    backgroundColor: "#059669",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  saveHeaderBtnDisabled: {
    opacity: 0.5,
  },
  saveHeaderBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  errorBanner: {
    backgroundColor: "#fff1f2",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorBannerText: {
    color: "#e11d48",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingBottom: 10,
  },
  sectionIcon: {
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  fieldHint: {
    fontSize: 11,
    color: "#64748b",
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#334155",
  },
  stepperInput: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
  },
  errorBannerSmall: {
    backgroundColor: "#fff1f2",
    borderRadius: 10,
    padding: 8,
    gap: 6,
  },
  errorBannerTextSmall: {
    color: "#e11d48",
    fontSize: 12,
  },
  retryBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#e11d48",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  retryBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  managerSelectBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  managerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  managerAvatarText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  managerName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  managerSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  changeBadge: {
    backgroundColor: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  changeBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  switchSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  bottomActions: {
    gap: 10,
    marginTop: 8,
  },
  submitBtn: {
    backgroundColor: "#059669",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  deleteBtn: {
    backgroundColor: "#fee2e2",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  deleteBtnText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "700",
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  modalSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 10,
    height: 42,
  },
  modalSearchIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  modalSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    paddingVertical: 0,
  },
  colleagueItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  colleagueItemSelected: {
    borderColor: "#059669",
    backgroundColor: "#ecfdf5",
  },
  colleagueAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  colleagueAvatarText: {
    fontSize: 15,
    fontWeight: "800",
  },
  colleagueName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  colleagueSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  checkIcon: {
    fontSize: 16,
    fontWeight: "800",
    color: "#059669",
  },
  emptyColleaguesBox: {
    paddingVertical: 30,
    alignItems: "center",
  },
  emptyColleaguesText: {
    fontSize: 13,
    color: "#94a3b8",
  },
});
