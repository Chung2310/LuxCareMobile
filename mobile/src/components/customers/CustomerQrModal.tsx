import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Share,
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
import { customerLeadApi } from "../../api/customerLeadApi";
import type { BranchRecord } from "../../../../src/services/branchService";

interface CustomerQrModalProps {
  visible: boolean;
  onClose: () => void;
  companyCode: string;
  branches: BranchRecord[];
  currentBranch?: BranchRecord | null;
}

const CAMPAIGN_SUGGESTIONS = [
  "Quầy tiếp tân",
  "Bàn tư vấn",
  "Sự kiện",
  "Banner Fanpage",
  "Tờ rơi / Standee",
];

export const CustomerQrModal: React.FC<CustomerQrModalProps> = ({
  visible,
  onClose,
  companyCode,
  branches,
  currentBranch,
}) => {
  // Trạng thái: "config" (tùy chỉnh trước) hoặc "preview" (hiển thị mã QR sau khi xác nhận)
  const [step, setStep] = useState<"config" | "preview">("config");

  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    currentBranch?._id || (branches.length > 0 ? branches[0]._id : ""),
  );
  const [campaign, setCampaign] = useState("Quầy tiếp tân");
  const [showBranchPicker, setShowBranchPicker] = useState(false);

  // Reset về config mỗi khi mở modal
  React.useEffect(() => {
    if (visible) {
      setStep("config");
      setSelectedBranchId(
        currentBranch?._id || (branches.length > 0 ? branches[0]._id : ""),
      );
      setCampaign("Quầy tiếp tân");
    }
  }, [visible, currentBranch, branches]);

  const selectedBranch = branches.find((b) => b._id === selectedBranchId);
  const branchCode = selectedBranch?.code;

  const qrUrl = customerLeadApi.getPublicQrUrl(
    companyCode || "LUXCARE",
    branchCode,
    campaign,
  );
  const qrImageUrl = `https://quickchart.io/qr?text=${encodeURIComponent(
    qrUrl,
  )}&size=360&margin=2&ecLevel=H`;

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Mã QR tiếp nhận khách hàng LuxCare (${selectedBranch?.name || "Toàn hệ thống"} - ${campaign}):\n${qrUrl}`,
        url: qrUrl,
        title: "Đường dẫn tiếp nhận khách hàng LuxCare",
      });
    } catch {
      // ignore
    }
  };

  const handleConfirm = () => {
    setStep("preview");
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.modalOverlay} edges={["top", "bottom"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                {step === "config"
                  ? "Tùy chỉnh mã QR Tiếp nhận"
                  : "Mã QR Tiếp nhận Khách hàng"}
              </Text>
              <Text style={styles.headerSubtitle}>
                {step === "config"
                  ? "Chọn chi nhánh & vị trí đặt trước khi tạo mã"
                  : "Mã QR đã sẵn sàng để quét hoặc in ấn standee"}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Body: Bước 1 (Tùy chỉnh cấu hình) */}
          {step === "config" ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* 1. Chọn chi nhánh */}
              <DropdownSelectField
                label="Chi nhánh áp dụng"
                value={
                  selectedBranchId === ""
                    ? "-- Toàn hệ thống (Khách tự chọn) --"
                    : selectedBranch?.name || "Tất cả chi nhánh"
                }
                placeholder="Chọn chi nhánh..."
                icon="business-outline"
                iconColor="#0284c7"
                iconBgColor="#e0f2fe"
                onPress={() => setShowBranchPicker(true)}
              />
              <Text style={styles.helperText}>
                Gắn mã chi nhánh giúp khách hàng khi quét mã được phân bổ trực tiếp về
                cơ sở đó.
              </Text>

              {/* 2. Tên chiến dịch / Vị trí đặt */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Vị trí đặt / Tên nguồn tiếp nhận</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ví dụ: Quầy tiếp tân, Bàn tư vấn 1, Standee..."
                  placeholderTextColor="#94a3b8"
                  value={campaign}
                  onChangeText={setCampaign}
                />

                {/* Gợi ý tag chọn nhanh */}
                <View style={styles.tagsContainer}>
                  {CAMPAIGN_SUGGESTIONS.map((tag) => {
                    const isSelected = campaign === tag;
                    return (
                      <TouchableOpacity
                        key={tag}
                        style={[
                          styles.tagChip,
                          isSelected && styles.tagChipActive,
                        ]}
                        onPress={() => setCampaign(tag)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.tagText,
                            isSelected && styles.tagTextActive,
                          ]}
                        >
                          {tag}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* 3. Tóm tắt thông tin trước khi xác nhận */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Doanh nghiệp:</Text>
                  <Text style={styles.summaryValue}>{companyCode.toUpperCase()}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Cơ sở:</Text>
                  <Text style={styles.summaryValue}>
                    {selectedBranch ? selectedBranch.name : "Toàn hệ thống"}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Vị trí / Nguồn:</Text>
                  <Text style={styles.summaryValue}>{campaign || "Mặc định"}</Text>
                </View>
              </View>

              {/* Hướng dẫn */}
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={18} color="#0284c7" />
                <Text style={styles.infoBoxText}>
                  Sau khi bấm <Text style={{ fontWeight: "700" }}>"Xác nhận & Tạo mã QR"</Text>,
                  hệ thống sẽ tạo mã QR tương ứng để in ấn hoặc quét thử nghiệm.
                </Text>
              </View>
            </ScrollView>
          ) : (
            /* Body: Bước 2 (Hiển thị mã QR đã tạo) */
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Thẻ Standee QR Preview */}
              <View style={styles.qrCard}>
                <View style={styles.badgeCompany}>
                  <Ionicons name="shield-checkmark" size={14} color="#059669" />
                  <Text style={styles.badgeCompanyText}>
                    {companyCode.toUpperCase()} •{" "}
                    {selectedBranch?.name || "Toàn hệ thống"}
                  </Text>
                </View>

                {campaign ? (
                  <View style={styles.campaignBadge}>
                    <Ionicons name="pricetag-outline" size={12} color="#7c3aed" />
                    <Text style={styles.campaignBadgeText}>{campaign}</Text>
                  </View>
                ) : null}

                <View style={styles.imageWrapper}>
                  <Image
                    source={{ uri: qrImageUrl }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                </View>

                <Text style={styles.qrInstruction}>
                  QUÉT MÃ ĐỂ ĐIỀN THÔNG TIN TIẾP NHẬN
                </Text>
                <Text style={styles.qrSubInstruction}>
                  Khách hàng dùng camera điện thoại hoặc Zalo để quét mã và gửi thông tin
                </Text>

                <View style={styles.urlBox}>
                  <Text style={styles.urlText} numberOfLines={2}>
                    {qrUrl}
                  </Text>
                </View>
              </View>

              {/* Ghi chú kết nối */}
              <View style={styles.infoBox}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#059669" />
                <Text style={[styles.infoBoxText, { color: "#065f46" }]}>
                  Dữ liệu khách hàng gửi từ mã này sẽ tự động gắn thẻ nguồn{" "}
                  <Text style={{ fontWeight: "700" }}>"{campaign}"</Text> và chi nhánh{" "}
                  <Text style={{ fontWeight: "700" }}>
                    "{selectedBranch?.name || "Toàn hệ thống"}"
                  </Text>.
                </Text>
              </View>
            </ScrollView>
          )}

          {/* Footer Actions */}
          <View style={styles.footer}>
            {step === "config" ? (
              <>
                <AppButton
                  title="Hủy"
                  variant="secondary"
                  onPress={onClose}
                  style={{ flex: 1 }}
                />
                <AppButton
                  title="Xác nhận & Tạo mã QR"
                  variant="primary"
                  icon="qr-code-outline"
                  onPress={handleConfirm}
                  style={{ flex: 2 }}
                />
              </>
            ) : (
              <>
                <AppButton
                  title="Đổi cấu hình"
                  variant="secondary"
                  icon="options-outline"
                  onPress={() => setStep("config")}
                  style={{ flex: 1 }}
                />
                <AppButton
                  title="Chia sẻ liên kết"
                  variant="primary"
                  icon="share-social-outline"
                  onPress={handleShare}
                  style={{ flex: 1.5 }}
                />
              </>
            )}
          </View>
        </KeyboardAvoidingView>

        {/* Branch Picker Modal */}
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
              <Text style={styles.pickerTitle}>Chọn chi nhánh áp dụng</Text>
              <ScrollView style={{ maxHeight: 320 }}>
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    selectedBranchId === "" && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    setSelectedBranchId("");
                    setShowBranchPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      selectedBranchId === "" && styles.pickerItemTextActive,
                    ]}
                  >
                    -- Toàn hệ thống (Khách tự chọn) --
                  </Text>
                  {selectedBranchId === "" && (
                    <Ionicons name="checkmark" size={18} color="#059669" />
                  )}
                </TouchableOpacity>

                {branches.map((b) => (
                  <TouchableOpacity
                    key={b._id}
                    style={[
                      styles.pickerItem,
                      selectedBranchId === b._id && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setSelectedBranchId(b._id);
                      setShowBranchPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedBranchId === b._id && styles.pickerItemTextActive,
                      ]}
                    >
                      {b.name}
                    </Text>
                    {selectedBranchId === b._id && (
                      <Ionicons name="checkmark" size={18} color="#059669" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>
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
  helperText: {
    fontSize: 11.5,
    color: "#94a3b8",
    marginTop: -8,
    lineHeight: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#475569",
  },
  input: {
    height: 44,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 13,
    color: "#0f172a",
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  tagChipActive: {
    backgroundColor: "#f5f3ff",
    borderColor: "#c4b5fd",
  },
  tagText: {
    fontSize: 11.5,
    color: "#475569",
  },
  tagTextActive: {
    color: "#7c3aed",
    fontWeight: "600",
  },
  summaryCard: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 12,
    color: "#64748b",
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0f172a",
  },
  qrCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  badgeCompany: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
    marginBottom: 8,
  },
  badgeCompanyText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  campaignBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f3ff",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    marginBottom: 12,
  },
  campaignBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7c3aed",
  },
  imageWrapper: {
    padding: 10,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  qrImage: {
    width: 210,
    height: 210,
  },
  qrInstruction: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    marginTop: 14,
  },
  qrSubInstruction: {
    fontSize: 11.5,
    color: "#64748b",
    textAlign: "center",
    marginTop: 3,
    lineHeight: 16,
  },
  urlBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    marginTop: 12,
    width: "100%",
  },
  urlText: {
    fontSize: 11,
    color: "#64748b",
    textAlign: "center",
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 16,
    padding: 12,
    gap: 10,
    width: "100%",
  },
  infoBoxText: {
    fontSize: 12,
    color: "#0369a1",
    lineHeight: 18,
    flex: 1,
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
