import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import {
  Briefcase,
  Check,
  DollarSign,
  FileText,
  Info,
  MapPin,
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

export function JobForm({
  job,
  onClose,
  setLocked,
}: {
  job?: RecruitmentJob;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const { showAlert, alertView } = useAppAlert();
  const [draft, setDraft] = useState(() => jobDraft(job));
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
      if (file) setDraft((current) => ({ ...current, jdFileUrl: file.url }));
    } catch (error) {
      showAlert("Lỗi tải tệp", messageOf(error), undefined, "error");
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };

  const save = async () => {
    if (lock.current) return;
    const missing: string[] = [];
    if (!draft.code.trim()) missing.push("• Mã tin tuyển dụng");
    if (!draft.title.trim()) missing.push("• Tiêu đề tin tuyển dụng");
    if (!draft.headcount.trim()) {
      missing.push("• Số lượng tuyển");
    } else {
      const hc = Number(draft.headcount);
      if (!Number.isInteger(hc) || hc < 1) missing.push("• Số lượng tuyển (phải là số nguyên dương)");
    }
    if (!draft.employmentType.trim()) missing.push("• Loại hợp đồng");

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
      onClose();
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
          label="Mã tin tuyển dụng *"
          value={draft.code}
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, code: value }))}
        />
        <Field
          label="Tiêu đề công việc *"
          value={draft.title}
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, title: value }))}
        />
        <Field
          label="Phòng ban / Khoa"
          value={draft.department}
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, department: value }))}
        />
        <Field
          label="Số lượng cần tuyển *"
          value={draft.headcount}
          keyboardType="numeric"
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, headcount: value }))}
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
          label="Mô tả công việc"
          value={draft.description}
          multiline
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, description: value }))}
        />
        <Field
          label="Yêu cầu ứng viên"
          value={draft.requirements}
          multiline
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, requirements: value }))}
        />
        <Field
          label="Quyền lợi & đãi ngộ"
          value={draft.benefits}
          multiline
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, benefits: value }))}
        />
      </View>

      {/* Section 3: Lương & Hợp đồng */}
      <View style={formStyles.sectionCard}>
        <View style={formStyles.sectionHeader}>
          <View style={formStyles.sectionIconBox}>
            <DollarSign size={15} color="#059669" />
          </View>
          <Text style={formStyles.sectionTitle}>Mức lương & Hợp đồng</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Lương tối thiểu (VNĐ)"
              value={draft.salaryMin}
              keyboardType="numeric"
              editable={!disabled}
              onChangeText={(value) => setDraft((c) => ({ ...c, salaryMin: value }))}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Lương tối đa (VNĐ)"
              value={draft.salaryMax}
              keyboardType="numeric"
              editable={!disabled}
              onChangeText={(value) => setDraft((c) => ({ ...c, salaryMax: value }))}
            />
          </View>
        </View>

        <View style={formStyles.switchRow}>
          <View style={{ flex: 1 }}>
            <Text style={formStyles.switchLabel}>Công khai mức lương</Text>
            <Text style={formStyles.switchDesc}>Cho phép ứng viên nhìn thấy dải lương</Text>
          </View>
          <Switch
            value={draft.showSalary}
            disabled={disabled}
            onValueChange={(value) => setDraft((c) => ({ ...c, showSalary: value }))}
            trackColor={{ false: "#cbd5e1", true: "#a7f3d0" }}
            thumbColor={draft.showSalary ? "#059669" : "#f8fafc"}
          />
        </View>

        <ChoiceField
          label="Loại hợp đồng *"
          value={draft.employmentType}
          disabled={disabled}
          choices={[
            { value: "full_time", label: "Toàn thời gian (Full-time)" },
            { value: "part_time", label: "Bán thời gian (Part-time)" },
            { value: "contract", label: "Hợp đồng (Contract)" },
            { value: "internship", label: "Thực tập (Internship)" },
            { value: "seasonal", label: "Thời vụ" },
          ]}
          onChange={(value) => setDraft((c) => ({ ...c, employmentType: value }))}
        />

        <ChoiceField
          label="Hình thức làm việc"
          value={draft.workplaceType}
          choices={[
            { value: "onsite", label: "Tại văn phòng / Cơ sở" },
            { value: "hybrid", label: "Kết hợp linh hoạt (Hybrid)" },
            { value: "remote", label: "Từ xa (Remote)" },
          ]}
          disabled={disabled}
          onChange={(value) => setDraft((c) => ({ ...c, workplaceType: value }))}
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

        <Field
          label="Địa điểm làm việc"
          value={draft.location}
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, location: value }))}
        />
        <Field
          label="Hạn nộp hồ sơ (YYYY-MM-DD HH:mm)"
          value={draft.deadline}
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, deadline: value }))}
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

        <Field
          label="Liên kết JD công khai"
          value={draft.jdFileUrl}
          editable={!disabled}
          onChangeText={(value) => setDraft((c) => ({ ...c, jdFileUrl: value }))}
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
