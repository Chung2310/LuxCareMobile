import { useEffect, useRef, useState } from "react";
import { Alert, Text } from "react-native";
import type { AttendanceLog, AttendanceAdjustment } from "../../../../src/services/attendanceService";
import { attendance } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Page, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { ATTENDANCE_STATUSES, adjustmentPayload } from "./adjustment";
export function AdjustmentForm({
  log,
  onClose,
  setLocked,
}: {
  log: AttendanceLog;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [status, setStatus] = useState(log.status || "");
  const [note, setNote] = useState(log.note || "");
  const [reason, setReason] = useState("");
  const [history, setHistory] = useState<AttendanceAdjustment[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setHistoryError(null);
    void attendance
      .adjustments(log._id)
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
  }, [log._id, revision]);
  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      await attendance.adjust(log._id, adjustmentPayload(status, note, reason));
      onClose();
    } catch (error) {
      if (!(error && typeof error === "object" && "status" in error) || Number(error.status) >= 500) {
        setUncertain(true);
        setError("Chưa xác nhận kết quả lưu. Đóng để tải lại bản ghi và lịch sử trước khi gửi tiếp.");
      } else setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const label = (value?: string) => ATTENDANCE_STATUSES.find((item) => item.value === value)?.label || value || "—";
  const time = (value?: string | Date) =>
    value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa ghi nhận";
  return (
    <Page title={`Chỉnh công · ${log.date}`}>
      <Text style={styles.muted}>
        Nhân viên: {log.uid}. Chỉnh trạng thái và ghi chú; giờ vào/ra và dữ liệu định vị được giữ nguyên.
      </Text>
      <ChoiceField
        label="Trạng thái"
        value={status}
        choices={ATTENDANCE_STATUSES}
        onChange={setStatus}
        disabled={busy || uncertain}
      />
      <Field label="Ghi chú" value={note} onChangeText={setNote} editable={!busy && !uncertain} multiline />
      <Field
        label="Lý do chỉnh sửa (bắt buộc)"
        value={reason}
        onChangeText={setReason}
        editable={!busy && !uncertain}
        multiline
      />
      <ErrorText message={error} />
      <Button
        title="Lưu chỉnh công"
        disabled={busy || uncertain}
        onPress={() => {
          try {
            adjustmentPayload(status, note, reason);
            setError(null);
            Alert.alert(
              "Xác nhận chỉnh công",
              `${log.date}: ${label(log.status)} → ${label(status)}\nGhi chú: ${note.trim() || "(trống)"}\nLý do: ${reason.trim()}`,
              [
                { text: "Hủy", style: "cancel" },
                { text: "Lưu", onPress: () => void save() },
              ],
            );
          } catch (error) {
            setError(messageOf(error));
          }
        }}
      />
      <Text style={styles.heading}>Lịch sử chỉnh sửa (tối đa 50 lần gần nhất)</Text>
      {loading && <Text style={styles.muted}>Đang tải lịch sử…</Text>}
      <ErrorText message={historyError} />
      {!loading && !historyError && !history.length && <Text style={styles.muted}>Chưa có chỉnh sửa.</Text>}
      {history.map((entry) => (
        <Card key={entry._id}>
          <Text style={styles.heading}>{entry.actorName || entry.actorId}</Text>
          <Text style={styles.muted}>{time(entry.createdAt)}</Text>
          <Text style={styles.text}>{entry.reason}</Text>
          <Text style={styles.text}>
            {label(entry.before.status)} → {label(entry.after.status)}
          </Text>
          <Text style={styles.muted}>
            Ghi chú: {entry.before.note || "—"} → {entry.after.note || "—"}
            {"\n"}Vào: {time(entry.before.checkIn?.time)} → {time(entry.after.checkIn?.time)}
            {"\n"}Ra: {time(entry.before.checkOut?.time)} → {time(entry.after.checkOut?.time)}
          </Text>
        </Card>
      ))}
      <Button title="Tải lại lịch sử" disabled={loading || busy} onPress={() => setRevision((value) => value + 1)} />
      <Button title="Đóng và tải lại" disabled={busy} onPress={onClose} />
    </Page>
  );
}
