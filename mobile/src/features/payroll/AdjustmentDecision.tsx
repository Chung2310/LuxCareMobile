import { useRef, useState } from "react";
import { Text } from "react-native";
import type { PayrollAdjustment } from "../../../../src/types/payrollAdjustment";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, ErrorText, Page, styles } from "../../ui";
import { adjustmentKinds, canDecideAdjustment, validateAdjustmentDecision } from "./adjustmentModel";
import { payslipMoney } from "./model";
export function AdjustmentDecision({
  item,
  approve,
  onClose,
  setLocked,
}: {
  item: PayrollAdjustment;
  approve: boolean;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const { user } = useSession();
  const allowed = canDecideAdjustment(user, item);
  const attempted = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (attempted.current || !allowed) return;
    attempted.current = true;
    setBusy(true);
    setLocked(true);
    try {
      const saved = approve
        ? await payroll.approveAdjustment(item.periodKey, item._id)
        : await payroll.rejectAdjustment(item.periodKey, item._id);
      validateAdjustmentDecision(saved, item, approve);
      onClose();
    } catch (error) {
      setError(`${messageOf(error)} Đóng và tải lại để kiểm tra trạng thái trước khi thao tác tiếp.`);
    } finally {
      setBusy(false);
      setLocked(false);
    }
  };
  return (
    <Page title={approve ? "Duyệt điều chỉnh" : "Từ chối điều chỉnh"}>
      <Text style={styles.heading}>{item.employeeName || item.employeeId}</Text>
      <Text style={styles.text}>
        Kỳ {item.periodKey} · {adjustmentKinds[item.kind]}: {payslipMoney(item.amount)}
      </Text>
      <Text style={styles.text}>Lý do điều chỉnh: {item.reason}</Text>
      <Text style={styles.muted}>
        Xác nhận sẽ xử lý khoản đang chờ duyệt. LuxCare có thể tính lại bảng lương nháp; hãy kiểm tra số liệu sau thao
        tác.
      </Text>
      {!allowed && <ErrorText message="Bạn không có quyền xử lý hoặc khoản này không còn chờ duyệt." />}
      <ErrorText message={error} />
      <Button
        title={busy ? "Đang xử lý…" : approve ? "Xác nhận duyệt" : "Xác nhận từ chối"}
        disabled={busy || !!error || !allowed}
        onPress={() => void send()}
      />
      <Button title={error ? "Đóng và tải lại" : "Đóng"} disabled={busy} onPress={onClose} />
    </Page>
  );
}
