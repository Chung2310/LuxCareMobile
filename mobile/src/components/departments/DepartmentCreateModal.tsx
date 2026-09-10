import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppButton } from "../common";
import type { DepartmentInput } from "./types";
import type { UserProfile } from "../../../../src/types/common";

interface DepartmentCreateModalProps {
  visible: boolean;
  colleagues: UserProfile[];
  onClose: () => void;
  onCreate: (input: DepartmentInput) => Promise<void>;
}

export const DepartmentCreateModal: React.FC<DepartmentCreateModalProps> = ({
  visible,
  colleagues,
  onClose,
  onCreate,
}) => {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [managerUid, setManagerUid] = useState("");
  const [managerName, setManagerName] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [showManagerPicker, setShowManagerPicker] = useState(false);
  const [managerSearchQuery, setManagerSearchQuery] = useState("");

  const resetForm = () => {
    setCode("");
    setName("");
    setDescription("");
    setManagerUid("");
    setManagerName("");
    setSortOrder(0);
    setIsActive(true);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleCreate = async () => {
    if (!code.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập mã phòng ban (VD: KHTH, GMHS).");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên phòng ban.");
      return;
    }

    setSaving(true);
    try {
      await onCreate({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        description: description.trim(),
        managerUid: managerUid || undefined,
        managerName: managerName || undefined,
        sortOrder,
        isActive,
      });
      handleClose();
    } catch (err: any) {
      Alert.alert("Lỗi tạo phòng ban", err.message || "Không thể tạo phòng ban mới.");
    } finally {
      setSaving(false);
    }
  };

  const filteredColleagues = colleagues.filter((c) => {
    const q = managerSearchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (c.displayName || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").toLowerCase().includes(q)
    );
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
        {/* Header Bar */}
        <View style={styles.headerBar}>
          <View style={styles.headerLeft}>
            <View style={styles.iconBox}>
              <Ionicons name="add-circle" size={20} color="#059669" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Thêm phòng ban mới</Text>
              <Text style={styles.headerSubtitle}>Mở rộng cơ cấu tổ chức doanh nghiệp</Text>
            </View>
          </View>

          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formSection}>
            {/* Mã phòng ban */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Mã phòng ban <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={(val) => setCode(val.toUpperCase())}
                placeholder="VD: KHTH, GMHS, TCKT..."
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
              />
              <Text style={styles.fieldHint}>
                Mã viết hoa, ngắn gọn và không trùng lặp trong hệ thống.
              </Text>
            </View>

            {/* Tên phòng ban */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Tên phòng ban <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="VD: Khoa Khám bệnh, Phòng Kế hoạch..."
                placeholderTextColor="#94a3b8"
              />
            </View>

            {/* Mô tả chức năng */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mô tả & chức năng nhiệm vụ</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Nhiệm vụ chuyên môn hoặc chức năng chính..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Trưởng bộ phận */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Trưởng bộ phận phụ trách</Text>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowManagerPicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.pickerButtonLeft}>
                  <Ionicons
                    name="person-circle-outline"
                    size={20}
                    color={managerUid ? "#059669" : "#94a3b8"}
                  />
                  <Text
                    style={[
                      styles.pickerButtonText,
                      !managerUid && styles.pickerButtonPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {managerName || "Chọn người phụ trách từ danh sách nhân sự"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
              </TouchableOpacity>
              {Boolean(managerUid) && (
                <TouchableOpacity
                  style={styles.clearManagerBtn}
                  onPress={() => {
                    setManagerUid("");
                    setManagerName("");
                  }}
                >
                  <Ionicons name="close-circle-outline" size={14} color="#dc2626" />
                  <Text style={styles.clearManagerText}>Bỏ chọn người phụ trách</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Thứ tự sắp xếp */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Thứ tự hiển thị trên danh mục</Text>
              <View style={styles.stepperRow}>
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setSortOrder((v) => Math.max(0, v - 1))}
                  disabled={sortOrder <= 0}
                >
                  <Ionicons name="remove" size={18} color="#0f172a" />
                </TouchableOpacity>
                <TextInput
                  style={styles.stepperInput}
                  value={String(sortOrder)}
                  onChangeText={(val) => {
                    const num = parseInt(val, 10);
                    setSortOrder(isNaN(num) ? 0 : num);
                  }}
                  keyboardType="numeric"
                />
                <TouchableOpacity
                  style={styles.stepperBtn}
                  onPress={() => setSortOrder((v) => v + 1)}
                >
                  <Ionicons name="add" size={18} color="#0f172a" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Trạng thái ban đầu */}
            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchTitle}>Kích hoạt hoạt động ngay</Text>
                <Text style={styles.switchSubtitle}>
                  Phòng ban sẽ có sẵn ngay trên hệ thống để phân bổ nhân sự
                </Text>
              </View>
              <Switch
                value={isActive}
                onValueChange={setIsActive}
                trackColor={{ false: "#cbd5e1", true: "#a7f3d0" }}
                thumbColor={isActive ? "#059669" : "#f1f5f9"}
              />
            </View>
          </View>

          {/* Footer Submit */}
          <View style={styles.footerActions}>
            <AppButton
              title="Tạo mới phòng ban"
              variant="primary"
              onPress={handleCreate}
              loading={saving}
              icon="checkmark-circle-outline"
            />
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* MODAL CHỌN TRƯỞNG BỘ PHẬN */}
        <Modal
          visible={showManagerPicker}
          animationType="slide"
          transparent
          onRequestClose={() => setShowManagerPicker(false)}
        >
          <View style={styles.pickerModalOverlay}>
            <View style={styles.pickerModalBox}>
              <View style={styles.pickerModalHeader}>
                <Text style={styles.pickerModalTitle}>Chọn Trưởng bộ phận</Text>
                <TouchableOpacity
                  onPress={() => setShowManagerPicker(false)}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={22} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.pickerSearchRow}>
                <Ionicons name="search" size={16} color="#94a3b8" />
                <TextInput
                  style={styles.pickerSearchInput}
                  placeholder="Tìm theo tên, email, sđt..."
                  placeholderTextColor="#94a3b8"
                  value={managerSearchQuery}
                  onChangeText={setManagerSearchQuery}
                />
                {managerSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setManagerSearchQuery("")}>
                    <Ionicons name="close-circle" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView style={styles.colleagueList}>
                {filteredColleagues.map((c) => {
                  const isSelected = c.uid === managerUid;
                  return (
                    <TouchableOpacity
                      key={c.uid}
                      style={[
                        styles.colleagueItem,
                        isSelected && styles.colleagueItemSelected,
                      ]}
                      onPress={() => {
                        setManagerUid(c.uid);
                        setManagerName(c.displayName || c.email || "Nhân sự");
                        setShowManagerPicker(false);
                      }}
                    >
                      <View style={styles.colleagueAvatar}>
                        <Text style={styles.colleagueAvatarText}>
                          {(c.displayName || c.email || "LC").slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.colleagueInfo}>
                        <Text style={styles.colleagueName}>
                          {c.displayName || "Chưa đặt tên"}
                        </Text>
                        <Text style={styles.colleagueMeta}>
                          {c.email || c.phone || "Không có thông tin liên hệ"}
                        </Text>
                      </View>
                      {isSelected && (
                        <Ionicons name="checkmark-circle" size={18} color="#059669" />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {filteredColleagues.length === 0 && (
                  <View style={styles.emptyColleague}>
                    <Text style={styles.emptyColleagueText}>
                      Không tìm thấy nhân sự phù hợp
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 11,
    color: "#64748b",
  },
  closeBtn: {
    padding: 6,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  formSection: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginBottom: 16,
  },
  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  requiredStar: {
    color: "#dc2626",
  },
  fieldHint: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 4,
    lineHeight: 15,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: "#0f172a",
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerButtonLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  pickerButtonText: {
    fontSize: 13,
    color: "#0f172a",
    fontWeight: "500",
  },
  pickerButtonPlaceholder: {
    color: "#94a3b8",
    fontWeight: "400",
  },
  clearManagerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  clearManagerText: {
    fontSize: 11.5,
    color: "#dc2626",
    fontWeight: "500",
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperInput: {
    width: 60,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  switchTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  switchSubtitle: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  footerActions: {
    marginTop: 8,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  pickerModalBox: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
    paddingBottom: 24,
  },
  pickerModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  pickerModalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  pickerSearchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 38,
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
  },
  colleagueList: {
    paddingHorizontal: 16,
  },
  colleagueItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  colleagueItemSelected: {
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    paddingHorizontal: 8,
  },
  colleagueAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  colleagueAvatarText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  colleagueInfo: {
    flex: 1,
  },
  colleagueName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  colleagueMeta: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  emptyColleague: {
    alignItems: "center",
    paddingVertical: 24,
  },
  emptyColleagueText: {
    fontSize: 12.5,
    color: "#94a3b8",
  },
});
