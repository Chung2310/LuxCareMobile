import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { PayrollPayment } from "../../../../src/types/payrollPayment";
import type { PayrollRunLine } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, styles } from "../../ui";
import { payslipMoney } from "./model";
import { canConfirmPayment, validateConfirmedPayment } from "./confirmPaymentModel";
import { canUndoPayment, validateUndonePayment, type UndoPaymentAction } from "./undoPaymentModel";
import { paymentMetadataInput, validatePaymentMetadata } from "./paymentMetadataModel";
import { contractDate } from "../contracts/model";

export function ConfirmPayrollPayment({
  payment,
  runId,
  runStatus,
  employees,
  onClose,
  onChanged,
  action = "confirm",
}: {
  payment: PayrollPayment;
  runId: string;
  runStatus: string;
  employees: PayrollRunLine[];
  onClose: () => void;
  onChanged: () => void;
  action?: "confirm" | UndoPaymentAction;
}) {
  const { user, selectedBranch } = useSession();
  const branchId = selectedBranch?._id || user?.branchId;
  const allowed =
    action === "confirm"
      ? canConfirmPayment(user, branchId, runId, runStatus, payment)
      : canUndoPayment(user, branchId, runId, runStatus, payment, action);
  const title =
    action === "cancel"
      ? "Hủy khoản thanh toán nháp"
      : action === "reverse"
        ? "Đảo khoản đã xác nhận"
        : "Xác nhận đã thanh toán";
  const active = useRef(false);
  const attempted = useRef(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [evidence, setEvidence] = useState("");
  const [note, setNote] = useState("");
  const [metadata, setMetadata] = useState<ReturnType<typeof paymentMetadataInput> | null>(null);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
      };
    }, []),
  );
  const confirm = async () => {
    if (!allowed || attempted.current || !metadata) return;
    attempted.current = true;
    setBusy(true);
    try {
      const result = await (action === "cancel"
        ? payroll.cancelPayment(payment._id, metadata)
        : action === "reverse"
          ? payroll.reversePayment(payment._id, metadata)
          : payroll.confirmPayment(payment._id, metadata));
      if (action === "confirm") validateConfirmedPayment(result, payment);
      else validateUndonePayment(result, payment, action);
      validatePaymentMetadata(result, metadata);
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
      <Text style={styles.heading}>
        {title} · {payslipMoney(payment.amount)}
      </Text>
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
      <Text style={styles.text}>Ghi chú: {metadata?.note || payment.note || "—"}</Text>
      <Text style={styles.text}>
        Ngày thanh toán:{" "}
        {metadata?.paymentDate || payment.paymentDate
          ? contractDate(metadata?.paymentDate || payment.paymentDate!)
          : "Chưa ghi nhận"}
      </Text>
      <Text selectable style={styles.text}>
        Chứng từ: {metadata?.evidenceUrl || payment.evidenceUrl || "—"}
      </Text>
      {!metadata && (
        <>
          <Text style={styles.muted}>
            Để trống để giữ thông tin hiện có. Nội dung nhập mới sẽ thay ghi chú hoặc liên kết cũ; chưa hỗ trợ xóa thông
            tin đã lưu.
          </Text>
          {action === "confirm" && (
            <Field label="Ngày thanh toán mới (YYYY-MM-DD, giờ Việt Nam)" value={date} onChangeText={setDate} />
          )}
          <Field
            label="Liên kết chứng từ mới (HTTP/HTTPS)"
            value={evidence}
            onChangeText={setEvidence}
            autoCapitalize="none"
            keyboardType="url"
          />
          <Field label="Ghi chú mới" value={note} onChangeText={setNote} multiline />
          <Button
            title="Xem lại trước khi gửi"
            onPress={() => {
              try {
                setMetadata(paymentMetadataInput(action === "confirm" ? date : "", evidence, note));
                setError(null);
              } catch (error) {
                setError(messageOf(error));
              }
            }}
          />
        </>
      )}
      {metadata && !attempted.current && <Button title="Sửa thông tin" onPress={() => setMetadata(null)} />}
      <Text style={styles.muted}>
        {action === "cancel"
          ? "Khoản nháp sẽ chuyển sang đã hủy và không thể xác nhận tiếp. Tổng đã trả và trạng thái kỳ được giữ nguyên; lịch sử vẫn được lưu."
          : action === "reverse"
            ? "Khoản này sẽ bị loại khỏi tổng đã trả. LuxCare tính lại trạng thái kỳ, có thể chuyển từ đã thanh toán về đã chốt. Thao tác không hoàn tiền ngân hàng; cần đối soát việc thu hồi tiền thực tế riêng."
            : "Chỉ xác nhận sau khi đã chi trả thực tế. Thao tác ghi nhận đã trả lương trong LuxCare; không thực hiện chuyển tiền ngân hàng. Nếu không nhập ngày mới, giữ ngày khoản nháp hoặc dùng thời điểm xác nhận khi chưa có."}
      </Text>
      {done && <Text style={styles.text}>Đã hoàn tất. Tải lại để xem tổng đã trả và trạng thái kỳ lương.</Text>}
      <ErrorText message={error} />
      {!attempted.current && <Button title="Quay lại" onPress={onClose} />}
      {metadata && !done && (
        <Button
          title={
            busy
              ? "Đang xử lý…"
              : action === "cancel"
                ? "Xác nhận hủy khoản nháp"
                : action === "reverse"
                  ? "Xác nhận đảo thanh toán"
                  : "Xác nhận đã chi trả"
          }
          disabled={busy || attempted.current}
          onPress={() => void confirm()}
        />
      )}
      {attempted.current && <Button title="Tải lại kỳ và thanh toán" disabled={busy} onPress={onChanged} />}
    </Card>
  );
}
