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
import type { InventorySupplier } from "./types";

interface SupplierFormModalProps {
  visible: boolean;
  item: InventorySupplier | null;
  onClose: () => void;
  onSubmit: (formData: {
    name: string;
    code: string;
    phone?: string;
    email?: string;
    address?: string;
    contactPerson?: string;
    taxCode?: string;
  }) => Promise<void>;
}

export const SupplierFormModal: React.FC<SupplierFormModalProps> = ({
  visible,
  item,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (item) {
      setName(item.name || "");
      setCode(item.code || "");
      setContactPerson(item.contactPerson && item.contactPerson !== "Đại diện kinh doanh" ? item.contactPerson : "");
      setPhone(item.phone || "");
      setEmail(item.email || "");
      setAddress(item.address && item.address !== "Chưa cập nhật địa chỉ" ? item.address : "");
      setTaxCode(item.taxCode || "");
    } else {
      setName("");
      setCode(`NCC-${Date.now().toString().slice(-4)}`);
      setContactPerson("");
      setPhone("");
      setEmail("");
      setAddress("");
      setTaxCode("");
    }
  }, [item, visible]);

  const handleSubmit = async () => {
    if (!name.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập tên nhà cung cấp.");
      return;
    }
    if (!code.trim()) {
      Alert.alert("Thiếu thông tin", "Vui lòng nhập mã nhà cung cấp.");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        contactPerson: contactPerson.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        taxCode: taxCode.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không thể tạo nhà cung cấp.");
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
                <Ionicons name="business-outline" size={20} color="#059669" />
              </View>
              <Text style={styles.modalTitle}>
                {item ? "Chỉnh Sửa Nhà Cung Cấp" : "Thêm Nhà Cung Cấp Mới"}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* Tên nhà cung cấp */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Tên nhà cung cấp / Hãng <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="VD: Công ty Dược Hậu Giang, B.Braun..."
                placeholderTextColor="#94a3b8"
                value={name}
                onChangeText={setName}
              />
            </View>

            {/* Mã & Mã số thuế */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>
                  Mã NCC <Text style={styles.required}>*</Text>
                </Text>
                <TextInput
                  style={[styles.input, { fontFamily: "monospace", fontWeight: "700" }]}
                  placeholder="VD: NCC-DHG"
                  placeholderTextColor="#94a3b8"
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                <Text style={styles.label}>Mã số thuế</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0101234567"
                  placeholderTextColor="#94a3b8"
                  value={taxCode}
                  onChangeText={setTaxCode}
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Người liên hệ & SĐT */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, { flex: 1.2 }]}>
                <Text style={styles.label}>Người đại diện liên hệ</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Họ tên đại diện"
                  placeholderTextColor="#94a3b8"
                  value={contactPerson}
                  onChangeText={setContactPerson}
                />
              </View>

              <View style={[styles.fieldGroup, { flex: 1 }]}>
                <Text style={styles.label}>Hotline / SĐT</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0903..."
                  placeholderTextColor="#94a3b8"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>
            </View>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email liên hệ</Text>
              <TextInput
                style={styles.input}
                placeholder="contact@dhgpharma.com.vn"
                placeholderTextColor="#94a3b8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Địa chỉ trụ sở */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Địa chỉ trụ sở</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Số nhà, đường, quận/huyện, tỉnh/thành phố..."
                placeholderTextColor="#94a3b8"
                value={address}
                onChangeText={setAddress}
                multiline
                numberOfLines={2}
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
                {submitting ? "Đang lưu..." : item ? "Cập Nhật NCC" : "Tạo NCC Mới"}
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
    maxHeight: "88%",
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
    height: 70,
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
