import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Credential } from "../../../../src/types/hrCredential";
import type { CredentialFileFields, CredentialList } from "../../../../src/services/hrCredentialService";
import { pickCredentialFile } from "./uploadFile";
import { credentials } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { credentialTypes } from "./model";
import { credentialDraft, credentialPayload, credentialChanges } from "./formModel";
import { EmployeeSelectModal } from "./EmployeeSelectModal";
import { DatePickerModal } from "./DatePickerModal";
import { ContractFiles } from "../contracts/ContractFiles";

export function CredentialForm({
  item,
  employees,
  companyCode,
  onClose,
  setLocked,
  readOnly = false,
  onDelete,
}: {
  item?: Credential;
  employees: CredentialList["employees"];
  companyCode: string;
  onClose: () => void;
  setLocked: (value: boolean) => void;
  readOnly?: boolean;
  onDelete?: () => void;
}) {
  const [draft, setDraft] = useState(() => credentialDraft(item));
  const [employeeModalOpen, setEmployeeModalOpen] = useState(false);
  const [issueDatePickerOpen, setIssueDatePickerOpen] = useState(false);
  const [expiryDatePickerOpen, setExpiryDatePickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lock = useRef(false);
  const uploadController = useRef<AbortController | null>(null);
  const [upload, setUpload] = useState<CredentialFileFields | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => () => uploadController.current?.abort(), []);

  const pick = async () => {
    if (lock.current || blocked || readOnly) return;
    const controller = new AbortController();
    uploadController.current = controller;
    lock.current = true;
    setLocked(true);
    setUploading(true);
    setError(null);
    try {
      const value = await pickCredentialFile(companyCode, controller.signal);
      if (!controller.signal.aborted && value) setUpload(value);
    } catch (err) {
      if (!controller.signal.aborted) setError(messageOf(err));
    } finally {
      if (!controller.signal.aborted) {
        lock.current = false;
        setLocked(false);
        setUploading(false);
      }
    }
  };

  const selectedEmployee =
    employees.find((e) => e._id === draft.employeeId) ||
    (item && item.employeeId === draft.employeeId
      ? { _id: item.employeeId, displayName: item.employeeName, email: "" }
      : null);

  const save = async () => {
    if (lock.current || blocked || readOnly) return;
    let payload;
    try {
      payload = credentialPayload(draft, employees, item);
    } catch (err) {
      setError(messageOf(err));
      return;
    }
    const patch = { ...(item ? credentialChanges(payload, item) : payload), ...upload };
    if (!Object.keys(patch).length) {
      onClose();
      return;
    }
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const saved = item
        ? await credentials.update(companyCode, item._id, patch)
        : await credentials.create(companyCode, { ...payload, ...upload });
      if (!saved?._id) throw new Error("Chưa xác nhận được kết quả lưu.");
      onClose();
    } catch (err) {
      const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
      if (!status || status >= 500 || status === 409) {
        setBlocked(true);
        setError(`${messageOf(err)} Đóng và tải lại danh sách trước khi gửi tiếp.`);
      } else {
        setError(messageOf(err));
      }
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };

  const disabled = busy || blocked || uploading || readOnly;

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
      {/* Top Navigation Bar */}
      <View style={styles.navBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.navTitle}>
            {readOnly
              ? "Chi tiết chứng chỉ"
              : item
              ? "Chi tiết & Sửa chứng chỉ"
              : "Thêm chứng chỉ mới"}
          </Text>
          <Text style={styles.navSubtitle} numberOfLines={1}>
            {item ? item.name : "Điền thông tin và tải lên tài liệu"}
          </Text>
        </View>
        <Pressable
          onPress={onClose}
          disabled={busy || uploading}
          hitSlop={10}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.formScroll}
        contentContainerStyle={styles.formContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Error Alert */}
        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        )}

        {/* Section 1: Nhân viên & Loại */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Nhân viên & Loại chứng chỉ</Text>

          {/* Chọn nhân viên */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Nhân viên sở hữu {!readOnly && <Text style={styles.requiredAsterisk}>*</Text>}
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.selectButton,
                selectedEmployee && styles.selectButtonFilled,
                readOnly && styles.selectButtonReadOnly,
                pressed && !readOnly && { opacity: 0.8 },
              ]}
              disabled={disabled}
              onPress={() => !readOnly && setEmployeeModalOpen(true)}
            >
              <View style={[styles.selectAvatarCircle, selectedEmployee && styles.selectAvatarCircleFilled]}>
                <Text style={[styles.selectAvatarText, selectedEmployee && styles.selectAvatarTextFilled]}>
                  {selectedEmployee
                    ? (selectedEmployee.displayName || selectedEmployee.email || "NV")[0].toUpperCase()
                    : "👤"}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                {selectedEmployee ? (
                  <>
                    <Text style={styles.selectButtonTitle}>
                      {selectedEmployee.displayName || selectedEmployee.email}
                    </Text>
                    {selectedEmployee.email ? (
                      <Text style={styles.selectButtonSubtitle}>{selectedEmployee.email}</Text>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.selectButtonPlaceholder}>Bấm để chọn nhân viên trong danh sách...</Text>
                )}
              </View>
              {!readOnly && (
                <View style={styles.selectChevronBadge}>
                  <Text style={styles.selectButtonChevron}>Chọn ▼</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Loại chứng chỉ */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Phân loại chứng chỉ {!readOnly && <Text style={styles.requiredAsterisk}>*</Text>}
            </Text>
            <View style={styles.typeGrid}>
              {Object.entries(credentialTypes).map(([typeKey, typeLabel]) => {
                const isSelected = draft.type === typeKey;
                if (readOnly && !isSelected) return null;
                return (
                  <Pressable
                    key={typeKey}
                    style={[
                      styles.typeChip,
                      isSelected && styles.typeChipSelected,
                      readOnly && { opacity: 1 },
                    ]}
                    disabled={disabled}
                    onPress={() => !readOnly && setDraft((c) => ({ ...c, type: typeKey as Credential["type"] }))}
                  >
                    <Text style={[styles.typeChipText, isSelected && styles.typeChipTextSelected]}>
                      {isSelected ? "✓ " : ""}
                      {typeLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Section 2: Thông tin chứng chỉ */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Thông tin chi tiết</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Tên văn bằng / chứng chỉ {!readOnly && <Text style={styles.requiredAsterisk}>*</Text>}
            </Text>
            <TextInput
              style={[styles.input, readOnly && styles.inputReadOnly]}
              placeholder="VD: Chứng chỉ hành nghề Khám chữa bệnh"
              placeholderTextColor="#94a3b8"
              value={draft.name}
              editable={!disabled}
              onChangeText={(v) => setDraft((c) => ({ ...c, name: v }))}
            />
          </View>

          <View style={styles.rowTwoCols}>
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Số hiệu chứng chỉ</Text>
              <TextInput
                style={[styles.input, readOnly && styles.inputReadOnly]}
                placeholder="VD: 012345/BYT-CCHN"
                placeholderTextColor="#94a3b8"
                value={draft.credentialNumber}
                editable={!disabled}
                onChangeText={(v) => setDraft((c) => ({ ...c, credentialNumber: v }))}
              />
            </View>

            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>
                Nơi cấp {!readOnly && <Text style={styles.requiredAsterisk}>*</Text>}
              </Text>
              <TextInput
                style={[styles.input, readOnly && styles.inputReadOnly]}
                placeholder="VD: Sở Y tế Hà Nội"
                placeholderTextColor="#94a3b8"
                value={draft.issuingOrganization}
                editable={!disabled}
                onChangeText={(v) => setDraft((c) => ({ ...c, issuingOrganization: v }))}
              />
            </View>
          </View>

          {/* Ngày cấp & Ngày hết hạn */}
          <View style={styles.rowTwoCols}>
            {/* Ngày cấp */}
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>
                Ngày cấp {!readOnly && <Text style={styles.requiredAsterisk}>*</Text>}
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.datePickerBtn,
                  draft.issueDate ? styles.datePickerBtnFilled : null,
                  readOnly && styles.selectButtonReadOnly,
                  pressed && !readOnly && { opacity: 0.8 },
                ]}
                disabled={disabled}
                onPress={() => !readOnly && setIssueDatePickerOpen(true)}
              >
                <Text style={styles.datePickerIcon}>📅</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.datePickerValue,
                      !draft.issueDate && styles.datePickerPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {draft.issueDate
                      ? draft.issueDate.split("-").reverse().join("/")
                      : "Chưa có"}
                  </Text>
                  {draft.issueDate ? (
                    <Text style={styles.datePickerSub}>{draft.issueDate}</Text>
                  ) : null}
                </View>
                {!readOnly && <Text style={styles.datePickerChevron}>▼</Text>}
              </Pressable>
            </View>

            {/* Ngày hết hạn */}
            <View style={[styles.fieldGroup, { flex: 1 }]}>
              <Text style={styles.fieldLabel}>Ngày hết hạn</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.datePickerBtn,
                  draft.expiryDate ? styles.datePickerBtnFilled : null,
                  readOnly && styles.selectButtonReadOnly,
                  pressed && !readOnly && { opacity: 0.8 },
                ]}
                disabled={disabled}
                onPress={() => !readOnly && setExpiryDatePickerOpen(true)}
              >
                <Text style={styles.datePickerIcon}>📅</Text>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.datePickerValue,
                      !draft.expiryDate && styles.datePickerPlaceholder,
                    ]}
                    numberOfLines={1}
                  >
                    {draft.expiryDate
                      ? draft.expiryDate.split("-").reverse().join("/")
                      : "Vô thời hạn"}
                  </Text>
                  {draft.expiryDate ? (
                    <Text style={styles.datePickerSub}>{draft.expiryDate}</Text>
                  ) : null}
                </View>
                {!readOnly && draft.expiryDate ? (
                  <Pressable
                    onPress={(e) => {
                      e.stopPropagation?.();
                      setDraft((c) => ({ ...c, expiryDate: "" }));
                    }}
                    hitSlop={6}
                    style={styles.clearDateBtn}
                  >
                    <Text style={styles.clearDateText}>✕</Text>
                  </Pressable>
                ) : !readOnly ? (
                  <Text style={styles.datePickerChevron}>▼</Text>
                ) : null}
              </Pressable>
            </View>
          </View>
          {!readOnly && (
            <Text style={styles.helperText}>
              💡 Để trống ngày hết hạn nếu văn bằng/chứng chỉ có giá trị vĩnh viễn (không thời hạn).
            </Text>
          )}

          {/* Nhắc trước hạn */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Cảnh báo trước hạn (ngày)</Text>
            <View style={styles.reminderRow}>
              <TextInput
                style={[styles.input, { width: 85, textAlign: "center" }, readOnly && styles.inputReadOnly]}
                keyboardType="numeric"
                value={draft.reminderDays}
                editable={!disabled}
                onChangeText={(v) => setDraft((c) => ({ ...c, reminderDays: v }))}
              />
              {!readOnly && (
                <View style={styles.quickDaysRow}>
                  {[15, 30, 60, 90].map((days) => (
                    <Pressable
                      key={days}
                      style={[
                        styles.quickDayChip,
                        draft.reminderDays === String(days) && styles.quickDayChipActive,
                      ]}
                      onPress={() => setDraft((c) => ({ ...c, reminderDays: String(days) }))}
                    >
                      <Text
                        style={[
                          styles.quickDayChipText,
                          draft.reminderDays === String(days) && styles.quickDayChipTextActive,
                        ]}
                      >
                        {days} ngày
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Section 3: Phạm vi & Ghi chú */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Chuyên môn & Ghi chú</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Phạm vi hoạt động chuyên môn</Text>
            <TextInput
              style={[styles.input, styles.textArea, readOnly && styles.inputReadOnly]}
              placeholder={readOnly ? "—" : "VD: Khám bệnh, chữa bệnh nội khoa..."}
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
              value={draft.professionalScope}
              editable={!disabled}
              onChangeText={(v) => setDraft((c) => ({ ...c, professionalScope: v }))}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Ghi chú thêm</Text>
            <TextInput
              style={[styles.input, styles.textArea, readOnly && styles.inputReadOnly]}
              placeholder={readOnly ? "—" : "Ghi chú nội bộ về hồ sơ này..."}
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={2}
              value={draft.note}
              editable={!disabled}
              onChangeText={(v) => setDraft((c) => ({ ...c, note: v }))}
            />
          </View>
        </View>

        {/* Section 4: Tài liệu đính kèm */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>4. Tài liệu đính kèm</Text>

          {/* Tải và mở tài liệu đã lưu trực tiếp */}
          {item?.fileUrl && (
            <View style={{ marginBottom: 8 }}>
              <ContractFiles
                title="Tài liệu đã lưu"
                files={[
                  {
                    url: item.fileUrl,
                    name: item.fileName || "chung-chi",
                    size: item.fileSize,
                    mimeType: item.fileMimeType,
                    resourceId: item.resourceId,
                  },
                ]}
              />
            </View>
          )}

          {upload && (
            <View style={styles.fileCard}>
              <Text style={styles.fileIcon}>📄</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {upload.fileName || "Tệp mới chọn"}
                </Text>
                <Text style={styles.fileStatus}>Tệp mới chọn (sẽ lưu khi bấm Xác nhận)</Text>
              </View>
              <Pressable
                style={styles.removeFileBtn}
                disabled={disabled}
                onPress={() => setUpload(null)}
              >
                <Text style={styles.removeFileText}>✕ Bỏ</Text>
              </Pressable>
            </View>
          )}

          {!readOnly && (
            <>
              <Text style={styles.helperText}>
                Hỗ trợ 1 tệp dạng PDF, JPG, PNG hoặc WebP dung lượng tối đa 10 MB.
              </Text>
              <Pressable
                style={({ pressed }) => [
                  styles.uploadDropzone,
                  uploading && styles.uploadDropzoneBusy,
                  pressed && { opacity: 0.8 },
                ]}
                disabled={disabled}
                onPress={() => void pick()}
              >
                {uploading ? (
                  <View style={styles.uploadLoadingRow}>
                    <ActivityIndicator size="small" color="#059669" />
                    <Text style={styles.uploadDropzoneText}>Đang xử lý tệp tin...</Text>
                  </View>
                ) : (
                  <Text style={styles.uploadDropzoneText}>
                    📎 {upload || item?.fileUrl ? "Chọn tệp khác để thay thế" : "Bấm để chọn tệp tài liệu từ thiết bị"}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>

      {/* Sticky Bottom Action Bar */}
      <View style={styles.actionBar}>
        {onDelete && (
          <Pressable
            style={({ pressed }) => [styles.deleteActionBtn, pressed && { opacity: 0.7 }]}
            disabled={busy || uploading}
            onPress={onDelete}
          >
            <Text style={styles.deleteActionBtnText}>🗑️ Xóa</Text>
          </Pressable>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.cancelBtn,
            readOnly && styles.closeOnlyBtn,
            pressed && { opacity: 0.7 },
          ]}
          disabled={busy || uploading}
          onPress={onClose}
        >
          <Text style={styles.cancelBtnText}>{readOnly ? "Đóng" : "Hủy"}</Text>
        </Pressable>

        {!readOnly && (
          <Pressable
            style={({ pressed }) => [
              styles.saveBtn,
              disabled && styles.saveBtnDisabled,
              pressed && { opacity: 0.85 },
            ]}
            disabled={disabled}
            onPress={() => void save()}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveBtnText}>💾 Lưu chứng chỉ</Text>
            )}
          </Pressable>
        )}
      </View>

      {/* Modern Bottom Sheet Chọn nhân viên */}
      {!readOnly && (
        <EmployeeSelectModal
          visible={employeeModalOpen}
          onClose={() => setEmployeeModalOpen(false)}
          employees={employees}
          selectedId={draft.employeeId}
          onSelect={(emp) => {
            setDraft((c) => ({ ...c, employeeId: emp._id }));
          }}
          title="Chọn nhân sự cấp chứng chỉ"
        />
      )}

      {/* Modal Chọn Ngày cấp */}
      {!readOnly && (
        <DatePickerModal
          visible={issueDatePickerOpen}
          onClose={() => setIssueDatePickerOpen(false)}
          value={draft.issueDate}
          onChange={(val) => setDraft((c) => ({ ...c, issueDate: val }))}
          title="Chọn ngày cấp chứng chỉ"
        />
      )}

      {/* Modal Chọn Ngày hết hạn */}
      {!readOnly && (
        <DatePickerModal
          visible={expiryDatePickerOpen}
          onClose={() => setExpiryDatePickerOpen(false)}
          value={draft.expiryDate}
          onChange={(val) => setDraft((c) => ({ ...c, expiryDate: val }))}
          title="Chọn ngày hết hạn"
          allowClear={true}
          baseDateForShortcuts={draft.issueDate}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  navSubtitle: {
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
  closeBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748b",
  },
  formScroll: {
    flex: 1,
  },
  formContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 24,
  },
  errorCard: {
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: "#be123c",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  requiredAsterisk: {
    color: "#e11d48",
  },
  input: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
  },
  inputReadOnly: {
    backgroundColor: "#f1f5f9",
    color: "#334155",
    borderColor: "#e2e8f0",
  },
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
    minHeight: 46,
  },
  datePickerBtnFilled: {
    borderColor: "#059669",
    backgroundColor: "#f0fdf4",
  },
  datePickerIcon: {
    fontSize: 15,
  },
  datePickerValue: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  datePickerSub: {
    fontSize: 10,
    color: "#64748b",
  },
  datePickerPlaceholder: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
  },
  datePickerChevron: {
    fontSize: 11,
    color: "#64748b",
  },
  clearDateBtn: {
    padding: 4,
    backgroundColor: "#fee2e2",
    borderRadius: 8,
  },
  clearDateText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#ef4444",
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  helperText: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 17,
  },
  rowTwoCols: {
    flexDirection: "row",
    gap: 10,
  },
  selectButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  selectButtonFilled: {
    borderColor: "#059669",
    backgroundColor: "#f0fdf4",
  },
  selectButtonReadOnly: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  selectAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  selectAvatarCircleFilled: {
    backgroundColor: "#059669",
  },
  selectAvatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475569",
  },
  selectAvatarTextFilled: {
    color: "#ffffff",
  },
  selectButtonTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  selectButtonSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  selectButtonPlaceholder: {
    fontSize: 14,
    color: "#94a3b8",
  },
  selectChevronBadge: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  selectButtonChevron: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeChip: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  typeChipSelected: {
    backgroundColor: "#ecfdf5",
    borderColor: "#059669",
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  typeChipTextSelected: {
    color: "#059669",
    fontWeight: "700",
  },
  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  quickDaysRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    flex: 1,
  },
  quickDayChip: {
    backgroundColor: "#f1f5f9",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  quickDayChipActive: {
    backgroundColor: "#059669",
  },
  quickDayChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#475569",
  },
  quickDayChipTextActive: {
    color: "#ffffff",
  },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  fileIcon: {
    fontSize: 22,
  },
  fileName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  fileStatus: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  removeFileBtn: {
    backgroundColor: "#fff1f2",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  removeFileText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#be123c",
  },
  uploadDropzone: {
    borderWidth: 1.5,
    borderColor: "#059669",
    borderStyle: "dashed",
    borderRadius: 10,
    backgroundColor: "#f0fdf4",
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  uploadDropzoneBusy: {
    opacity: 0.6,
  },
  uploadDropzoneText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#059669",
  },
  uploadLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 12,
  },
  deleteActionBtn: {
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  deleteActionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#be123c",
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  closeOnlyBtn: {
    backgroundColor: "#059669",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  saveBtn: {
    flex: 2,
    backgroundColor: "#059669",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  saveBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
});
