import React, { useState } from "react";
import {
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
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppButton } from "../common/AppButton";
import { DropdownSelectField } from "../common/DropdownSelectField";
import { CustomerAlertModal, type CustomerAlertType } from "./CustomerAlertModal";
import type { CreateCustomerLeadInput } from "../../api/customerLeadApi";
import type { BranchRecord } from "../../../../src/services/branchService";

interface CustomerCreateModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCustomerLeadInput) => Promise<void>;
  branches: BranchRecord[];
  defaultBranchId?: string;
}

const SOURCE_OPTIONS = [
  { id: "manual", label: "Đến quầy / Gọi hotline" },
  { id: "referral", label: "Người quen giới thiệu" },
  { id: "website", label: "Website doanh nghiệp" },
];

const PREFERRED_TIME_OPTIONS = [
  "Bất kỳ lúc nào",
  "Buổi sáng (08:00 - 11:30)",
  "Buổi chiều (13:30 - 17:00)",
  "Buổi tối (sau 17:30)",
];

const COMMON_SERVICES = [
  "Khám & Tư vấn tổng quát",
  "Chăm sóc & Phục hồi sức khỏe",
  "Gói khám định kỳ",
  "Tư vấn trang thiết bị y tế",
  "Dịch vụ chăm sóc tại nhà",
  "Nhu cầu khác",
];

export const CustomerCreateModal: React.FC<CustomerCreateModalProps> = ({
  visible,
  onClose,
  onSubmit,
  branches,
  defaultBranchId,
}) => {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [branchId, setBranchId] = useState(defaultBranchId || "");
  const [source, setSource] = useState("manual");
  const [serviceInterest, setServiceInterest] = useState("");
  const [preferredContactTime, setPreferredContactTime] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  // Sub picker states
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Rounded alert state
  const [alertConfig, setAlertConfig] = useState<{
    visible: boolean;
    type?: CustomerAlertType;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm?: () => void;
  }>({
    visible: false,
    title: "",
    message: "",
  });

  const showAlert = (config: Omit<typeof alertConfig, "visible">) => {
    setAlertConfig({ ...config, visible: true });
  };

  const closeAlert = () => {
    setAlertConfig((prev) => ({ ...prev, visible: false }));
  };

  // Sync default branch
  React.useEffect(() => {
    if (defaultBranchId && !branchId) {
      setBranchId(defaultBranchId);
    }
  }, [defaultBranchId]);

  const resetForm = () => {
    setFullName("");
    setPhone("");
    setEmail("");
    setAddress("");
    setBranchId(defaultBranchId || "");
    setSource("manual");
    setServiceInterest("");
    setPreferredContactTime("");
    setNotes("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSave = async () => {
    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim().replace(/[\s.-]/g, "");

    if (!trimmedName || trimmedName.length < 2) {
      showAlert({
        type: "warning",
        title: "Thiếu thông tin",
        message: "Vui lòng nhập họ và tên khách hàng (tối thiểu 2 ký tự).",
        confirmText: "Đã hiểu",
        onConfirm: closeAlert,
      });
      return;
    }

    if (!trimmedPhone) {
      showAlert({
        type: "warning",
        title: "Thiếu thông tin",
        message: "Vui lòng nhập số điện thoại khách hàng.",
        confirmText: "Đã hiểu",
        onConfirm: closeAlert,
      });
      return;
    }

    // Phone format check (matches server regex: starts with 0 or +84 followed by 8-11 digits)
    const phoneRegex = /^(0|\+84)[0-9]{8,11}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      showAlert({
        type: "warning",
        title: "Số điện thoại không hợp lệ",
        message: "Số điện thoại cần có từ 9 đến 11 chữ số (Ví dụ: 0912345678).",
        confirmText: "Đã hiểu",
        onConfirm: closeAlert,
      });
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        fullName: trimmedName,
        phone: trimmedPhone,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        branchId: branchId || undefined,
        source: source || "manual",
        qrCampaign: source === "manual" ? "Tạo thủ công tại quầy" : "Khách giới thiệu",
        serviceInterest: serviceInterest.trim() || undefined,
        preferredContactTime: preferredContactTime.trim() || undefined,
        notes: notes.trim() || undefined,
        status: "new",
      });
      resetForm();
      onClose();
    } catch (err: any) {
      showAlert({
        type: "error",
        title: "Lỗi tạo khách hàng",
        message: err.message || "Không thể tạo khách hàng mới.",
        confirmText: "Đóng",
        onConfirm: closeAlert,
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedBranchName =
    branches.find((b) => b._id === branchId)?.name || "Chưa chọn chi nhánh";

  const selectedSourceLabel =
    SOURCE_OPTIONS.find((s) => s.id === source)?.label || "Đến quầy / Gọi hotline";

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <SafeAreaView style={styles.modalOverlay} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Thêm khách hàng mới</Text>
              <Text style={styles.headerSubtitle}>
                Tiếp nhận và lưu thông tin chăm sóc khách hàng
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              disabled={loading}
            >
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Required basic info */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Họ và tên khách hàng <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="VD: Nguyễn Văn An"
                placeholderTextColor="#94a3b8"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                Số điện thoại <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="VD: 0912345678"
                placeholderTextColor="#94a3b8"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            {/* Branch select */}
            {branches.length > 0 && (
              <DropdownSelectField
                label="Chi nhánh tiếp nhận"
                value={selectedBranchName}
                placeholder="Chọn chi nhánh..."
                icon="business-outline"
                iconColor="#0284c7"
                iconBgColor="#e0f2fe"
                onPress={() => setShowBranchPicker(true)}
              />
            )}

            {/* Source select */}
            <DropdownSelectField
              label="Nguồn khách hàng"
              value={selectedSourceLabel}
              placeholder="Chọn nguồn..."
              icon="globe-outline"
              iconColor="#7c3aed"
              iconBgColor="#f5f3ff"
              onPress={() => setShowSourcePicker(true)}
            />

            {/* Service interest with chips */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Dịch vụ quan tâm</Text>
              <TextInput
                style={styles.input}
                placeholder="Nhập hoặc chọn gợi ý bên dưới..."
                placeholderTextColor="#94a3b8"
                value={serviceInterest}
                onChangeText={setServiceInterest}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.suggestScroll}
                contentContainerStyle={styles.suggestContainer}
              >
                {COMMON_SERVICES.map((srv) => (
                  <TouchableOpacity
                    key={srv}
                    style={[
                      styles.suggestChip,
                      serviceInterest === srv && styles.suggestChipActive,
                    ]}
                    onPress={() => setServiceInterest(srv)}
                  >
                    <Text
                      style={[
                        styles.suggestChipText,
                        serviceInterest === srv && styles.suggestChipTextActive,
                      ]}
                    >
                      {srv}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* Preferred contact time */}
            <DropdownSelectField
              label="Khung giờ liên hệ thuận tiện"
              value={preferredContactTime || "Chưa chọn khung giờ"}
              placeholder="Chọn khung giờ thuận tiện..."
              icon="time-outline"
              iconColor="#d97706"
              iconBgColor="#fffbeb"
              onPress={() => setShowTimePicker(true)}
            />

            {/* Optional contact info */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="VD: nguyenvana@gmail.com"
                placeholderTextColor="#94a3b8"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Địa chỉ</Text>
              <TextInput
                style={styles.input}
                placeholder="VD: Quận 1, TP. Hồ Chí Minh"
                placeholderTextColor="#94a3b8"
                value={address}
                onChangeText={setAddress}
              />
            </View>

            {/* Initial Notes */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Ghi chú ban đầu</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Nhu cầu cụ thể, triệu chứng, người giới thiệu..."
                placeholderTextColor="#94a3b8"
                multiline
                numberOfLines={3}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </ScrollView>

          {/* Footer buttons */}
          <View style={styles.footer}>
            <AppButton
              title="Hủy"
              variant="secondary"
              onPress={handleClose}
              style={styles.cancelBtn}
              disabled={loading}
            />
            <AppButton
              title="Lưu khách hàng"
              variant="primary"
              onPress={handleSave}
              loading={loading}
              icon="save-outline"
              style={styles.saveBtn}
            />
          </View>
        </KeyboardAvoidingView>

        {/* Modal picker: Branch */}
        <Modal
          visible={showBranchPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBranchPicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowBranchPicker(false)}
          >
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>Chọn chi nhánh tiếp nhận</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {branches.map((b) => (
                  <TouchableOpacity
                    key={b._id}
                    style={[
                      styles.pickerItem,
                      branchId === b._id && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setBranchId(b._id);
                      setShowBranchPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        branchId === b._id && styles.pickerItemTextActive,
                      ]}
                    >
                      {b.name}
                    </Text>
                    {branchId === b._id && (
                      <Ionicons name="checkmark" size={18} color="#059669" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal picker: Source */}
        <Modal
          visible={showSourcePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSourcePicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowSourcePicker(false)}
          >
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>Chọn nguồn khách hàng</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {SOURCE_OPTIONS.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[
                      styles.pickerItem,
                      source === s.id && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setSource(s.id);
                      setShowSourcePicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        source === s.id && styles.pickerItemTextActive,
                      ]}
                    >
                      {s.label}
                    </Text>
                    {source === s.id && (
                      <Ionicons name="checkmark" size={18} color="#059669" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Modal picker: Time */}
        <Modal
          visible={showTimePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowTimePicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowTimePicker(false)}
          >
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>Khung giờ liên hệ thuận tiện</Text>
              <ScrollView style={{ maxHeight: 300 }}>
                {PREFERRED_TIME_OPTIONS.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.pickerItem,
                      preferredContactTime === t && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setPreferredContactTime(t);
                      setShowTimePicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        preferredContactTime === t && styles.pickerItemTextActive,
                      ]}
                    >
                      {t}
                    </Text>
                    {preferredContactTime === t && (
                      <Ionicons name="checkmark" size={18} color="#059669" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Popup thông báo bo góc */}
        <CustomerAlertModal
          visible={alertConfig.visible}
          type={alertConfig.type}
          title={alertConfig.title}
          message={alertConfig.message}
          confirmText={alertConfig.confirmText}
          onConfirm={alertConfig.onConfirm || closeAlert}
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "flex-end",
  },
  container: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "92%",
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 18,
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  required: {
    color: "#dc2626",
  },
  input: {
    height: 44,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 14,
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: "#0f172a",
  },
  textArea: {
    height: 80,
    paddingTop: 10,
    textAlignVertical: "top",
  },
  suggestScroll: {
    marginTop: 4,
  },
  suggestContainer: {
    gap: 6,
  },
  suggestChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  suggestChipActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  suggestChipText: {
    fontSize: 11.5,
    color: "#475569",
  },
  suggestChipTextActive: {
    color: "#059669",
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  cancelBtn: {
    flex: 1,
  },
  saveBtn: {
    flex: 1.5,
  },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },
  pickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 12,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pickerItemActive: {
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
  },
  pickerItemText: {
    fontSize: 13.5,
    color: "#334155",
  },
  pickerItemTextActive: {
    color: "#059669",
    fontWeight: "600",
  },
});
