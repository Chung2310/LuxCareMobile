import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { useAppAlert } from "../../components/AppAlert";
import { Button, Card, styles } from "../../ui";
import { canSyncRunAttendance } from "./syncAttendanceModel";
import { canClosePayrollRun, validateClosedRun, validateReviewedRun } from "./reviewModel";
import { payslipMoney } from "./model";

export function ReviewPayrollRun({
  run,
  onChanged,
  close = false,
}: {
  run: PayrollRun;
  onChanged: () => void;
  close?: boolean;
}) {
  const { user, selectedBranch } = useSession();
  const allowed = close
    ? canClosePayrollRun(user, selectedBranch?._id || user?.branchId, run)
    : canSyncRunAttendance(user, selectedBranch?._id || user?.branchId, run);
  const active = useRef(false);
  const attempted = useRef(false);
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

  const review = async () => {
    if (!allowed || !confirming || attempted.current) return;
    attempted.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = close
        ? await payroll.closeRun(run._id, run.version!)
        : await payroll.reviewRun(run._id, run.version!);
      if (close) validateClosedRun(saved, run);
      else validateReviewedRun(saved, run);
      if (active.current) {
        setDone(true);
        showAlert(
          "Thành công",
          close
            ? "Đã chốt kỳ lương thành công. Số liệu đã được đóng băng để thực hiện thanh toán."
            : "Đã duyệt và chuyển kỳ lương sang kiểm tra thành công.",
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
          close ? "Chốt kỳ lương không thành công" : "Kiểm tra bảng lương không thành công",
          msg,
          [
            { text: "Tải lại kỳ lương", onPress: onChanged },
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
  const lines = run.effectiveLines || [];
  const total = lines.reduce((sum, line) => sum + (line.calculation.net ?? line.calculation.netPay ?? NaN), 0);

  return (
    <Card>
      <Text style={styles.heading}>
        {close ? "Chốt" : "Duyệt"} kỳ lương {run.periodKey}
      </Text>
      <Text style={styles.muted}>Chi nhánh: {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}</Text>
      {done ? (
        <Text style={styles.text}>
          {close
            ? "Đã chốt kỳ lương. Tải lại để xuất báo cáo hoặc phát hành phiếu theo quyền của bạn."
            : "Kỳ đã chuyển sang kiểm tra. Tải lại để xem trạng thái và số liệu đã lưu."}
        </Text>
      ) : (
        <>
          <Text style={styles.text}>
            {lines.length} dòng lương · Tổng thực nhận: {payslipMoney(total)}
          </Text>
          <Text style={styles.muted}>
            {close
              ? "Kiểm tra số liệu đã duyệt trước khi chốt. LuxCare sẽ đối chiếu bản tính và số liệu đã lưu; chốt kỳ không thực hiện thanh toán hay tự phát hành phiếu."
              : "Kiểm tra các dòng lương và cảnh báo trước khi duyệt. Thao tác lưu số liệu hiện hành và chuyển kỳ sang kiểm tra; chưa chốt hoặc thanh toán."}
          </Text>
          {!confirming ? (
            <Button
              title={close ? "Chốt kỳ lương" : "Duyệt / chuyển sang kiểm tra"}
              onPress={() => setConfirming(true)}
            />
          ) : (
            <>
              <Text style={styles.text}>
                {close
                  ? "Xác nhận chốt kỳ và tổng thực nhận ở trên. Muốn sửa sau khi chốt cần thực hiện mở lại kỳ theo điều kiện của LuxCare."
                  : "Xác nhận duyệt kỳ và số liệu ở trên. Sau khi chuyển trạng thái, kỳ không còn cho tính lại trực tiếp."}
              </Text>
              <Button
                title={busy ? (close ? "Đang chốt…" : "Đang duyệt…") : close ? "Xác nhận chốt kỳ" : "Xác nhận duyệt kỳ"}
                disabled={busy}
                onPress={() => void review()}
              />
              {!attempted.current && <Button title="Quay lại" onPress={() => setConfirming(false)} />}
            </>
          )}
        </>
      )}
      {(done || error) && <Button title="Tải lại trạng thái kỳ lương" disabled={busy} onPress={onChanged} />}
      {alertView}
    </Card>
  );
}
