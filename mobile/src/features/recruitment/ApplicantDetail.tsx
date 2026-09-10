import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import type {
  RecruitmentApplicant,
  RecruitmentHistory,
  RecruitmentJob,
  RecruitmentStage,
} from "../../../../src/types/recruitment";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Loading, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { RecruitmentModal } from "./RecruitmentModal";
import { formatDate, formatOutcome } from "./recruitmentModel";

export function ApplicantDetail({
  applicant,
  jobs = [],
  stages = [],
  canManage,
  manage,
  onClose,
  onChanged,
  setLocked,
}: {
  applicant: RecruitmentApplicant;
  jobs?: RecruitmentJob[];
  stages?: RecruitmentStage[];
  canManage?: boolean;
  manage?: boolean;
  onClose: () => void;
  onChanged?: () => Promise<void> | void;
  setLocked?: (value: boolean) => void;
}) {
  const isManage = canManage ?? manage ?? false;
  const [history, setHistory] = useState<RecruitmentHistory[]>([]);
  const [stageId, setStageId] = useState(applicant.stageId);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    recruitment.applicantHistory(applicant._id)
      .then((value) => { if (active) setHistory(value); })
      .catch((err) => { if (active) setError(messageOf(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applicant._id]);

  const transition = async () => {
    if (!isManage || !stageId || stageId === applicant.stageId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await recruitment.transitionApplicant(applicant._id, applicant.version, stageId, note.trim());
      await onChanged?.();
      onClose();
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <RecruitmentModal title={applicant.fullName} visible onClose={onClose}>
      <Card>
        <Text style={styles.heading}>Thông tin ứng viên</Text>
        <Text style={styles.text}>Vị trí: {jobs.find((job) => job._id === applicant.jobId)?.title || "—"}</Text>
        <Text style={styles.text}>Email: {applicant.email || "—"}</Text>
        <Text style={styles.text}>Điện thoại: {applicant.phone || "—"}</Text>
        <Text style={styles.text}>Nguồn: {applicant.source || "—"}</Text>
        <Text style={styles.text}>Kỹ năng: {applicant.skills?.join(", ") || "—"}</Text>
        <Text style={styles.text}>Kinh nghiệm: {applicant.experience || "—"}</Text>
        <Text style={styles.text}>Ngày có thể nhận việc: {formatDate(applicant.availableDate)}</Text>
        <Text style={styles.text}>Kết quả: {formatOutcome(applicant.outcome)}</Text>
        {!!applicant.cvUrl && <Button title="Mở liên kết CV" onPress={() => router.push(applicant.cvUrl as never)} />}
      </Card>
      {isManage && (
        <Card>
          <Text style={styles.heading}>Chuyển giai đoạn</Text>
          <ChoiceField
            label="Giai đoạn mới"
            value={stageId}
            choices={stages.filter((stage) => stage.isActive).map((stage) => ({ value: stage.id, label: stage.name }))}
            disabled={busy}
            onChange={setStageId}
          />
          <Field label="Ghi chú chuyển bước" value={note} multiline editable={!busy} onChangeText={setNote} />
          <Button title="Lưu chuyển giai đoạn" disabled={busy || stageId === applicant.stageId} onPress={() => void transition()} />
        </Card>
      )}
      <Card>
        <Text style={styles.heading}>Lịch sử quy trình</Text>
        {loading && <Loading />}
        {!loading && !history.length && <Text style={styles.muted}>Chưa có lịch sử chuyển bước.</Text>}
        {history.map((item) => (
          <View key={item._id} style={{ gap: 3, borderLeftWidth: 3, borderLeftColor: "#0891b2", paddingLeft: 10 }}>
            <Text style={styles.text}>{item.fromStageName ? `${item.fromStageName} → ` : ""}{item.toStageName}</Text>
            <Text style={styles.muted}>{new Date(item.createdAt).toLocaleString("vi-VN")}</Text>
            {!!item.note && <Text style={styles.muted}>{item.note}</Text>}
          </View>
        ))}
        <ErrorText message={error} />
      </Card>
      <Button title="Lên lịch phỏng vấn cho ứng viên" onPress={() => {
        onClose();
        router.push({ pathname: "/(tabs)/interviews", params: { applicantId: applicant._id, jobId: applicant.jobId } });
      }} />
      <Button title="Đóng" onPress={onClose} />
    </RecruitmentModal>
  );
}
