import { useRef, useState } from "react";
import { Text } from "react-native";
import type { RecruitmentInterview } from "../../../../src/types/recruitment";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, ErrorText, Field, Page, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { INTERVIEW_STATUSES, interviewDraft, interviewPayload } from "./interviewModel";
import { PeoplePicker } from "./PeoplePicker";
import { interviewerPatch } from "./peopleModel";
export function InterviewForm({
  interview,
  applicantId,
  jobId,
  onClose,
  setLocked,
}: {
  interview?: RecruitmentInterview;
  applicantId: string;
  jobId: string;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => interviewDraft(interview));
  const [interviewers, setInterviewers] = useState<string[]>(interview?.interviewerIds || []);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const save = async () => {
    if (lock.current) return;
    let input: ReturnType<typeof interviewPayload>;
    try {
      input = interviewPayload(draft, interview);
      if (!applicantId || !jobId) throw new Error("Chọn ứng viên trước khi đặt lịch.");
    } catch (error) {
      setError(messageOf(error));
      return;
    }
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      if (interview)
        await recruitment.updateInterview(interview._id, {
          ...input,
          ...interviewerPatch(interview.interviewerIds, interviewers),
          version: interview.version,
        });
      else await recruitment.createInterview({ ...input, applicantId, jobId, interviewerIds: interviewers });
      onClose();
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
      if (!status || status >= 500 || status === 409 || /phiên bản|version/i.test(messageOf(error))) setBlocked(true);
      setError(
        `${messageOf(error)}${!status || status >= 500 || status === 409 || /phiên bản|version/i.test(messageOf(error)) ? " Đóng và tải lại trước khi lưu tiếp." : ""}`,
      );
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const disabled = busy || blocked;
  return (
    <Page title={interview ? "Sửa lịch phỏng vấn" : "Đặt lịch phỏng vấn"}>
      <Text style={styles.muted}>
        Ứng viên: {applicantId}
        {"\n"}Tin tuyển dụng: {jobId}
        {"\n"}
        {interview
          ? "Có thể thay đổi người phỏng vấn ở phần phân công bên dưới."
          : "Chọn người phỏng vấn trong chi nhánh ở phần phân công bên dưới."}
      </Text>
      {(
        [
          { key: "start", label: "Bắt đầu (YYYY-MM-DD HH:mm)" },
          { key: "end", label: "Kết thúc (YYYY-MM-DD HH:mm)" },
          { key: "location", label: "Địa điểm" },
          { key: "meetingLink", label: "Liên kết cuộc họp" },
          { key: "result", label: "Kết quả" },
          { key: "notes", label: "Ghi chú" },
        ] as const
      ).map(({ key, label }) => (
        <Field
          key={key}
          label={label}
          value={draft[key]}
          editable={!disabled}
          multiline={key === "result" || key === "notes"}
          onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))}
        />
      ))}
      <Text style={styles.muted}>Thời gian theo giờ Việt Nam.</Text>
      <ChoiceField
        label="Hình thức"
        value={draft.format}
        choices={[
          { value: "onsite", label: "Trực tiếp" },
          { value: "online", label: "Trực tuyến" },
          { value: "phone", label: "Điện thoại" },
        ]}
        disabled={disabled}
        onChange={(value) => setDraft((current) => ({ ...current, format: value }))}
      />
      <ChoiceField
        label="Trạng thái"
        value={draft.status}
        choices={INTERVIEW_STATUSES.map((item) => ({ ...item, value: item.value as RecruitmentInterview["status"] }))}
        disabled={disabled}
        onChange={(value) => setDraft((current) => ({ ...current, status: value }))}
      />
      <PeoplePicker
        title="Người phỏng vấn"
        selected={interviewers}
        onChange={setInterviewers}
        multiple
        disabled={disabled}
      />
      <ErrorText message={error} />
      <Button title="Lưu lịch phỏng vấn" disabled={disabled} onPress={() => void save()} />
      <Button title="Đóng và tải lại" disabled={busy} onPress={onClose} />
    </Page>
  );
}
