import { Pressable, Text, View } from "react-native";
import { useState } from "react";
import type { RecruitmentApplicant, RecruitmentInterview, RecruitmentJob } from "../../../../src/types/recruitment";
import type { UserProfile } from "../../../../src/types/common";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { useAppAlert } from "../../components/AppAlert";
import { Button, ErrorText, Field, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { RecruitmentModal } from "./RecruitmentModal";
import { dateTime, dateTimeInput, INTERVIEW_STATUS_CHOICES } from "./recruitmentModel";

type Draft = {
  applicantId: string;
  jobId: string;
  scheduledStart: string;
  scheduledEnd: string;
  format: "onsite" | "online" | "phone";
  location: string;
  meetingLink: string;
  interviewerIds: string[];
  status: RecruitmentInterview["status"];
  result: string;
  notes: string;
};

function draftOf(interview?: RecruitmentInterview, applicantId = "", jobId = ""): Draft {
  return {
    applicantId: interview?.applicantId || applicantId,
    jobId: interview?.jobId || jobId,
    scheduledStart: dateTimeInput(interview?.scheduledStart),
    scheduledEnd: dateTimeInput(interview?.scheduledEnd),
    format: interview?.format || "onsite",
    location: interview?.location || "",
    meetingLink: interview?.meetingLink || "",
    interviewerIds: interview?.interviewerIds || [],
    status: interview?.status || "scheduled",
    result: interview?.result || "",
    notes: interview?.notes || "",
  };
}

export function InterviewForm({
  interview,
  applicantId,
  jobId,
  applicants = [],
  jobs = [],
  people = [],
  onClose,
  onSaved,
  setLocked,
}: {
  interview?: RecruitmentInterview;
  applicantId?: string;
  jobId?: string;
  applicants?: RecruitmentApplicant[];
  jobs?: RecruitmentJob[];
  people?: UserProfile[];
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
  setLocked?: (value: boolean) => void;
}) {
  const { showAlert, alertView } = useAppAlert();
  const [draft, setDraft] = useState(() => draftOf(interview, applicantId, jobId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (busy) return;
    const missing: string[] = [];
    if (!draft.applicantId) missing.push("• Ứng viên tham gia");
    const applicant = applicants.find((item) => item._id === draft.applicantId);
    const selectedJobId = draft.jobId || applicant?.jobId;
    if (!selectedJobId) missing.push("• Tin tuyển dụng của ứng viên");
    if (!draft.scheduledStart.trim()) missing.push("• Thời gian bắt đầu (YYYY-MM-DD HH:mm)");
    if (!draft.scheduledEnd.trim()) missing.push("• Thời gian kết thúc (YYYY-MM-DD HH:mm)");

    if (missing.length > 0) {
      showAlert(
        "Thiếu thông tin bắt buộc",
        `Vui lòng nhập đầy đủ các trường sau trước khi lên lịch phỏng vấn:\n\n${missing.join("\n")}`,
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
        applicantId: draft.applicantId,
        jobId: selectedJobId,
        scheduledStart: dateTime(draft.scheduledStart),
        scheduledEnd: dateTime(draft.scheduledEnd),
        format: draft.format,
        location: draft.location.trim(),
        meetingLink: draft.meetingLink.trim(),
        interviewerIds: draft.interviewerIds,
        status: draft.status,
        result: draft.result.trim(),
        notes: draft.notes.trim(),
      };
      if (interview) await recruitment.updateInterview(interview._id, { ...payload, version: interview.version });
      else await recruitment.createInterview(payload);
      if (onSaved) await onSaved();
      else onClose();
    } catch (err) {
      const msg = messageOf(err);
      showAlert("Thông tin chưa hợp lệ", msg, undefined, "error");
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <RecruitmentModal title={interview ? "Sửa lịch phỏng vấn" : "Lên lịch phỏng vấn"} visible onClose={onClose}>
      <ChoiceField
        label="Ứng viên"
        value={draft.applicantId}
        choices={applicants.map((item) => ({ value: item._id, label: item.fullName }))}
        disabled={busy || Boolean(interview)}
        onChange={(value) => {
          const applicant = applicants.find((item) => item._id === value);
          update("applicantId", value);
          if (applicant) update("jobId", applicant.jobId);
        }}
      />
      <Text style={styles.muted}>Vị trí: {jobs.find((job) => job._id === draft.jobId)?.title || "—"}</Text>
      <Field label="Bắt đầu (YYYY-MM-DD HH:mm)" value={draft.scheduledStart} editable={!busy} onChangeText={(value) => update("scheduledStart", value)} />
      <Field label="Kết thúc (YYYY-MM-DD HH:mm)" value={draft.scheduledEnd} editable={!busy} onChangeText={(value) => update("scheduledEnd", value)} />
      <ChoiceField
        label="Hình thức"
        value={draft.format}
        disabled={busy}
        choices={[
          { value: "onsite", label: "Tại văn phòng" },
          { value: "online", label: "Trực tuyến" },
          { value: "phone", label: "Điện thoại" },
        ]}
        onChange={(value) => update("format", value)}
      />
      <Field label={draft.format === "online" ? "Liên kết cuộc họp" : "Địa điểm"} value={draft.format === "online" ? draft.meetingLink : draft.location} editable={!busy} onChangeText={(value) => update(draft.format === "online" ? "meetingLink" : "location", value)} />
      <Text style={styles.heading}>Người phỏng vấn</Text>
      <View style={{ gap: 8 }}>
        {people.map((person) => {
          const selected = draft.interviewerIds.includes(person.uid);
          return (
            <Pressable
              key={person.uid}
              onPress={() => update("interviewerIds", selected ? draft.interviewerIds.filter((id) => id !== person.uid) : [...draft.interviewerIds, person.uid])}
              style={{ padding: 12, borderRadius: 10, borderWidth: 1, borderColor: selected ? "#0891b2" : "#cbd5e1", backgroundColor: selected ? "#ecfeff" : "#ffffff" }}
            >
              <Text style={styles.text}>{selected ? "✓ " : ""}{person.displayName || person.email}</Text>
            </Pressable>
          );
        })}
      </View>
      {interview && <ChoiceField label="Trạng thái" value={draft.status} disabled={busy} choices={INTERVIEW_STATUS_CHOICES} onChange={(value) => update("status", value)} />}
      {interview && <Field label="Kết quả" value={draft.result} multiline editable={!busy} onChangeText={(value) => update("result", value)} />}
      <Field label="Ghi chú" value={draft.notes} multiline editable={!busy} onChangeText={(value) => update("notes", value)} />
      <Text style={styles.muted}>Thời gian nhập theo múi giờ thiết bị; LuxCare lưu dưới dạng ISO.</Text>
      <ErrorText message={error} />
      <Button title={busy ? "Đang lưu..." : "Lưu lịch phỏng vấn"} disabled={busy} onPress={() => void save()} />
      <Button title="Hủy" disabled={busy} onPress={onClose} />
      {alertView}
    </RecruitmentModal>
  );
}
