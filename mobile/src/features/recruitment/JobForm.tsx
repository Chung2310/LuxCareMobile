import { RecruitmentDepartmentField } from "./RecruitmentDepartmentField";
import { RecruitmentDateField } from "./RecruitmentDateField";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Briefcase,
  Check,
  FileText,
  Info,
  MapPin,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react-native";
import type { RecruitmentJob } from "../../../../src/types/recruitment";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { useAppAlert } from "../../components/AppAlert";
import { Field } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { RecruitmentModal } from "./RecruitmentModal";
import { jobDraft, jobPayload } from "./jobModel";
import { usePublicUpload } from "./usePublicUpload";

function getFileNameFromUrl(url?: string | null): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const lastPart = parsed.pathname.split("/").filter(Boolean).pop() || "";
    const decoded = decodeURIComponent(lastPart);
    return decoded.replace(/^[0-9a-fA-F-]{36}-?/, "") || decoded;
  } catch {
    const clean = url.split("/").pop()?.split("?")[0] || "";
    try { return decodeURIComponent(clean) || url; } catch { return clean || url; }
  }
}

export function JobForm({
  job,
  onClose,
  onSaved,
  setLocked,
}: {
  job?: RecruitmentJob;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
  setLocked: (value: boolean) => void;
}) {
  const { showAlert, alertView } = useAppAlert();
  const [draft, setDraft] = useState(() => jobDraft(job));
  const [jdFileName, setJdFileName] = useState(() => getFileNameFromUrl(job?.jdFileUrl));
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const lock = useRef(false);
  const publicFile = usePublicUpload();

  const upload = async () => {
    if (lock.current || blocked) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    try {
      const file = await publicFile.pick();
      if (file) {
        setDraft((current) => ({ ...current, jdFileUrl: file.url }));
        setJdFileName(file.originalName || getFileNameFromUrl(file.url));
      }
    } catch (error) {
      showAlert("Lỗi tải tệp", messageOf(error), undefined, "error");
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };

  const save = async () => {
    if (lock.current || blocked) return;
    const missing: string[] = [];
    if (!draft.code.trim()) missing.push("• Mã tin tuyển dụng");
    if (!draft.title.trim()) missing.push("• Tiêu đề tin tuyển dụng");
    if (!draft.headcount.trim()) {
      missing.push("• Số lượng tuyển");
    } else {
      const hc = Number(draft.headcount);
      if (!Number.isInteger(hc) || hc < 1) missing.push("• Số lượng tuyển (phải là số nguyên dương)");
    }

    if (missing.length > 0) {
      showAlert(
        "Thiếu thông tin bắt buộc",
        `Vui lòng nhập đầy đủ các trường sau trước khi lưu tin tuyển dụng:\n\n${missing.join("\n")}`,
        undefined,
        "error",
      );
      return;
    }

    let payload: Partial<RecruitmentJob>;
    try {
      payload = jobPayload(draft, job);
      Object.assign(payload, publicFile.uploads.patch("job", draft.jdFileUrl));
    } catch (error) {
      const msg = messageOf(error);
      showAlert("Thông tin chưa hợp lệ", msg, undefined, "error");
      return;
    }
    lock.current = true;
    setBusy(true);
    setLocked(true);
    publicFile.uploads.dispatched(draft.jdFileUrl);
    try {
      if (job) await recruitment.updateJob(job._id, { ...payload, version: job.version });
      else await recruitment.createJob(payload);
      setLocked(false);
      if (onSaved) await onSaved();
      else onClose();
    } catch (error) {
      const msg = messageOf(error);
      const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
      if (!status || status >= 500 || status === 409 || /phiên bản|version/i.test(msg)) {
        setBlocked(true);
        showAlert(
          "Không thể lưu tin tuyển dụng",
          `${msg}\nVui lòng đóng và tải lại danh sách trước khi lưu tiếp.`,
          [{ text: "Đã hiểu" }],
          "error",
        );
      } else {
        showAlert("Không thể lưu tin tuyển dụng", msg, [{ text: "Đã hiểu" }], "error");
      }
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };

  const disabled = busy || blocked;

  return (
    <RecruitmentModal
      title={job ? `Sửa tin tuyển dụng: ${job.code}` : "Tạo tin tuyển dụng mới"}
      subtitle={
        job
          ? "Cập nhật thông tin chi tiết tin tuyển dụng"
          : "Điền thông tin để đăng tuyển vị trí mới"
      }
      visible
      onClose={onClose}
    >
      {/* Tip Banner */}
      <View style={formStyles.tipBanner}>
        <Info size={16} color="#0284c7" />
        <Text style={formStyles.tipBannerText}>
          {job
            ? "Giữ nguyên trạng thái hiện tại khi lưu. Bạn có thể mở hoặc đóng tin ở danh sách ngoài."
            : "Tin mới tạo sẽ ở dạng bản nháp. Hãy kiểm tra kỹ trước khi kích hoạt mở tuyển."}
        </Text>
      </View>

      {/* Section 1: Thông tin cơ bản */}
      <View style={formStyles.sectionCard}>
        <View style={formStyles.sectionHeader}>
          <View style={formStyles.sectionIconBox}>
            <Briefcase size={15} color="#059669" />
          </View>
          <Text style={formStyles.sectionTitle}>Thông tin cơ bản</Text>
        </View>

        <Field
          label="Mã tin *"
          value={draft.code}
          editable={!disabled && !job}
          onChangeText={(value) => setDraft((c) => ({ ...c, code: value }))}
        />
        <Field
          label="Tên vị trí *"
          value={draft.title}
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, title: value }))}
        />
        <RecruitmentDepartmentField value={draft.department} disabled={disabled}
          onChange={(value) => setDraft((c) => ({ ...c, department: value }))} />
        <Field
          label="Số lượng *"
          value={draft.headcount}
          keyboardType="numeric"
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, headcount: value }))}
        />
      </View>

      {/* Section 4: Thời gian & Địa điểm */}
      <View style={formStyles.sectionCard}>
        <View style={formStyles.sectionHeader}>
          <View style={formStyles.sectionIconBox}>
            <MapPin size={15} color="#059669" />
          </View>
          <Text style={formStyles.sectionTitle}>Thời gian & Địa điểm</Text>
        </View>

        <ChoiceField
          label="Hình thức nơi làm việc"
          value={draft.workplaceType}
          choices={[
            { value: "onsite", label: "Tại văn phòng" },
            { value: "hybrid", label: "Kết hợp" },
            { value: "remote", label: "Từ xa" },
          ]}
          disabled={disabled}
          onChange={(value) => setDraft((c) => ({ ...c, workplaceType: value }))}
        />

        <Field
          label="Địa điểm"
          value={draft.location}
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, location: value }))}
        />
        <RecruitmentDateField
          label="Hạn ứng tuyển"
          value={draft.deadline}
          disabled={disabled}
          onChange={(value) => setDraft((c) => ({ ...c, deadline: value }))}
        />
      </View>

      {/* Section 2: Chi tiết công việc */}
      <View style={formStyles.sectionCard}>
        <View style={formStyles.sectionHeader}>
          <View style={formStyles.sectionIconBox}>
            <FileText size={15} color="#059669" />
          </View>
          <Text style={formStyles.sectionTitle}>Mô tả & Yêu cầu</Text>
        </View>

        <Field
          label="Mô tả"
          value={draft.description}
          multiline
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, description: value }))}
        />
        <Field
          label="Yêu cầu"
          value={draft.requirements}
          multiline
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, requirements: value }))}
        />
        <Field
          label="Quyền lợi"
          value={draft.benefits}
          multiline
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, benefits: value }))}
        />
      </View>

      {/* Section 5: Tài liệu JD đính kèm */}
      <View style={formStyles.sectionCard}>
        <View style={formStyles.sectionHeader}>
          <View style={formStyles.sectionIconBox}>
            <UploadCloud size={15} color="#059669" />
          </View>
          <Text style={formStyles.sectionTitle}>Tệp mô tả công việc (JD)</Text>
        </View>

        <Text style={formStyles.fieldNote}>
          Đính kèm bản mô tả JD công khai (PDF, DOC, DOCX tối đa 10 MB) để ứng viên có thể tải về trực tiếp.
        </Text>

        {draft.jdFileUrl ? (
          <View style={formStyles.fileAttachedCard}>
            <View style={formStyles.fileAttachedIcon}>
              <FileText size={20} color="#0284c7" />
            </View>
            <View style={formStyles.fileAttachedMeta}>
              <Text style={formStyles.fileAttachedName} numberOfLines={1}>
                {jdFileName || getFileNameFromUrl(draft.jdFileUrl)}
              </Text>
              <Text style={formStyles.fileAttachedStatus}>Đã đính kèm tệp JD</Text>
            </View>
            {!disabled && (
              <View style={formStyles.fileAttachedActions}>
                <Pressable
                  style={({ pressed }) => [formStyles.replaceFileBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => void upload()}
                >
                  <Text style={formStyles.replaceFileBtnText}>Đổi tệp</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Xóa tệp đính kèm"
                  style={({ pressed }) => [formStyles.removeFileBtn, pressed && { opacity: 0.7 }]}
                  onPress={() => {
                    setDraft((c) => ({ ...c, jdFileUrl: "" }));
                    setJdFileName("");
                  }}
                >
                  <Trash2 size={15} color="#dc2626" />
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <Pressable
              style={({ pressed }) => [
                formStyles.uploadBtn,
                disabled && { opacity: 0.6 },
                pressed && !disabled && { opacity: 0.8 },
              ]}
              disabled={disabled}
              onPress={() => void upload()}
            >
              <UploadCloud size={16} color="#0284c7" />
              <Text style={formStyles.uploadBtnText}>Chọn và tải tệp JD lên</Text>
            </Pressable>

          </View>
        )}
        <Field
          label="Link JD"
          value={draft.jdFileUrl}
          editable={!disabled}
          autoCapitalize="none"
          keyboardType="url"
          onChangeText={(value) => {
            setDraft((c) => ({ ...c, jdFileUrl: value }));
            setJdFileName(getFileNameFromUrl(value));
          }}
        />
      </View>

      {/* Action Buttons */}
      <View style={formStyles.actionsRow}>
        <Pressable
          style={({ pressed }) => [formStyles.cancelBtn, pressed && { opacity: 0.7 }]}
          disabled={busy}
          onPress={onClose}
        >
          <X size={15} color="#475569" />
          <Text style={formStyles.cancelBtnText}>Hủy</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            formStyles.submitBtn,
            disabled && { opacity: 0.6 },
            pressed && !disabled && { opacity: 0.85 },
          ]}
          disabled={disabled}
          onPress={() => void save()}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Check size={16} color="#ffffff" />
          )}
          <Text style={formStyles.submitBtnText}>
            {busy ? "Đang lưu..." : job ? "Lưu thay đổi" : "Tạo tin tuyển dụng"}
          </Text>
        </Pressable>
      </View>

      {alertView}
    </RecruitmentModal>
  );
}

const formStyles = StyleSheet.create({
  tipBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f0f9ff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  tipBannerText: {
    fontSize: 12,
    color: "#0369a1",
    lineHeight: 18,
    flex: 1,
  },
  sectionCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 14,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sectionIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f8fafc",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  switchLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1e293b",
  },
  switchDesc: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  fieldNote: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 16,
  },
  uploadBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0284c7",
  },
  fileAttachedCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f9ff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  fileAttachedIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
  },
  fileAttachedMeta: {
    flex: 1,
  },
  fileAttachedName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0369a1",
  },
  fileAttachedStatus: {
    fontSize: 11,
    color: "#0284c7",
    marginTop: 2,
  },
  fileAttachedActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  replaceFileBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#bae6fd",
    borderRadius: 8,
  },
  replaceFileBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0284c7",
  },
  removeFileBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fecaca",
    alignItems: "center",
    justifyContent: "center",
  },
  manualLinkToggle: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  manualLinkToggleText: {
    fontSize: 12,
    color: "#0284c7",
    fontWeight: "600",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
  },
  submitBtn: {
    flex: 1.8,
    height: 46,
    borderRadius: 12,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  submitBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },
});
