import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { PayrollPayment } from "../../../../src/types/payrollPayment";
import type { PayrollRunLine } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, styles } from "../../ui";
import { payslipMoney } from "./model";
import { canConfirmPayment, validateConfirmedPayment } from "./confirmPaymentModel";

export function ConfirmPayrollPayment({
  payment,
  runId,
  runStatus,
  employees,
  onClose,
  onChanged,
}: {
  payment: PayrollPayment;
  runId: string;
  runStatus: string;
  employees: PayrollRunLine[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user, selectedBranch } = useSession();
  const allowed = canConfirmPayment(user, selectedBranch?._id || user?.branchId, runId, runStatus, payment);
  const active = useRef(false);
  const attempted = useRef(false);
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
  const confirm = async () => {
    if (!allowed || attempted.current) return;
    attempted.current = true;
    setBusy(true);
    try {
      validateConfirmedPayment(await payroll.confirmPayment(payment._id), payment);
      if (active.current) setDone(true);
    } catch (error) {
      if (active.current) setError(`${messageOf(error)} Tải lại trước khi thao tác tiếp.`);
    } finally {
      if (active.current) setBusy(false);
    }
  };
  if (!allowed) return null;
  return (
    <Card>
      <Text style={styles.heading}>Xác nhận đã thanh toán {payslipMoney(payment.amount)}</Text>
      <Text style={styles.text}>Chi nhánh: {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}</Text>
      <Text selectable style={styles.muted}>
        Mã thanh toán: {payment._id}
      </Text>
      {(payment.lines || []).map((line) => (
        <Text key={line.employeeId} style={styles.text}>
          {employees.find((employee) => employee.employeeId === line.employeeId)?.employeeName || line.employeeId}:{" "}
          {payslipMoney(line.amount)}
        </Text>
      ))}
      <Text style={styles.text}>Ghi chú: {payment.note || "—"}</Text>
      <Text style={styles.muted}>
        Chỉ xác nhận sau khi đã chi trả thực tế. Thao tác ghi nhận đã trả lương trong LuxCare; không thực hiện chuyển
        tiền ngân hàng. Ngày thanh toán giữ theo khoản nháp, hoặc dùng thời điểm xác nhận nếu chưa có.
      </Text>
      {done && <Text style={styles.text}>Đã xác nhận. Tải lại để xem tổng đã trả và trạng thái kỳ lương.</Text>}
      <ErrorText message={error} />
      {!attempted.current && <Button title="Quay lại" onPress={onClose} />}
      {!done && (
        <Button
          title={busy ? "Đang xác nhận…" : "Xác nhận đã chi trả"}
          disabled={busy || attempted.current}
          onPress={() => void confirm()}
        />
      )}
      {attempted.current && <Button title="Tải lại kỳ và thanh toán" disabled={busy} onPress={onChanged} />}
    </Card>
  );
}
