import { historicalUserLabel } from "../../../../src/utils/historicalUser";
import { useRef, useState } from "react";
import { Text, View } from "react-native";
import type { PayrollAdjustment } from "../../../../src/types/payrollAdjustment";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Card, ErrorText, Page, styles } from "../../ui";
import { adjustmentKinds, canDecideAdjustment, validateAdjustmentDecision } from "./adjustmentModel";
import { AdjustmentAction, adjustmentStyles as s } from "./adjustmentUi";
import { payslipMoney } from "./model";
export function AdjustmentDecision({
  item,
  approve,
  onClose,
  onSaved,
  setLocked,
}: {
  item: PayrollAdjustment;
  approve: boolean;
  onClose: () => void;
  onSaved?: (saved: PayrollAdjustment) => void;
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
      if (onSaved) onSaved(saved); else onClose();
    } catch (error) {
      setError(`${messageOf(error)} Đóng và tải lại để kiểm tra trạng thái trước khi thao tác tiếp.`);
    } finally {
      setBusy(false);
      setLocked(false);
    }
  };
  return (
    <Page title={approve ? "Duyệt điều chỉnh" : "Từ chối điều chỉnh"} onBack={() => { if (!busy) onClose(); }}>
      <Card>
        <Text style={s.subtitle}>Kỳ {item.periodKey}</Text>
        <Text style={styles.heading}>{historicalUserLabel(item.employeeName, item.employeeDeleted, item.employeeId)}</Text>
        <Text style={[s.amount, item.kind === "deduction" && { color: "#be123c" }]}>{payslipMoney(item.amount)}</Text>
        <Text style={styles.text}>
          {adjustmentKinds[item.kind]} · Chờ duyệt
        </Text>
        <Text style={styles.text}>Lý do điều chỉnh: {item.reason}</Text>
      </Card>
      <View style={s.info}><Text style={styles.muted}>
        Xác nhận sẽ xử lý khoản đang chờ duyệt. LuxCare có thể tính lại bảng lương nháp; hãy kiểm tra số liệu sau thao
        tác.
      </Text>
      </View>
      {!allowed && <ErrorText message="Bạn không có quyền xử lý hoặc khoản này không còn chờ duyệt." />}
      <ErrorText message={error} />
      <AdjustmentAction
        tone={approve ? "primary" : "danger"}
        title={busy ? "Đang xử lý…" : approve ? "Xác nhận duyệt" : "Xác nhận từ chối"}
        disabled={busy || !!error || !allowed}
        onPress={() => void send()}
      />
      <AdjustmentAction tone="secondary" title={error ? "Đóng và tải lại" : "Quay lại danh sách"} disabled={busy} onPress={onClose} />
    </Page>
  );
}
