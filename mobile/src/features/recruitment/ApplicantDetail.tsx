import { useEffect, useRef, useState } from "react";
import { Alert, Text } from "react-native";
import type { RecruitmentApplicant, RecruitmentHistory, RecruitmentStage } from "../../../../src/types/recruitment";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Page, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { OUTCOMES, stageChoices } from "./applicantModel";
import { AttachmentPanel } from "./AttachmentPanel";
import { PublicDocumentLink } from "./PublicDocumentLink";
export function ApplicantDetail({
  applicant,
  stages,
  manage,
  onClose,
  setLocked,
}: {
  applicant: RecruitmentApplicant;
  stages: RecruitmentStage[];
  manage: boolean;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [history, setHistory] = useState<RecruitmentHistory[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [target, setTarget] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setHistoryError(null);
    void recruitment
      .applicantHistory(applicant._id)
      .then((rows) => {
        if (active) setHistory(rows);
      })
      .catch((error) => {
        if (active) setHistoryError(messageOf(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applicant._id, revision]);
  const choices = stageChoices(stages, applicant.stageId);
  const transition = async () => {
    if (lock.current || !manage || !choices.some((item) => item.value === target)) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      await recruitment.transitionApplicant(applicant._id, applicant.version, target, note.trim());
      onClose();
    } catch (error) {
      setBlocked(true);
      setError(`${messageOf(error)} Đóng và tải lại ứng viên trước khi chuyển bước tiếp.`);
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const date = (value?: string | null) =>
    value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—";
  return (
    <Page title={applicant.fullName}>
      <Text style={styles.text}>
        {applicant.email || "Chưa có email"}
        {"\n"}
        {applicant.phone || "Chưa có điện thoại"}
      </Text>
      <Text style={styles.muted}>
        Tin tuyển dụng: {applicant.jobId}
        {"\n"}Giai đoạn: {stages.find((item) => item.id === applicant.stageId)?.name || applicant.stageId}
        {"\n"}Kết quả: {OUTCOMES.find((item) => item.value === applicant.outcome)?.label || applicant.outcome}
      </Text>
      <Card>
        <Text style={styles.text}>
          Địa chỉ: {applicant.address || "—"}
          {"\n"}Ngày sinh: {date(applicant.birthDate)}
          {"\n"}Kinh nghiệm: {applicant.experience || "—"}
          {"\n"}Học vấn: {applicant.education || "—"}
          {"\n"}Kỹ năng: {applicant.skills?.join(", ") || "—"}
          {"\n"}Lương mong muốn: {applicant.expectedSalary?.toLocaleString("vi-VN") || "—"}
          {"\n"}Có thể đi làm: {date(applicant.availableDate)}
          {"\n"}Nguồn: {applicant.source || "—"}
          {"\n"}Người phụ trách: {applicant.recruiterId || "—"}
          {"\n"}Ghi chú: {applicant.notes || "—"}
        </Text>
      </Card>
      {manage && (
        <>
          <ChoiceField
            label="Chuyển sang giai đoạn"
            value={target}
            choices={choices}
            onChange={setTarget}
            disabled={busy || blocked}
          />
          <Field
            label="Ghi chú chuyển bước"
            value={note}
            onChangeText={setNote}
            multiline
            editable={!busy && !blocked}
          />
          <ErrorText message={error} />
          <Button
            title="Chuyển bước"
            disabled={busy || blocked || !target}
            onPress={() =>
              Alert.alert(
                "Xác nhận chuyển bước",
                `${applicant.fullName} → ${choices.find((item) => item.value === target)?.label}\n${note.trim()}`,
                [
                  { text: "Hủy", style: "cancel" },
                  { text: "Xác nhận", onPress: () => void transition() },
                ],
              )
            }
          />
        </>
      )}
      <AttachmentPanel kind="applicant" id={applicant._id} manage={manage} />
      <PublicDocumentLink title="CV công khai" url={applicant.cvUrl} />
      <Text style={styles.heading}>Lịch sử tuyển dụng</Text>
      <ErrorText message={historyError} />
      {loading && <Text style={styles.muted}>Đang tải lịch sử…</Text>}
      {!loading && !historyError && !history.length && <Text style={styles.muted}>Chưa có lịch sử chuyển bước.</Text>}
      {history.map((item) => (
        <Card key={item._id}>
          <Text style={styles.text}>
            {item.fromStageName || "Bắt đầu"} → {item.toStageName}
          </Text>
          <Text style={styles.muted}>
            {date(item.createdAt)} · {item.actorId}
          </Text>
          <Text style={styles.text}>{item.note || "Không có ghi chú"}</Text>
        </Card>
      ))}
      <Button title="Tải lại lịch sử" disabled={busy || loading} onPress={() => setRevision((value) => value + 1)} />
      <Button title="Đóng và tải lại" disabled={busy} onPress={onClose} />
    </Page>
  );
}
