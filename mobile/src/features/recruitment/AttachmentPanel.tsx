import { useAppAlert } from "../../components/AppAlert";
import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import type { RecruitmentAttachment } from "../../../../src/types/recruitment";
import { recruitment } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, styles } from "../../ui";
import { shareRecruitmentFile, uploadRecruitmentFile } from "./files";
export function AttachmentPanel({ kind, id, manage }: { kind: "job" | "applicant"; id: string; manage: boolean }) {
  const { showAlert, alertView } = useAppAlert();
  const [attachment, setAttachment] = useState<RecruitmentAttachment | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setAttachment(null);
    void (kind === "job" ? recruitment.getJobAttachment(id) : recruitment.getApplicantAttachment(id))
      .then((value) => {
        if (active) {
          setAttachment(value);
          setBlocked(false);
        }
      })
      .catch((error) => {
        if (active) {
          setError(messageOf(error));
          setBlocked(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [kind, id, revision]);
  const run = async (action: "upload" | "download" | "delete") => {
    if (lock.current || (action !== "download" && (!manage || blocked))) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (action === "upload") await uploadRecruitmentFile(kind, id, attachment?.version);
      else if (attachment) {
        if (action === "download") await shareRecruitmentFile(attachment._id);
        else await recruitment.deleteAttachment(attachment._id);
      }
      if (action !== "download") setRevision((value) => value + 1);
    } catch (error) {
      setError(messageOf(error));
      if (action !== "download") setBlocked(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Card>
      <Text style={styles.heading}>{kind === "job" ? "Tệp JD đính kèm" : "Tệp CV đính kèm"}</Text>
      <Text style={styles.muted}>
        PDF/DOC/DOCX, tối đa 10 MB. Kho tệp đính kèm riêng; liên kết JD/CV công khai cũ không được thay đổi.
      </Text>
      {loading && <Text style={styles.muted}>Đang tải…</Text>}
      <ErrorText message={error} />
      {!loading && !error && !attachment && <Text style={styles.muted}>Chưa có tệp đính kèm.</Text>}
      {attachment && (
        <>
          <Text style={styles.text}>
            {attachment.originalName} · {Math.ceil(attachment.size / 1024)} KB
          </Text>
          <Button title="Tải về / chia sẻ" disabled={busy || loading} onPress={() => void run("download")} />
          {manage && (
            <Button
              title="Gỡ tệp"
              disabled={busy || loading || blocked}
              onPress={() =>
                showAlert("Gỡ tệp đính kèm?", attachment.originalName, [
                  { text: "Hủy", style: "cancel" },
                  { text: "Gỡ", style: "destructive", onPress: () => void run("delete") },
                ])
              }
            />
          )}
        </>
      )}
      {manage && (
        <Button
          title={attachment ? "Thay tệp" : "Chọn và tải tệp lên"}
          disabled={busy || loading || blocked}
          onPress={() =>
            attachment
              ? showAlert("Thay tệp hiện tại?", attachment.originalName, [
                  { text: "Hủy", style: "cancel" },
                  { text: "Chọn tệp mới", onPress: () => void run("upload") },
                ])
              : void run("upload")
          }
        />
      )}
      <Button title="Tải lại tệp" disabled={busy || loading} onPress={() => setRevision((value) => value + 1)} />
      {blocked && <Text style={styles.muted}>Tải lại thông tin tệp trước khi thao tác ghi tiếp.</Text>}
      {alertView}
    </Card>
  );
}
