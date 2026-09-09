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
import type { Contract, Employee } from "../../../../src/types/hrContract";
import type { ContractScope } from "../../../../src/services/hrContractService";
import { getContractFiles, getSignedImages } from "../../../../src/services/hrContractFiles";
import { contracts } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { contractDraft, contractPayload, contractChanges } from "./formModel";
import { contractDate, contractStatuses } from "./model";
import { UploadFields } from "./UploadFields";
import { contractUploadFields, type ContractUploads } from "./uploadModel";
import { ContractFiles } from "./ContractFiles";
import { EmployeeSelectModal } from "../credentials/EmployeeSelectModal";
import { DatePickerModal } from "../credentials/DatePickerModal";

const COMMON_CONTRACT_TYPES = [
  "Hợp đồng xác định thời hạn",
  "Hợp đồng không xác định thời hạn",
  "Hợp đồng thử việc",
  "Hợp đồng cộng tác viên",
  "Hợp đồng dịch vụ / khoán việc",
];

const STATUS_OPTIONS: { value: Contract["status"]; label: string; color: string }[] = [
  { value: "draft", label: "Bản nháp", color: "#64748b" },
  { value: "active", label: "Hiệu lực", color: "#16a34a" },
  { value: "expired", label: "Hết hạn", color: "#e11d48" },
  { value: "terminated", label: "Chấm dứt", color: "#9333ea" },
];

export function ContractForm({
  contract,
  employees,
  scope,
  onClose,
  setLocked,
  readOnly = false,
}: {
  contract?: Contract;
  employees: Employee[];
  scope: ContractScope;
  onClose: () => void;
  setLocked: (value: boolean) => void;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState(() => contractDraft(contract));
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const [uploads, setUploads] = useState<ContractUploads>({});

  // Modals
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [dateModalField, setDateModalField] = useState<"startDate" | "endDate" | null>(null);

  // Selected employee lookup
  const currentEmployee = employees.find((emp) => emp._id === draft.employeeId);
  const employeeDisplayName =
    currentEmployee?.displayName ||
    contract?.employeeName ||
    currentEmployee?.email ||
    "Chưa chọn nhân viên";

  const save = async () => {
    if (lock.current || blocked || readOnly) return;
    let value;
    try {
      value = contractPayload(draft, employees, contract);
    } catch (err) {
      setError(messageOf(err));
      return;
    }
    const patch = contract ? contractChanges(value, contract) : value;
    if (!Object.keys(patch).length && !Object.keys(uploads).length) {
      onClose();
      return;
    }
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const saved = contract
        ? await contracts.update(scope, contract._id, patch)
        : await contracts.create(scope, { ...value, ...contractUploadFields(uploads) });
      if (!saved?._id) throw new Error("Chưa xác nhận hợp đồng đã được lưu.");
      onClose();
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
      if (!status || status >= 500 || status === 409) {
        setBlocked(true);
        setError(`${messageOf(err)} Đóng và tải lại danh sách để kiểm tra kết quả trước khi lưu tiếp.`);
      } else setError(messageOf(err));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };

  const disabled = busy || blocked || readOnly;

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
              {contract
                ? readOnly
                  ? "Chi tiết hợp đồng"
                  : "Chỉnh sửa hợp đồng"
                : "Tạo hợp đồng mới"}
            </Text>
            <Text style={styles.headerSub}>
              {contract ? contract.employeeName : "Điền thông tin và thời hạn"}
            </Text>
          </View>

          {!readOnly ? (
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
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {/* Form Body */}
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

          {/* Section 1: Nhân sự */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionIcon}>👤</Text>
              <Text style={styles.sectionTitle}>Nhân sự áp dụng</Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.employeeBox,
                !readOnly && pressed && { opacity: 0.85 },
              ]}
              disabled={disabled}
              onPress={() => setEmployeeModalOpen(true)}
            >
              <View style={styles.employeeAvatar}>
                <Text style={styles.employeeAvatarText}>
                  {employeeDisplayName.charAt(0).toUpperCase()}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.employeeName}>{employeeDisplayName}</Text>
                <Text style={styles.employeeSub}>
                  {currentEmployee?.email || currentEmployee?.department || "Chạm để chọn nhân viên"}
                </Text>
              </View>

              {!readOnly && (
                <View style={styles.employeeChangeBadge}>
                  <Text style={styles.employeeChangeText}>Đổi ›</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Section 2: Loại hợp đồng & Trạng thái */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionIcon}>📑</Text>
              <Text style={styles.sectionTitle}>Loại hợp đồng & Trạng thái</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Loại hợp đồng *</Text>
              <TextInput
                style={[styles.input, readOnly && styles.inputReadOnly]}
                value={draft.contractType}
                editable={!disabled}
                placeholder="VD: Hợp đồng xác định thời hạn"
                placeholderTextColor="#94a3b8"
                onChangeText={(text) => setDraft((c) => ({ ...c, contractType: text }))}
              />

              {!readOnly && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickChipsRow}
                >
                  {COMMON_CONTRACT_TYPES.map((typeStr) => (
                    <Pressable
                      key={typeStr}
                      style={[
                        styles.quickChip,
                        draft.contractType === typeStr && styles.quickChipActive,
                      ]}
                      onPress={() => setDraft((c) => ({ ...c, contractType: typeStr }))}
                    >
                      <Text
                        style={[
                          styles.quickChipText,
                          draft.contractType === typeStr && styles.quickChipTextActive,
                        ]}
                      >
                        {typeStr}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Trạng thái hợp đồng</Text>
              <View style={styles.statusChipsRow}>
                {STATUS_OPTIONS.map((st) => {
                  const isSelected = draft.status === st.value;
                  return (
                    <Pressable
                      key={st.value}
                      style={[
                        styles.statusChip,
                        isSelected && {
                          backgroundColor: `${st.color}18`,
                          borderColor: st.color,
                        },
                      ]}
                      disabled={disabled}
                      onPress={() => setDraft((c) => ({ ...c, status: st.value }))}
                    >
                      <View
                        style={[
                          styles.statusDot,
                          { backgroundColor: isSelected ? st.color : "#94a3b8" },
                        ]}
                      />
                      <Text
                        style={[
                          styles.statusChipText,
                          isSelected && { color: st.color, fontWeight: "700" },
                        ]}
                      >
                        {st.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Section 3: Thời hạn hợp đồng */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionIcon}>📅</Text>
              <Text style={styles.sectionTitle}>Thời hạn hợp đồng</Text>
            </View>

            <View style={styles.datesGrid}>
              {/* Start Date */}
              <View style={styles.dateCol}>
                <Text style={styles.inputLabel}>Ngày bắt đầu *</Text>
                <Pressable
                  style={[styles.datePickerBtn, readOnly && styles.inputReadOnly]}
                  disabled={disabled}
                  onPress={() => setDateModalField("startDate")}
                >
                  <Text style={styles.datePickerIcon}>🗓️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.datePickerValue}>
                      {draft.startDate ? contractDate(draft.startDate) : "Chọn ngày"}
                    </Text>
                    <Text style={styles.datePickerRaw}>
                      {draft.startDate || "YYYY-MM-DD"}
                    </Text>
                  </View>
                </Pressable>
              </View>

              {/* End Date */}
              <View style={styles.dateCol}>
                <Text style={styles.inputLabel}>Ngày hết hạn *</Text>
                <Pressable
                  style={[styles.datePickerBtn, readOnly && styles.inputReadOnly]}
                  disabled={disabled}
                  onPress={() => setDateModalField("endDate")}
                >
                  <Text style={styles.datePickerIcon}>⏳</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.datePickerValue}>
                      {draft.endDate ? contractDate(draft.endDate) : "Chọn ngày"}
                    </Text>
                    <Text style={styles.datePickerRaw}>
                      {draft.endDate || "YYYY-MM-DD"}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>

          {/* Section 4: Ghi chú */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionIcon}>📝</Text>
              <Text style={styles.sectionTitle}>Ghi chú bổ sung</Text>
            </View>

            <TextInput
              style={[styles.input, styles.textArea, readOnly && styles.inputReadOnly]}
              value={draft.note}
              multiline
              numberOfLines={3}
              editable={!disabled}
              placeholder="Ghi chú điều khoản, chức danh hoặc thông tin thêm..."
              placeholderTextColor="#94a3b8"
              onChangeText={(text) => setDraft((c) => ({ ...c, note: text }))}
            />
          </View>

          {/* Section 5: Tệp đính kèm */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionIcon}>📎</Text>
              <Text style={styles.sectionTitle}>Hồ sơ & Tài liệu đính kèm</Text>
            </View>

            {/* Existing files if editing */}
            {contract && (
              <>
                <ContractFiles title="Tệp hợp đồng hiện có" files={getContractFiles(contract)} />
                <ContractFiles title="Ảnh đã ký hiện có" files={getSignedImages(contract)} />
              </>
            )}

            {/* Upload fields when creating or extending */}
            {!contract && !readOnly && (
              <UploadFields
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
            )}
          </View>

          {/* Bottom Submit Action */}
          {!readOnly && (
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
                  <Text style={styles.submitBtnText}>
                    {contract ? "Cập nhật hợp đồng" : "Tạo hợp đồng"}
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={styles.cancelBtn}
                disabled={busy}
                onPress={onClose}
              >
                <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Employee Select Modal */}
      <EmployeeSelectModal
        visible={employeeModalOpen}
        onClose={() => setEmployeeModalOpen(false)}
        employees={employees}
        selectedId={draft.employeeId}
        onSelect={(emp) => {
          setDraft((c) => ({ ...c, employeeId: emp._id }));
          setEmployeeModalOpen(false);
        }}
        title="Chọn nhân sự ký hợp đồng"
      />

      {/* Date Picker Modal for Start Date */}
      <DatePickerModal
        visible={dateModalField === "startDate"}
        onClose={() => setDateModalField(null)}
        value={draft.startDate}
        onChange={(val) => setDraft((c) => ({ ...c, startDate: val }))}
        title="Chọn ngày bắt đầu hợp đồng"
      />

      {/* Date Picker Modal for End Date */}
      <DatePickerModal
        visible={dateModalField === "endDate"}
        onClose={() => setDateModalField(null)}
        value={draft.endDate}
        onChange={(val) => setDraft((c) => ({ ...c, endDate: val }))}
        title="Chọn ngày hết hạn hợp đồng"
        baseDateForShortcuts={draft.startDate || undefined}
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
  employeeBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  employeeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  employeeAvatarText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  employeeName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  employeeSub: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  employeeChangeBadge: {
    backgroundColor: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  employeeChangeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
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
  inputReadOnly: {
    backgroundColor: "#f1f5f9",
    color: "#64748b",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  quickChipsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  quickChip: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  quickChipActive: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  quickChipText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
  },
  quickChipTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
  statusChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusChipText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  datesGrid: {
    flexDirection: "row",
    gap: 10,
  },
  dateCol: {
    flex: 1,
    gap: 6,
  },
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  datePickerIcon: {
    fontSize: 20,
  },
  datePickerValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  datePickerRaw: {
    fontSize: 11,
    color: "#64748b",
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
