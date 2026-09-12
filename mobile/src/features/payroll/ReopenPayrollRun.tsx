import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { useAppAlert } from "../../components/AppAlert";
import { Button, Card, Field, styles } from "../../ui";
import { canReopenPayrollRun, reopenPayload, validateReopenedRun } from "./reopenModel";

export function ReopenPayrollRun({ run, onChanged }: { run: PayrollRun; onChanged: () => void }) {
  const { user, selectedBranch } = useSession();
  const allowed = canReopenPayrollRun(user, selectedBranch?._id || user?.branchId, run);
  const active = useRef(false);
  const attempted = useRef(false);
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showAlert, alertView } = useAppAlert();

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
      };
    }, []),
  );

  const reopen = async () => {
    if (!allowed || !confirming || attempted.current) return;
    let payload;
    try {
      payload = reopenPayload(run, reason);
    } catch (err) {
      const msg = messageOf(err);
      setError(msg);
      showAlert("Lỗi nhập liệu", msg, [{ text: "Đã hiểu" }], "error");
      return;
    }
    attempted.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = await payroll.reopen(run._id, payload);
      validateReopenedRun(saved, run);
      if (active.current) {
        setDone(true);
        showAlert(
          "Mở lại kỳ lương thành công",
          "Kỳ lương đã được chuyển về trạng thái nháp. Tải lại để kiểm tra số liệu.",
          [{ text: "Đã hiểu", onPress: onChanged }],
          "success",
        );
      }
    } catch (err) {
      const msg = messageOf(err);
      if (active.current) {
        setError(msg);
        attempted.current = false;
        showAlert(
          "Mở lại kỳ lương không thành công",
          msg,
          [
            { text: "Tải lại kỳ", onPress: onChanged },
            { text: "Đã hiểu", style: "cancel" },
          ],
          "error",
        );
      }
    } finally {
      if (active.current) setBusy(false);
    }
  };

  if (!allowed) return null;

  return (
    <Card>
      <Text style={styles.heading}>Mở lại kỳ lương {run.periodKey}</Text>
      <Text style={styles.muted}>Chi nhánh: {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}</Text>
      {done ? (
        <Text style={styles.text}>
          Đã mở lại kỳ về nháp. Tải lại để kiểm tra số liệu trước khi chỉnh sửa hoặc tính lại.
        </Text>
      ) : (
        <>
          <Text style={styles.text}>
            Mở lại sẽ đưa kỳ về nháp và bỏ bản số liệu đã lưu khi duyệt. Phiếu lương đã phát hành sẽ không còn trong
            danh sách của nhân viên khi kỳ ở trạng thái nháp.
          </Text>
          <Text style={styles.muted}>
            Kỳ có thanh toán đã xác nhận cần xử lý thanh toán trước; kỳ đã trả không thể mở lại. Các bản phiếu đã
            tải/chia sẻ vẫn có thể tồn tại.
          </Text>
          <Field
            label="Lý do mở lại (bắt buộc)"
            value={reason}
            onChangeText={(value) => {
              setReason(value);
              setError(null);
            }}
            multiline
            editable={!confirming && !busy}
          />
          {!confirming ? (
            <Button
              title="Xem lại yêu cầu mở kỳ"
              onPress={() => {
                try {
                  reopenPayload(run, reason);
                  setError(null);
                  setConfirming(true);
                } catch (err) {
                  const msg = messageOf(err);
                  setError(msg);
                  showAlert("Lỗi nhập liệu", msg, [{ text: "Đã hiểu" }], "error");
                }
              }}
            />
          ) : (
            <>
              <Text style={styles.text}>Xác nhận mở lại kỳ với lý do: {reason.trim()}</Text>
              <Button
                title={busy ? "Đang mở lại…" : "Xác nhận mở lại kỳ"}
                disabled={busy}
                onPress={() => void reopen()}
              />
              {!attempted.current && <Button title="Sửa lý do / quay lại" onPress={() => setConfirming(false)} />}
            </>
          )}
        </>
      )}
      {(done || error) && (
        <Button title="Tải lại trạng thái kỳ lương" disabled={busy} onPress={onChanged} />
      )}
      {alertView}
    </Card>
  );
}
