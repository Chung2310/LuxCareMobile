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
import type { InventoryCategory } from "./types";

interface CategoryFormModalProps {
  visible: boolean;
  item: InventoryCategory | null; // null = Thêm mới, có item = Sửa
  onClose: () => void;
  onSubmit: (formData: {
    name: string;
    code: string;
    description?: string;
    color?: string;
  }) => Promise<void>;
}

const COLOR_OPTIONS = [
  { label: "Xanh ngọc", value: "#059669" },
  { label: "Xanh dương", value: "#2563eb" },
  { label: "Cam hổ phách", value: "#d97706" },
  { label: "Đỏ hồng", value: "#dc2626" },
  { label: "Tím hoa cà", value: "#7c3aed" },
  { label: "Xám đá", value: "#475569" },
];

export const CategoryFormModal: React.FC<CategoryFormModalProps> = ({
  visible,
  item,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#059669");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name || "");
      setCode(item.code || "");
      setDescription(item.description || "");
      setColor(item.color || "#059669");
    } else {
      setName("");
      setCode(`DM-${Date.now().toString().slice(-4)}`);
      setDescription("");
      setColor("#059669");
    }
  }, [item, visible]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên danh mục phân loại.");
      return;
    }
    if (!code.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập mã danh mục.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim() || undefined,
        color,
      });
      onClose();
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không thể tạo danh mục phân loại.");
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
              <View style={[styles.iconCircle, { backgroundColor: `${color}15` }]}>
                <Ionicons name="layers" size={20} color={color} />
              </View>
              <Text style={styles.modalTitle}>
                {item ? "Chỉnh Sửa Danh Mục" : "Thêm Danh Mục Mới"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* Tên danh mục */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Tên danh mục phân loại <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="VD: Dược phẩm, Vật tư tiêu hao, Sinh phẩm..."
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Mã danh mục */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Mã danh mục <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, { fontFamily: "monospace", fontWeight: "700" }]}
                placeholder="VD: DM-DP, DM-VTTH..."
                placeholderTextColor="#94a3b8"
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
              />
            </View>

            {/* Màu sắc nhận diện */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Màu sắc phân loại</Text>
              <View style={styles.colorRow}>
                {COLOR_OPTIONS.map((c) => {
                  const isSelected = color === c.value;
                  return (
                    <TouchableOpacity
                      key={c.value}
                      style={[
                        styles.colorCircle,
                        { backgroundColor: c.value },
                        isSelected && styles.colorCircleSelected,
                      ]}
                      onPress={() => setColor(c.value)}
                      activeOpacity={0.8}
                    >
                      {isSelected && <Ionicons name="checkmark" size={16} color="#ffffff" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Mô tả */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Mô tả chi tiết</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Mô tả công năng, nhóm lưu trữ của danh mục này..."
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
                {submitting ? "Đang lưu..." : item ? "Cập Nhật" : "Tạo Danh Mục"}
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
  colorRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 6,
  },
  colorCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  colorCircleSelected: {
    borderWidth: 3,
    borderColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
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
