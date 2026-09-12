import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { InventoryWarehouse } from "./types";

interface WarehouseFormModalProps {
  visible: boolean;
  item: InventoryWarehouse | null;
  onClose: () => void;
  onSubmit: (formData: {
    name: string;
    code: string;
    location: string;
    managerName?: string;
    managerPhone?: string;
    description?: string;
  }) => Promise<void>;
}

export const WarehouseFormModal: React.FC<WarehouseFormModalProps> = ({
  visible,
  item,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [location, setLocation] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerPhone, setManagerPhone] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name || "");
      setCode(item.code || "");
      setLocation(item.location || "");
      setManagerName(item.managerName && item.managerName !== "Thủ kho" ? item.managerName : "");
      setManagerPhone(item.managerPhone || "");
      setDescription(item.description || "");
    } else {
      setName("");
      setCode(`KHO-${Date.now().toString().slice(-4)}`);
      setLocation("");
      setManagerName("");
      setManagerPhone("");
      setDescription("");
    }
  }, [item, visible]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên kho lưu trữ.");
      return;
    }
    if (!code.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập mã kho.");
      return;
    }
    if (!location.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập vị trí tầng / khu vực kho.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        location: location.trim(),
        managerName: managerName.trim() || undefined,
        managerPhone: managerPhone.trim() || undefined,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không thể tạo kho lưu trữ.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View style={styles.iconCircle}>
                <Ionicons name="archive-outline" size={20} color="#059669" />
              </View>
              <Text style={styles.modalTitle}>
                {item ? "Chỉnh Sửa Kho Lưu Trữ" : "Thêm Kho Lưu Trữ Mới"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* Tên kho */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Tên kho lưu trữ <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="VD: Kho Dược Chính, Kho Vật Tư Tiêu Hao..."
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Mã kho & Vị trí */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>
                  Mã kho <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, { fontFamily: "monospace", fontWeight: "700" }]}
                  placeholder="VD: KHO-DUOC"
                  placeholderTextColor="#94a3b8"
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1.4 }]}>
                <Text style={styles.label}>
                  Vị trí / Tầng <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="VD: Tầng 1 - Khu A"
                  placeholderTextColor="#94a3b8"
                  value={location}
                  onChangeText={setLocation}
                />
              </View>
            </View>

            {/* Thủ kho & Số điện thoại */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                <Text style={styles.label}>Thủ kho phụ trách</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Họ tên thủ kho"
                  placeholderTextColor="#94a3b8"
                  value={managerName}
                  onChangeText={setManagerName}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Số điện thoại</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0912..."
                  placeholderTextColor="#94a3b8"
                  value={managerPhone}
                  onChangeText={setManagerPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Mô tả điều kiện bảo quản */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Điều kiện bảo quản & Ghi chú</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="VD: Nhiệt độ 15-25 độ C, độ ẩm < 70%, bảo quản thuốc kháng sinh..."
                placeholderTextColor="#94a3b8"
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color="#ffffff" />
              <Text style={styles.submitBtnText}>
                {submitting ? "Đang lưu..." : item ? "Cập Nhật Kho" : "Tạo Kho Mới"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingTop: 18,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
  },
  formScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  rowFields: {
    flexDirection: "row",
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 6,
  },
  required: {
    color: "#dc2626",
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  footer: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  submitBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#059669",
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  submitBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
});
