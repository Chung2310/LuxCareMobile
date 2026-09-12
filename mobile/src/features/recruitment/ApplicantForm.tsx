import { useAppAlert } from "../../components/AppAlert";
import { Text } from "react-native";
import { useState } from "react";
import type { RecruitmentApplicant, RecruitmentJob } from "../../../../src/types/recruitment";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, ErrorText, Field, styles } from "../../ui";
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
  const [error, setError] = useState<string | null>(null);
  const update = (key: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = async (confirmDuplicate = false) => {
    if (busy) return;
    const missing: string[] = [];
    if (!draft.jobId) missing.push("• Tin tuyển dụng");
    if (!draft.fullName.trim()) missing.push("• Họ tên ứng viên");

    if (missing.length > 0) {
      showAlert(
        "Thiếu thông tin bắt buộc",
        `Vui lòng nhập đầy đủ các trường sau trước khi lưu hồ sơ ứng viên:\n\n${missing.join("\n")}`,
        undefined,
        "error",
      );
      setError("Vui lòng bổ sung các trường bắt buộc.");
      return;
    }

    setBusy(true);
    setError(null);
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
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const choices = jobs.map((job) => ({
    value: job._id,
    label: `${job.code} · ${job.title || "Chưa đặt tên"}${job.status !== "open" ? ` · ${job.status}` : ""}`,
  }));

  return (
    <RecruitmentModal title={applicant ? "Sửa hồ sơ ứng viên" : "Thêm ứng viên"} visible onClose={onClose}>
      <Text style={styles.muted}>
        Hồ sơ mới cần gắn với một tin tuyển dụng. CV có thể là đường dẫn HTTP/HTTPS công khai.
      </Text>
      <ChoiceField label="Tin tuyển dụng" value={draft.jobId} choices={choices} disabled={busy} onChange={(value) => update("jobId", value)} />
      <Field label="Họ tên" value={draft.fullName} editable={!busy} onChangeText={(value) => update("fullName", value)} />
      <Field label="Email" value={draft.email} keyboardType="email-address" editable={!busy} onChangeText={(value) => update("email", value)} />
      <Field label="Điện thoại" value={draft.phone} keyboardType="phone-pad" editable={!busy} onChangeText={(value) => update("phone", value)} />
      <Field label="Ngày sinh (YYYY-MM-DD)" value={draft.birthDate} editable={!busy} onChangeText={(value) => update("birthDate", value)} />
      <Field label="Địa chỉ" value={draft.address} editable={!busy} onChangeText={(value) => update("address", value)} />
      <Field label="Kinh nghiệm" value={draft.experience} multiline editable={!busy} onChangeText={(value) => update("experience", value)} />
      <Field label="Học vấn" value={draft.education} multiline editable={!busy} onChangeText={(value) => update("education", value)} />
      <Field label="Kỹ năng (phân cách bằng dấu phẩy)" value={draft.skills} editable={!busy} onChangeText={(value) => update("skills", value)} />
      <Field label="Lương mong muốn" value={draft.expectedSalary} keyboardType="numeric" editable={!busy} onChangeText={(value) => update("expectedSalary", value)} />
      <Field label="Ngày có thể nhận việc (YYYY-MM-DD)" value={draft.availableDate} editable={!busy} onChangeText={(value) => update("availableDate", value)} />
      <Field label="Nguồn ứng viên" value={draft.source} editable={!busy} onChangeText={(value) => update("source", value)} />
      <Field label="Ghi chú" value={draft.notes} multiline editable={!busy} onChangeText={(value) => update("notes", value)} />
      <Field label="Liên kết CV công khai" value={draft.cvUrl} keyboardType="url" editable={!busy} onChangeText={(value) => update("cvUrl", value)} />
      <ErrorText message={error} />
      <Button title={busy ? "Đang lưu..." : "Lưu hồ sơ"} disabled={busy} onPress={() => void save()} />
      <Button title="Hủy" disabled={busy} onPress={onClose} />
      {alertView}
    </RecruitmentModal>
  );
}
