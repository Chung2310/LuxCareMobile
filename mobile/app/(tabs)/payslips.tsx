import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { Payslip } from "../../../src/types/payslip";
import { payroll } from "../../src/api/services";
import { useSession, messageOf } from "../../src/auth/SessionProvider";
import { Button, Card, ErrorText, Loading, Page, styles } from "../../src/ui";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { canReadPayslips, payslipMoney, payslipsForPeriod } from "../../src/features/payroll/model";
import { PayslipDetails } from "../../src/features/payroll/PayslipDetails";
export default function Payslips() {
  const { user, selectedBranch } = useSession();
  const allowed = canReadPayslips(user);
  const branchId = selectedBranch?._id || user?.branchId;
  const [items, setItems] = useState<Payslip[]>([]);
  const [period, setPeriod] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setItems([]);
      setExpanded(null);
      setError(null);
      setLoading(false);
      if (!allowed || !branchId) return;
      setLoading(true);
      void payroll
        .getEmployeePayslips()
        .then((result) => {
          if (active) setItems(result);
        })
        .catch((error) => {
          if (active) setError(messageOf(error));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [allowed, user?.uid, user?.companyCode, branchId, revision]),
  );
  if (!allowed)
    return (
      <Page title="Phiếu lương của tôi">
        <Text style={styles.text}>Cần tài khoản doanh nghiệp có phân hệ nhân sự.</Text>
      </Page>
    );
  if (!branchId)
    return (
      <Page title="Phiếu lương của tôi">
        <Text style={styles.text}>Chọn chi nhánh trong tài khoản để tra cứu phiếu lương.</Text>
      </Page>
    );
  const periods = [...new Set([...items.map((item) => item.periodKey || ""), period])].filter(Boolean).sort().reverse();
  const rows = payslipsForPeriod(items, period);
  return (
    <Page title="Phiếu lương của tôi">
      <Text style={styles.muted}>Phiếu lương cá nhân đã phát hành trong phạm vi chi nhánh của phiên đăng nhập.</Text>
      <ChoiceField
        label="Kỳ lương"
        value={period}
        choices={[{ value: "", label: "Tất cả kỳ đã phát hành" }, ...periods.map((value) => ({ value, label: value }))]}
        disabled={loading}
        onChange={(value) => {
          setPeriod(value);
          setExpanded(null);
        }}
      />
      <Button title="Tải lại" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
      {loading && <Loading />}
      <ErrorText message={error} />
      {!loading && !error && !rows.length && (
        <Text style={styles.text}>Chưa có phiếu lương được phát hành phù hợp.</Text>
      )}
      {rows.map((item) => {
        const key = `${item.runId}:${item.employeeId}`;
        return (
          <Card key={key}>
            <Text style={styles.heading}>Kỳ lương {item.periodKey || "—"}</Text>
            <Text style={styles.text}>{item.employeeName || "Phiếu lương cá nhân"}</Text>
            <Text style={styles.heading}>Thực nhận: {payslipMoney(item.netPay)}</Text>
            <Text style={styles.text}>
              Đã trả: {payslipMoney(item.paidAmount)}
              {"\n"}Còn lại: {payslipMoney(item.balance)}
            </Text>
            <Button
              title={expanded === key ? "Thu gọn" : "Xem chi tiết"}
              onPress={() => setExpanded(expanded === key ? null : key)}
            />
            {expanded === key && <PayslipDetails item={item} />}
          </Card>
        );
      })}
    </Page>
  );
}
