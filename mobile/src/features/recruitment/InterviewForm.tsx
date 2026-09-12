import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Briefcase,
  Building2,
  Calendar,
  Check,
  Clock,
  FileText,
  Info,
  Link as LinkIcon,
  MapPin,
  Phone,
  Target,
  User,
  Users,
  Video,
  X,
} from "lucide-react-native";
import type { RecruitmentApplicant, RecruitmentInterview, RecruitmentJob } from "../../../../src/types/recruitment";
import type { UserProfile } from "../../../../src/types/common";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { useAppAlert } from "../../components/AppAlert";
import { ErrorText, Field } from "../../ui";
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

  const currentJob = jobs.find((job) => job._id === draft.jobId);

  return (
    <RecruitmentModal
      title={interview ? "Sửa lịch phỏng vấn" : "Lên lịch phỏng vấn mới"}
      subtitle={
        interview
          ? "Cập nhật thời gian, hình thức hoặc kết quả phỏng vấn"
          : "Tạo lịch hẹn phỏng vấn mới với ứng viên"
      }
      visible
      onClose={onClose}
    >
      {/* Tip Banner */}
      <View style={formStyles.tipBanner}>
        <Info size={16} color="#0284c7" />
        <Text style={formStyles.tipBannerText}>
          Thời gian nhập theo giờ địa phương (YYYY-MM-DD HH:mm). Hệ thống tự động đồng bộ múi giờ.
        </Text>
      </View>

      {/* Section 1: Ứng viên & Vị trí */}
      <View style={formStyles.sectionCard}>
        <View style={formStyles.sectionHeader}>
          <View style={formStyles.sectionIconBox}>
            <User size={15} color="#059669" />
          </View>
          <Text style={formStyles.sectionTitle}>Thông tin ứng viên & Vị trí</Text>
        </View>

        <ChoiceField
          label="Ứng viên *"
          value={draft.applicantId}
          choices={applicants.map((item) => ({ value: item._id, label: item.fullName }))}
          disabled={busy || Boolean(interview)}
          onChange={(value) => {
            const applicant = applicants.find((item) => item._id === value);
            update("applicantId", value);
            if (applicant) update("jobId", applicant.jobId);
          }}
        />

        <View style={formStyles.jobBadgeRow}>
          <Briefcase size={14} color="#64748b" />
          <Text style={formStyles.jobBadgeText}>
            Vị trí tuyển dụng: <Text style={{ fontWeight: "700", color: "#0f172a" }}>{currentJob?.title || "Chưa gán tin"}</Text>
          </Text>
        </View>
      </View>

      {/* Section 2: Thời gian & Hình thức */}
      <View style={formStyles.sectionCard}>
        <View style={formStyles.sectionHeader}>
          <View style={formStyles.sectionIconBox}>
            <Clock size={15} color="#059669" />
          </View>
          <Text style={formStyles.sectionTitle}>Thời gian & Địa điểm</Text>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field
              label="Bắt đầu *"
              value={draft.scheduledStart}
              editable={!busy}
              onChangeText={(value) => update("scheduledStart", value)}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Kết thúc *"
              value={draft.scheduledEnd}
              editable={!busy}
              onChangeText={(value) => update("scheduledEnd", value)}
            />
          </View>
        </View>

        <ChoiceField
          label="Hình thức phỏng vấn *"
          value={draft.format}
          disabled={busy}
          choices={[
            { value: "onsite", label: "Tại văn phòng cơ sở" },
            { value: "online", label: "Trực tuyến (Google Meet / Zoom)" },
            { value: "phone", label: "Phỏng vấn qua điện thoại" },
          ]}
          onChange={(value) => update("format", value as "onsite" | "online" | "phone")}
        />

        <Field
          label={
            draft.format === "online"
              ? "Liên kết phòng họp trực tuyến"
              : draft.format === "phone"
              ? "Số điện thoại / Lưu ý liên lạc"
              : "Địa điểm / Phòng họp cụ thể"
          }
          value={draft.format === "online" ? draft.meetingLink : draft.location}
          editable={!busy}
          onChangeText={(value) =>
            update(draft.format === "online" ? "meetingLink" : "location", value)
          }
        />
      </View>

      {/* Section 3: Hội đồng phỏng vấn */}
      <View style={formStyles.sectionCard}>
        <View style={formStyles.sectionHeader}>
          <View style={formStyles.sectionIconBox}>
            <Users size={15} color="#059669" />
          </View>
          <Text style={formStyles.sectionTitle}>Hội đồng phỏng vấn</Text>
        </View>

        <Text style={formStyles.fieldNote}>
          Chọn một hoặc nhiều cán bộ tham gia phỏng vấn đánh giá:
        </Text>

        <View style={{ gap: 8 }}>
          {people.map((person) => {
            const selected = draft.interviewerIds.includes(person.uid);
            return (
              <Pressable
                key={person.uid}
                onPress={() =>
                  update(
                    "interviewerIds",
                    selected
                      ? draft.interviewerIds.filter((id) => id !== person.uid)
                      : [...draft.interviewerIds, person.uid],
                  )
                }
                style={[
                  formStyles.interviewerItem,
                  selected && formStyles.interviewerItemSelected,
                ]}
              >
                <View
                  style={[
                    formStyles.checkboxBox,
                    selected && formStyles.checkboxBoxSelected,
                  ]}
                >
                  {selected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      formStyles.interviewerName,
                      selected && formStyles.interviewerNameSelected,
                    ]}
                  >
                    {person.displayName || person.email}
                  </Text>
                  {!!person.email && person.displayName ? (
                    <Text style={formStyles.interviewerEmail}>{person.email}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Section 4: Đánh giá & Ghi chú (nếu sửa hoặc có kết quả) */}
      <View style={formStyles.sectionCard}>
        <View style={formStyles.sectionHeader}>
          <View style={formStyles.sectionIconBox}>
            <Target size={15} color="#059669" />
          </View>
          <Text style={formStyles.sectionTitle}>Trạng thái & Đánh giá</Text>
        </View>

        {Boolean(interview) && (
          <ChoiceField
            label="Trạng thái lịch hẹn"
            value={draft.status}
            disabled={busy}
            choices={INTERVIEW_STATUS_CHOICES}
            onChange={(value) => update("status", value as RecruitmentInterview["status"])}
          />
        )}

        <Field
          label="Kết quả đánh giá"
          value={draft.result}
          multiline
          editable={!busy}
          onChangeText={(value) => update("result", value)}
        />
        <Field
          label="Ghi chú nội bộ"
          value={draft.notes}
          multiline
          editable={!busy}
          onChangeText={(value) => update("notes", value)}
        />
      </View>

      <ErrorText message={error} />

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
            {busy ? "Đang lưu..." : interview ? "Lưu thay đổi" : "Lên lịch phỏng vấn"}
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
  jobBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f8fafc",
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  jobBadgeText: {
    fontSize: 12,
    color: "#64748b",
  },
  fieldNote: {
    fontSize: 12,
    color: "#64748b",
  },
  interviewerItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  interviewerItemSelected: {
    borderColor: "#059669",
    backgroundColor: "#ecfdf5",
  },
  checkboxBox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  checkboxBoxSelected: {
    backgroundColor: "#059669",
    borderColor: "#059669",
  },
  interviewerName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
  },
  interviewerNameSelected: {
    color: "#065f46",
    fontWeight: "700",
  },
  interviewerEmail: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
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
