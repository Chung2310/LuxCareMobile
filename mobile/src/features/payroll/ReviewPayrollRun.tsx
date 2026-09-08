import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, styles } from "../../ui";
import { canSyncRunAttendance } from "./syncAttendanceModel";
import { validateReviewedRun } from "./reviewModel";
import { payslipMoney } from "./model";
export function ReviewPayrollRun({ run, onChanged }: { run: PayrollRun; onChanged: () => void }) {
  const { user, selectedBranch } = useSession();
  const allowed = canSyncRunAttendance(user, selectedBranch?._id || user?.branchId, run);
  const active = useRef(false);
  const attempted = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
      };
    }, []),
  );
  const review = async () => {
    if (!allowed || !confirming || attempted.current) return;
    attempted.current = true;
    setBusy(true);
    try {
      const saved = await payroll.reviewRun(run._id, run.version!);
      validateReviewedRun(saved, run);
      if (active.current) setDone(true);
    } catch (error) {
      if (active.current) setError(`${messageOf(error)} Tải lại kỳ để kiểm tra trước khi thao tác tiếp.`);
    } finally {
      if (active.current) setBusy(false);
    }
  };
  if (!allowed) return null;
  const lines = run.effectiveLines || [];
  const total = lines.reduce((sum, line) => sum + (line.calculation.net ?? line.calculation.netPay ?? NaN), 0);
  return (
    <Card>
      <Text style={styles.heading}>Duyệt kỳ lương {run.periodKey}</Text>
      <Text style={styles.muted}>Chi nhánh: {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}</Text>
      {done ? (
        <Text style={styles.text}>Kỳ đã chuyển sang kiểm tra. Tải lại để xem trạng thái và số liệu đã lưu.</Text>
      ) : (
        <>
          <Text style={styles.text}>
            {lines.length} dòng lương · Tổng thực nhận: {payslipMoney(total)}
          </Text>
          <Text style={styles.muted}>
            Kiểm tra các dòng lương và cảnh báo trước khi duyệt. Thao tác lưu số liệu hiện hành và chuyển kỳ sang kiểm
            tra; chưa chốt hoặc thanh toán.
          </Text>
          {!confirming ? (
            <Button title="Duyệt / chuyển sang kiểm tra" onPress={() => setConfirming(true)} />
          ) : (
            <>
              <Text style={styles.text}>
                Xác nhận duyệt kỳ và số liệu ở trên. Sau khi chuyển trạng thái, kỳ không còn cho tính lại trực tiếp.
              </Text>
              <Button
                title={busy ? "Đang duyệt…" : "Xác nhận duyệt kỳ"}
                disabled={busy || !!error}
                onPress={() => void review()}
              />
              {!attempted.current && <Button title="Quay lại" onPress={() => setConfirming(false)} />}
            </>
          )}
        </>
      )}
      <ErrorText message={error} />
      {(done || error) && <Button title="Tải lại trạng thái kỳ lương" disabled={busy} onPress={onChanged} />}
    </Card>
  );
}
