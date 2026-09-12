import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import { Text } from "react-native";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { useAppAlert } from "../../components/AppAlert";
import { Button, Card, styles } from "../../ui";
import { canSyncRunAttendance } from "./syncAttendanceModel";
import { calculationSummary } from "./calculationModel";

export function CalculatePayrollRun({ run, onChanged }: { run: PayrollRun; onChanged: () => void }) {
  const { user, selectedBranch } = useSession();
  const allowed = canSyncRunAttendance(user, selectedBranch?._id || user?.branchId, run);
  const active = useRef(false);
  const attempted = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof calculationSummary> | null>(null);
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

  const calculate = async () => {
    if (!allowed || !confirming || attempted.current) return;
    attempted.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = await payroll.calculateOperationalRun(run._id, run.version!, randomUUID());
      const summary = calculationSummary(saved, run);
      if (active.current) {
        setResult(summary);
        showAlert(
          "Tính lương thành công",
          `Đã hoàn tất bản tính cho ${summary.employeeCount} dòng lương. Tải lại để kiểm tra số liệu.`,
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
          "Tính lương không thành công",
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
      <Text style={styles.heading}>Tính lương kỳ {run.periodKey}</Text>
      <Text style={styles.muted}>Chi nhánh: {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}</Text>
      {result ? (
        <>
          <Text style={styles.text}>
            Đã hoàn tất bản tính cho {result.employeeCount} dòng lương. Tải lại để kiểm tra số liệu và cảnh báo trước
            khi duyệt.
          </Text>
          <Text selectable style={styles.muted}>
            Mã bản tính: {result.revisionId}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.text}>
            Cần có bản công đã khóa. Sau khi khóa công, hãy tải lại kỳ trước khi tính lương.
          </Text>
          <Text style={styles.muted}>
            Tính lại sẽ tạo bản tính mới từ bản công đã khóa và dữ liệu lương hiện hành. Kỳ vẫn là nháp, chưa chốt hoặc
            thanh toán.
          </Text>
          {!confirming ? (
            <Button title="Tính / tính lại lương" onPress={() => setConfirming(true)} />
          ) : (
            <>
              <Text style={styles.text}>Xác nhận tính lương cho kỳ và chi nhánh ở trên.</Text>
              <Button
                title={busy ? "Đang tính lương…" : "Xác nhận tính lương"}
                disabled={busy}
                onPress={() => void calculate()}
              />
              {!attempted.current && <Button title="Quay lại" onPress={() => setConfirming(false)} />}
            </>
          )}
        </>
      )}
      {(result || error) && <Button title="Tải lại bảng lương và cảnh báo" disabled={busy} onPress={onChanged} />}
      {alertView}
    </Card>
  );
}
