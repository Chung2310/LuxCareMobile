import React, { useEffect, useState } from "react";
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
import {
  ROOM_TYPE_LABELS,
  type RoomInput,
  type RoomRecord,
  type RoomType,
} from "./types";
import type { BranchRecord } from "../../../../src/services/branchService";

interface RoomModalProps {
  visible: boolean;
  editingRoom: RoomRecord | "new" | null;
  branchList: BranchRecord[];
  currentBranchId: string;
  canManage: boolean;
  onClose: () => void;
  onSave: (id: string | null, input: RoomInput) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const ROOM_TYPES: RoomType[] = [
  "clinic",
  "treatment",
  "storage",
  "office",
  "meeting",
  "other",
];

export const RoomModal: React.FC<RoomModalProps> = ({
  visible,
  editingRoom,
  branchList,
  currentBranchId,
  canManage,
  onClose,
  onSave,
  onDelete,
}) => {
  if (!editingRoom) return null;

  const isNew = editingRoom === "new";

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<RoomType>("clinic");
  const [floor, setFloor] = useState("");
  const [description, setDescription] = useState("");
  const [branchId, setBranchId] = useState(currentBranchId);
  const [isActive, setIsActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);

  useEffect(() => {
    if (editingRoom && editingRoom !== "new") {
      setCode(editingRoom.code);
      setName(editingRoom.name);
      setType(editingRoom.type || "clinic");
      setFloor(editingRoom.floor || "");
      setDescription(editingRoom.description || "");
      setBranchId(editingRoom.branchId || currentBranchId);
      setIsActive(editingRoom.isActive);
    } else {
      setCode("");
      setName("");
      setType("clinic");
      setFloor("");
      setDescription("");
      setBranchId(currentBranchId);
      setIsActive(true);
    }
  }, [editingRoom, currentBranchId]);

  const handleSave = async () => {
    if (!code.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập mã phòng (VD: P.101, PK-01).");
      return;
    }
    if (!name.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên phòng.");
      return;
    }
    if (!branchId) {
      Alert.alert("Lỗi", "Vui lòng chọn cơ sở/chi nhánh cho phòng này.");
      return;
    }

    setSaving(true);
    try {
      await onSave(isNew ? null : (editingRoom as RoomRecord)._id, {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        type,
        floor: floor.trim(),
        description: description.trim(),
        branchId,
        isActive,
      });
      onClose();
    } catch (err: any) {
      Alert.alert("Lỗi lưu phòng chức năng", err.message || "Không thể lưu thông tin phòng.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (isNew || !onDelete) return;
    const room = editingRoom as RoomRecord;

    Alert.alert(
      "Xác nhận xóa phòng",
      `Bạn có chắc chắn muốn xóa phòng "${room.name}" (${room.code})?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa vĩnh viễn",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              await onDelete(room._id);
              onClose();
            } catch (err: any) {
              Alert.alert("Lỗi xóa phòng", err.message || "Không thể xóa phòng.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
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
                <Ionicons
                  name={isNew ? "add-circle" : "business"}
                  size={20}
                  color="#059669"
                />
              </View>
              <View>
                <Text style={styles.headerTitle}>
                  {isNew ? "Thêm mới phòng chức năng" : "Chỉnh sửa phòng chức năng"}
                </Text>
                <Text style={styles.headerSubtitle}>
                  Cơ sở vật chất & phòng ban điều trị
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Cảnh báo thiết bị y tế trong phòng */}
            {!isNew && Boolean((editingRoom as RoomRecord)?.equipmentCount) && (
              <View style={styles.equipmentBanner}>
                <View style={styles.equipmentBannerIcon}>
                  <Ionicons name="medkit" size={16} color="#7c3aed" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.equipmentBannerTitle}>
                    {(editingRoom as RoomRecord).equipmentCount} thiết bị y tế
                  </Text>
                  <Text style={styles.equipmentBannerSubtitle}>
                    Đang được bố trí và theo dõi vận hành tại phòng này
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.formSection}>
            {/* Chi nhánh */}
            {branchList.length > 1 && (
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>
                  Cơ sở / Chi nhánh <Text style={styles.requiredStar}>*</Text>
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.branchChips}>
                  {branchList.map((b) => (
                    <TouchableOpacity
                      key={b._id}
                      style={[
                        styles.branchChip,
                        branchId === b._id && styles.branchChipActive,
                      ]}
                      onPress={() => canManage && setBranchId(b._id)}
                      disabled={!canManage}
                    >
                      <Text
                        style={[
                          styles.branchChipText,
                          branchId === b._id && styles.branchChipTextActive,
                        ]}
                      >
                        {b.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Mã phòng */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Mã phòng <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, !canManage && styles.inputDisabled]}
                value={code}
                onChangeText={(val) => setCode(val.toUpperCase())}
                placeholder="VD: P.101, PK-02..."
                placeholderTextColor="#94a3b8"
                autoCapitalize="characters"
                editable={canManage}
              />
            </View>

            {/* Tên phòng */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Tên phòng chức năng <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, !canManage && styles.inputDisabled]}
                value={name}
                onChangeText={setName}
                placeholder="VD: Phòng Khám Nội, Phòng Xét nghiệm..."
                placeholderTextColor="#94a3b8"
                editable={canManage}
              />
            </View>

            {/* Loại phòng (Type) */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Loại phòng chức năng</Text>
              <TouchableOpacity
                style={[styles.pickerButton, !canManage && styles.inputDisabled]}
                onPress={() => canManage && setShowTypePicker(true)}
                disabled={!canManage}
              >
                <Text style={styles.pickerButtonText}>
                  {ROOM_TYPE_LABELS[type] || "Chọn loại phòng"}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Tầng */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Vị trí tầng / Khu vực</Text>
              <TextInput
                style={[styles.input, !canManage && styles.inputDisabled]}
                value={floor}
                onChangeText={setFloor}
                placeholder="VD: Tầng 1, Tầng 2, Tòa A..."
                placeholderTextColor="#94a3b8"
                editable={canManage}
              />
            </View>

            {/* Mô tả */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Mô tả ghi chú</Text>
              <TextInput
                style={[styles.input, styles.textArea, !canManage && styles.inputDisabled]}
                value={description}
                onChangeText={setDescription}
                placeholder="Ghi chú về thiết bị hoặc công năng phòng..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                editable={canManage}
              />
            </View>

            {/* Trạng thái hoạt động */}
            {canManage && (
              <View style={styles.switchRow}>
                <View>
                  <Text style={styles.switchTitle}>Trạng thái hoạt động</Text>
                  <Text style={styles.switchSubtitle}>
                    {isActive
                      ? "Phòng đang tiếp nhận vận hành bình thường"
                      : "Tạm đóng cửa / Bảo trì"}
                  </Text>
                </View>
                <Switch
                  value={isActive}
                  onValueChange={setIsActive}
                  trackColor={{ false: "#cbd5e1", true: "#a7f3d0" }}
                  thumbColor={isActive ? "#059669" : "#f1f5f9"}
                />
              </View>
            )}
          </View>

          {/* Footer Actions */}
          {canManage && (
            <View style={styles.footerActions}>
              <AppButton
                title={isNew ? "Tạo mới phòng" : "Lưu thay đổi"}
                variant="primary"
                onPress={handleSave}
                loading={saving}
                icon="save-outline"
              />

              {!isNew && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={handleDelete}
                  disabled={deleting}
                  activeOpacity={0.7}
                >
                  <Ionicons name="trash-outline" size={16} color="#dc2626" />
                  <Text style={styles.deleteBtnText}>
                    {deleting ? "Đang xóa..." : "Xóa phòng chức năng này"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* Modal chọn loại phòng */}
        <Modal
          visible={showTypePicker}
          animationType="fade"
          transparent
          onRequestClose={() => setShowTypePicker(false)}
        >
          <TouchableOpacity
            style={styles.typeModalOverlay}
            activeOpacity={1}
            onPress={() => setShowTypePicker(false)}
          >
            <View style={styles.typeModalBox}>
              <Text style={styles.typeModalTitle}>Chọn phân loại phòng</Text>
              {ROOM_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.typeOptionItem,
                    type === t && styles.typeOptionItemSelected,
                  ]}
                  onPress={() => {
                    setType(t);
                    setShowTypePicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.typeOptionText,
                      type === t && styles.typeOptionTextSelected,
                    ]}
                  >
                    {ROOM_TYPE_LABELS[t]}
                  </Text>
                  {type === t && (
                    <Ionicons name="checkmark-circle" size={18} color="#059669" />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
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
  equipmentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#f5f3ff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#ddd6fe",
    marginBottom: 14,
  },
  equipmentBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#ede9fe",
    alignItems: "center",
    justifyContent: "center",
  },
  equipmentBannerTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#6d28d9",
  },
  equipmentBannerSubtitle: {
    fontSize: 11.5,
    color: "#7c3aed",
    marginTop: 1,
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
    borderRadius: 8,
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
  branchChips: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  branchChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    marginRight: 8,
  },
  branchChipActive: {
    backgroundColor: "#059669",
  },
  branchChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  branchChipTextActive: {
    color: "#ffffff",
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
  inputDisabled: {
    backgroundColor: "#f1f5f9",
    color: "#64748b",
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
  pickerButtonText: {
    fontSize: 13.5,
    color: "#0f172a",
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
    gap: 10,
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#fee2e2",
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#dc2626",
  },
  typeModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  typeModalBox: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
  },
  typeModalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  typeOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  typeOptionItemSelected: {
    backgroundColor: "#ecfdf5",
  },
  typeOptionText: {
    fontSize: 13.5,
    color: "#334155",
  },
  typeOptionTextSelected: {
    fontWeight: "700",
    color: "#059669",
  },
});
