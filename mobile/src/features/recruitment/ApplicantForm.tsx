import { RecruitmentDateField } from "./RecruitmentDateField";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Award,
  Briefcase,
  CalendarCheck,
  Check,
  GraduationCap,
  Info,
  User,
  X,
} from "lucide-react-native";
import type { RecruitmentApplicant, RecruitmentJob } from "../../../../src/types/recruitment";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { useAppAlert } from "../../components/AppAlert";
import { Field } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { RecruitmentModal } from "./RecruitmentModal";
import { dateInput, dateOnly, numericOrNull } from "./recruitmentModel";

type Draft = {
  jobId: string;
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  address: string;
  experience: string;
  education: string;
  skills: string;
  expectedSalary: string;
  availableDate: string;
  source: string;
  notes: string;
  cvUrl: string;
};

function draftOf(applicant?: RecruitmentApplicant, defaultJobId = ""): Draft {
  return {
    jobId: applicant?.jobId || defaultJobId || "",
    fullName: applicant?.fullName || "",
    email: applicant?.email || "",
    phone: applicant?.phone || "",
    birthDate: dateInput(applicant?.birthDate),
    address: applicant?.address || "",
    experience: applicant?.experience || "",
    education: applicant?.education || "",
    skills: applicant?.skills?.join(", ") || "",
    expectedSalary: applicant?.expectedSalary == null ? "" : String(applicant.expectedSalary),
    availableDate: dateInput(applicant?.availableDate),
    source: applicant?.source || "",
    notes: applicant?.notes || "",
    cvUrl: applicant?.cvUrl || "",
  };
}

export function ApplicantForm({
  applicant,
  jobs = [],
  jobId,
  onClose,
  onSaved,
  setLocked,
}: {
  applicant?: RecruitmentApplicant;
  jobs?: RecruitmentJob[];
  jobId?: string;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
  setLocked?: (value: boolean) => void;
}) {
  const { showAlert, alertView } = useAppAlert();
  const [draft, setDraft] = useState(() => draftOf(applicant, jobId));
  const [busy, setBusy] = useState(false);
  const update = (key: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = async (confirmDuplicate = false) => {
    if (busy) return;
    const missing: string[] = [];
    if (!draft.jobId) missing.push("• Vị trí ứng tuyển (tin tuyển dụng)");
    if (!draft.fullName.trim()) missing.push("• Họ tên ứng viên");

    if (missing.length > 0) {
      showAlert(
        "Thiếu thông tin bắt buộc",
        `Vui lòng nhập đầy đủ các trường sau trước khi lưu hồ sơ ứng viên:\n\n${missing.join("\n")}`,
        undefined,
        "error",
      );
      return;
    }

    setBusy(true);
    try {
      const payload = {
        jobId: draft.jobId,
        fullName: draft.fullName.trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        birthDate: dateOnly(draft.birthDate),
        address: draft.address.trim(),
        experience: draft.experience.trim(),
        education: draft.education.trim(),
        skills: draft.skills.split(",").map((item) => item.trim()).filter(Boolean),
        expectedSalary: numericOrNull(draft.expectedSalary, "Lương mong muốn"),
        availableDate: dateOnly(draft.availableDate),
        source: draft.source.trim(),
        notes: draft.notes.trim(),
        cvUrl: draft.cvUrl.trim(),
        cvPublicId: "",
      };
      if (applicant) {
        await recruitment.updateApplicant(applicant._id, { ...payload, version: applicant.version });
      } else {
        const result = await recruitment.createApplicant({ ...payload, confirmDuplicate });
        if (result?.duplicateWarning && !confirmDuplicate) {
          showAlert(
            "Có hồ sơ trùng",
            "LuxCare phát hiện hồ sơ có cùng email hoặc số điện thoại. Bạn có muốn vẫn tạo hồ sơ mới không?",
            [
              { text: "Quay lại", style: "cancel" },
              { text: "Vẫn tạo", onPress: () => void save(true) },
            ],
          );
          return;
        }
      }
      if (onSaved) {
        await onSaved();
      } else {
        onClose();
      }
    } catch (err) {
      const msg = messageOf(err);
      showAlert("Thông tin chưa hợp lệ", msg, undefined, "error");
    } finally {
      setBusy(false);
    }
  };

  const choices = jobs.map((job) => ({
    value: job._id,
    label: `${job.code} · ${job.title || "Chưa đặt tên"}${job.status !== "open" ? ` · ${job.status}` : ""}`,
  }));

  return (
    <RecruitmentModal
      title={applicant ? `Sửa hồ sơ: ${applicant.fullName}` : "Thêm ứng viên mới"}
      subtitle={
        applicant
          ? "Cập nhật thông tin chi tiết ứng viên"
          : "Tạo hồ sơ ứng tuyển mới vào hệ thống"
      }
      visible
      onClose={onClose}
    >
      {/* Tip Banner */}
      <View style={formStyles.tipBanner}>
        <Info size={16} color="#0284c7" />
        <Text style={formStyles.tipBannerText}>
          Hồ sơ mới cần gắn với một tin tuyển dụng đang mở. Bạn có thể đính kèm đường dẫn CV trực tuyến.
        </Text>
      </View>

      {/* Section 1: Vị trí ứng tuyển */}
      <View style={formStyles.sectionCard}>
        <View style={formStyles.sectionHeader}>
          <View style={formStyles.sectionIconBox}>
            <Briefcase size={15} color="#059669" />
          </View>
          <Text style={formStyles.sectionTitle}>Vị trí tuyển dụng</Text>
        </View>

        <ChoiceField
          label="Tin tuyển dụng *"
          value={draft.jobId}
          choices={choices}
          disabled={busy}
          onChange={(value) => update("jobId", value)}
        />
      </View>

      {/* Section 2: Thông tin cá nhân */}
      <View style={formStyles.sectionCard}>
        <View style={formStyles.sectionHeader}>
          <View style={formStyles.sectionIconBox}>
            <User size={15} color="#059669" />
          </View>
          <Text style={formStyles.sectionTitle}>Thông tin cá nhân</Text>
        </View>

        <Field
          label="Họ và tên *"
          value={draft.fullName}
          editable={!busy}
          onChangeText={(value) => update("fullName", value)}
        />
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Email"
              value={draft.email}
              keyboardType="email-address"
              editable={!busy}
              onChangeText={(value) => update("email", value)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Số điện thoại"
              value={draft.phone}
              keyboardType="phone-pad"
              editable={!busy}
              onChangeText={(value) => update("phone", value)}
            />
          </View>
        </View>

        <RecruitmentDateField
          label="Ngày sinh"
          value={draft.birthDate}
          disabled={busy}
          onChange={(value) => update("birthDate", value)}
        />
        <Field
          label="Địa chỉ liên hệ"
          value={draft.address}
          editable={!busy}
          onChangeText={(value) => update("address", value)}
        />
      </View>

      {/* Section 3: Học vấn & Kinh nghiệm */}
      <View style={formStyles.sectionCard}>
        <View style={formStyles.sectionHeader}>
          <View style={formStyles.sectionIconBox}>
            <GraduationCap size={15} color="#059669" />
          </View>
          <Text style={formStyles.sectionTitle}>Học vấn & Kỹ năng</Text>
        </View>

        <Field
          label="Kinh nghiệm làm việc"
          value={draft.experience}
          multiline
          editable={!busy}
          onChangeText={(value) => update("experience", value)}
        />
        <Field
          label="Trình độ học vấn"
          value={draft.education}
          multiline
          editable={!busy}
          onChangeText={(value) => update("education", value)}
        />
        <Field
          label="Kỹ năng chuyên môn (cách nhau dấu phẩy)"
          value={draft.skills}
          editable={!busy}
          onChangeText={(value) => update("skills", value)}
        />
      </View>

      {/* Section 4: Kỳ vọng & Tiếp nhận */}
      <View style={formStyles.sectionCard}>
        <View style={formStyles.sectionHeader}>
          <View style={formStyles.sectionIconBox}>
            <CalendarCheck size={15} color="#059669" />
          </View>
          <Text style={formStyles.sectionTitle}>Kỳ vọng & CV</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Lương mong muốn (VNĐ)"
              value={draft.expectedSalary}
              keyboardType="numeric"
              editable={!busy}
              onChangeText={(value) => update("expectedSalary", value)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <RecruitmentDateField
              label="Ngày nhận việc"
              value={draft.availableDate}
              disabled={busy}
              onChange={(value) => update("availableDate", value)}
            />
          </View>
        </View>

        <Field
          label="Nguồn ứng viên (Website, Giới thiệu, ...)"
          value={draft.source}
          editable={!busy}
          onChangeText={(value) => update("source", value)}
        />
        <Field
          label="Liên kết CV công khai (URL)"
          value={draft.cvUrl}
          keyboardType="url"
          editable={!busy}
          onChangeText={(value) => update("cvUrl", value)}
        />
        <Field
          label="Ghi chú thêm"
          value={draft.notes}
          multiline
          editable={!busy}
          onChangeText={(value) => update("notes", value)}
        />
      </View>

      {/* Actions Row */}
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
            busy && { opacity: 0.6 },
            pressed && !busy && { opacity: 0.85 },
          ]}
          disabled={busy}
          onPress={() => void save()}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Check size={16} color="#ffffff" />
          )}
          <Text style={formStyles.submitBtnText}>
            {busy ? "Đang lưu..." : applicant ? "Lưu thay đổi" : "Lưu hồ sơ"}
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
