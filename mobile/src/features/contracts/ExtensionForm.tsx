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
import { SafeAreaView } from "react-native-safe-area-context";
import type { Contract } from "../../../../src/types/hrContract";
import type { ContractScope } from "../../../../src/services/hrContractService";
import { contracts } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { contractDate, contractStatuses } from "./model";
import { extensionDraft, extensionPayload } from "./extensionModel";
import { UploadFields } from "./UploadFields";
import { contractUploadFields, type ContractUploads } from "./uploadModel";
import { DatePickerModal } from "../credentials/DatePickerModal";

export function ExtensionForm({
  contract,
  scope,
  onClose,
  setLocked,
}: {
  contract: Contract;
  scope: ContractScope;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [draft, setDraft] = useState(extensionDraft);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const [uploads, setUploads] = useState<ContractUploads>({});

  // Date picker modal state
  const [dateModalField, setDateModalField] = useState<"newEndDate" | "extensionDate" | null>(null);

  const save = async () => {
    if (lock.current || blocked) return;
    let payload;
    try {
      payload = extensionPayload(draft, contract);
    } catch (err) {
      setError(messageOf(err));
      return;
    }
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const result = await contracts.extend(scope, contract._id, {
        ...payload,
        ...contractUploadFields(uploads),
      });
      if (!result?.contract?._id || !result?.extension?._id)
        throw new Error("Chưa xác nhận được kết quả gia hạn.");
      onClose();
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
      if (!status || status >= 500 || status === 409) {
        setBlocked(true);
        setError(`${messageOf(err)} Đóng và kiểm tra thời hạn cùng lịch sử gia hạn trước khi gửi tiếp.`);
      } else setError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };

  const disabled = busy || blocked;

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
            <Text style={styles.headerTitle}>Gia hạn hợp đồng</Text>
            <Text style={styles.headerSub}>{contract.employeeName}</Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.saveHeaderBtn,
              disabled && styles.saveHeaderBtnDisabled,
              pressed && { opacity: 0.8 },
            ]}
            disabled={disabled}
            onPress={() => void save()}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveHeaderBtnText}>Lưu</Text>
            )}
          </Pressable>
        </View>

        {/* Body Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {!!error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>⚠️ {error}</Text>
            </View>
          )}

          {/* Current Contract Info Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionIcon}>📄</Text>
              <Text style={styles.sectionTitle}>Thông tin hợp đồng hiện tại</Text>
            </View>

            <View style={styles.contractSummaryBox}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Nhân sự:</Text>
                <Text style={styles.summaryValue}>{contract.employeeName}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Loại hợp đồng:</Text>
                <Text style={styles.summaryValue}>{contract.contractType}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Hạn hiện tại:</Text>
                <Text style={[styles.summaryValue, { color: "#e11d48", fontWeight: "700" }]}>
                  {contractDate(contract.endDate)}
                </Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Trạng thái:</Text>
                <Text style={styles.summaryValue}>
                  {contractStatuses[contract.status] || contract.status}
                </Text>
              </View>
            </View>

            {contract.status === "expired" ? (
              <View style={styles.alertInfoBox}>
                <Text style={styles.alertInfoText}>
                  💡 Sau khi gia hạn, hợp đồng hết hạn sẽ tự động chuyển về trạng thái **Đang hiệu lực**.
                </Text>
              </View>
            ) : null}
          </View>

          {/* Extension Dates Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionIcon}>⏳</Text>
              <Text style={styles.sectionTitle}>Thời hạn gia hạn mới</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ngày hết hạn mới *</Text>
              <Pressable
                style={styles.datePickerBtn}
                disabled={disabled}
                onPress={() => setDateModalField("newEndDate")}
              >
                <Text style={styles.datePickerIcon}>📅</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.datePickerValue}>
                    {draft.newEndDate ? contractDate(draft.newEndDate) : "Chạm để chọn ngày hết hạn mới"}
                  </Text>
                  <Text style={styles.datePickerRaw}>
                    {draft.newEndDate || "Phải sau ngày hết hạn hiện tại"}
                  </Text>
                </View>
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Ngày ký gia hạn (ngày lập phụ lục) *</Text>
              <Pressable
                style={styles.datePickerBtn}
                disabled={disabled}
                onPress={() => setDateModalField("extensionDate")}
              >
                <Text style={styles.datePickerIcon}>✍️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.datePickerValue}>
                    {draft.extensionDate ? contractDate(draft.extensionDate) : "Chọn ngày"}
                  </Text>
                  <Text style={styles.datePickerRaw}>{draft.extensionDate || "YYYY-MM-DD"}</Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* Reason Card */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionIcon}>📝</Text>
              <Text style={styles.sectionTitle}>Lý do gia hạn</Text>
            </View>

            <TextInput
              style={[styles.input, styles.textArea]}
              value={draft.reason}
              multiline
              numberOfLines={3}
              editable={!disabled}
              placeholder="VD: Gia hạn thời hạn hợp đồng thêm 12 tháng theo thỏa thuận..."
              placeholderTextColor="#94a3b8"
              onChangeText={(text) => setDraft((c) => ({ ...c, reason: text }))}
            />
          </View>

          {/* Extension Files */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionIcon}>📎</Text>
              <Text style={styles.sectionTitle}>Hồ sơ gia hạn đính kèm</Text>
            </View>

            <UploadFields
              extension
              scope={scope}
              value={uploads}
              onChange={setUploads}
              disabled={disabled}
              onBusy={(value) => {
                lock.current = value;
                setBusy(value);
                setLocked(value);
              }}
            />
          </View>

          {/* Bottom Actions */}
          <View style={styles.bottomActions}>
            <Pressable
              style={({ pressed }) => [
                styles.submitBtn,
                disabled && styles.submitBtnDisabled,
                pressed && { opacity: 0.88 },
              ]}
              disabled={disabled}
              onPress={() => void save()}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.submitBtnText}>Xác nhận gia hạn hợp đồng</Text>
              )}
            </Pressable>

            <Pressable style={styles.cancelBtn} disabled={busy} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Date Picker Modal for newEndDate */}
      <DatePickerModal
        visible={dateModalField === "newEndDate"}
        onClose={() => setDateModalField(null)}
        value={draft.newEndDate}
        onChange={(val) => setDraft((c) => ({ ...c, newEndDate: val }))}
        title="Chọn ngày hết hạn mới"
        baseDateForShortcuts={contract.endDate || undefined}
      />

      {/* Date Picker Modal for extensionDate */}
      <DatePickerModal
        visible={dateModalField === "extensionDate"}
        onClose={() => setDateModalField(null)}
        value={draft.extensionDate}
        onChange={(val) => setDraft((c) => ({ ...c, extensionDate: val }))}
        title="Chọn ngày ký gia hạn"
      />
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
  contractSummaryBox: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryLabel: {
    fontSize: 13,
    color: "#64748b",
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  alertInfoBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  alertInfoText: {
    fontSize: 12,
    color: "#1e40af",
    lineHeight: 18,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
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
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  datePickerIcon: {
    fontSize: 20,
  },
  datePickerValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  datePickerRaw: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
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
  cancelBtn: {
    backgroundColor: "#f1f5f9",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
  },
});
