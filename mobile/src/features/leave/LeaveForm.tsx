import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Text } from "react-native";
import type { LeaveApplicationInput, LeaveBalance, LeaveTemplate, RequestKind } from "../../../../src/types/leave";
import { REQUEST_KIND_OPTIONS } from "../../../../src/types/leave";
import { leave } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Page, styles } from "../../ui";
import { ChoiceField } from "./ChoiceField";
import { pickLeaveAttachment } from "./files";
import { leaveDateRange, localDay } from "./model";

export function LeaveForm({
  templates,
  onClose,
  onSubmitted,
  setLocked,
}: {
  templates: LeaveTemplate[];
  onClose: () => void;
  onSubmitted: () => void;
  setLocked: (locked: boolean) => void;
}) {
  const { user } = useSession();
  const [templateId, setTemplateId] = useState("");
  const [kind, setKind] = useState<RequestKind>("leave");
  const [type, setType] = useState("");
  const [start, setStart] = useState(localDay());
  const [end, setEnd] = useState(localDay());
  const [reason, setReason] = useState("");
  const [attachments, setAttachments] = useState<LeaveApplicationInput["attachments"]>([]);
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const selectedTemplate = templates.find((item) => item._id === templateId);
  const requestKind = selectedTemplate?.requestKind || kind;
  const year = Number(start.slice(0, 4));
  useEffect(() => {
    let active = true;
    setBalance(null);
    setBalanceError(null);
    if (!user || requestKind !== "leave" || !Number.isInteger(year) || year < 2000 || year > 2200) return;
    void leave
      .balance(user.uid, year)
      .then((data) => {
        if (active) setBalance(data);
      })
      .catch((error) => {
        if (active) setBalanceError(messageOf(error));
      });
    return () => {
      active = false;
    };
  }, [user?.uid, year, requestKind]);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      await action();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const submit = () =>
    run(async () => {
      const dates = leaveDateRange(start, end);
      if (!reason.trim()) throw new Error("Vui lòng nhập lý do nộp đơn.");
      try {
        await leave.create({
          ...dates,
          ...(selectedTemplate ? { templateId: selectedTemplate._id } : {}),
          type:
            selectedTemplate?.name ||
            type.trim() ||
            REQUEST_KIND_OPTIONS.find((item) => item.value === requestKind)!.label,
          requestKind,
          reason: reason.trim(),
          attachments,
        });
      } catch (error) {
        if (!(error && typeof error === "object" && "status" in error) || Number(error.status) >= 500) {
          setUncertain(true);
          throw new Error(
            "Chưa xác nhận được kết quả gửi đơn. Hãy quay lại và tải lại danh sách trước khi nộp một đơn mới.",
          );
        }
        throw error;
      }
      onSubmitted();
    });
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Page title="Nộp đơn từ">
        <Text style={styles.muted}>Người nộp: {user?.displayName}. Đơn được gửi cho chính bạn.</Text>
        <ChoiceField
          label="Biểu mẫu"
          value={templateId}
          choices={[
            { value: "", label: "Không dùng biểu mẫu" },
            ...templates.map((item) => ({ value: item._id, label: item.name })),
          ]}
          onChange={setTemplateId}
          disabled={busy || uncertain}
        />
        {selectedTemplate ? (
          <Text style={styles.text}>
            Loại yêu cầu: {REQUEST_KIND_OPTIONS.find((item) => item.value === requestKind)?.label}
          </Text>
        ) : (
          <>
            <ChoiceField
              label="Loại yêu cầu"
              value={kind}
              choices={REQUEST_KIND_OPTIONS}
              onChange={setKind}
              disabled={busy || uncertain}
            />
            <Field label="Tên đơn (tùy chọn)" value={type} onChangeText={setType} editable={!busy && !uncertain} />
          </>
        )}
        <Field
          label="Từ ngày (YYYY-MM-DD)"
          value={start}
          onChangeText={setStart}
          maxLength={10}
          editable={!busy && !uncertain}
        />
        <Field
          label="Đến ngày (YYYY-MM-DD)"
          value={end}
          onChangeText={setEnd}
          maxLength={10}
          editable={!busy && !uncertain}
        />
        {balance && (
          <Card>
            <Text style={styles.heading}>Phép năm {balance.year}</Text>
            <Text style={styles.text}>
              Định mức: {balance.entitlement} · Đã dùng: {balance.used}
            </Text>
            <Text style={styles.text}>
              Còn lại: {balance.remaining} · Đang chờ duyệt: {balance.pending}
            </Text>
            <Text style={styles.muted}>
              Có thể đăng ký: {Math.max(0, balance.remaining - balance.pending)} ngày. Số ngày trừ phép được tính theo
              lịch làm việc.
            </Text>
          </Card>
        )}
        <ErrorText message={balanceError} />
        <Field label="Lý do nộp đơn" value={reason} onChangeText={setReason} multiline editable={!busy && !uncertain} />
        <Text style={styles.heading}>Minh chứng ({attachments.length}/10)</Text>
        <Text style={styles.muted}>Tối đa 20 MB mỗi tệp.</Text>
        {attachments.map((item, index) => (
          <Card key={item.uploadToken}>
            <Text style={styles.text}>{item.name}</Text>
            <Button
              title="Bỏ tệp"
              disabled={busy || uncertain}
              onPress={() => setAttachments((items) => items.filter((_, i) => i !== index))}
            />
          </Card>
        ))}
        <Button
          title={busy ? "Đang xử lý…" : "Thêm tệp"}
          disabled={busy || uncertain || attachments.length >= 10}
          onPress={() =>
            void run(async () => {
              const file = await pickLeaveAttachment();
              if (file) setAttachments((items) => [...items, file]);
            })
          }
        />
        <ErrorText message={error} />
        <Button title="Gửi đơn" disabled={busy || uncertain || !reason.trim()} onPress={() => void submit()} />
        <Button title={uncertain ? "Quay lại danh sách" : "Hủy"} disabled={busy} onPress={onClose} />
      </Page>
    </KeyboardAvoidingView>
  );
}
