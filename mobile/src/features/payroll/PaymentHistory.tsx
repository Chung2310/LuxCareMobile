import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { PayrollPayment } from "../../../../src/types/payrollPayment";
import type { PayrollRunLine } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Loading, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { contractDate } from "../contracts/model";
import { payslipMoney } from "./model";
import { canReadRunPayments, confirmedPaymentTotal, paymentStatuses } from "./paymentModel";
export function PaymentHistory({ runId, employees }: { runId: string; employees: PayrollRunLine[] }) {
  const { user, selectedBranch } = useSession();
  const allowed = canReadRunPayments(user);
  const [items, setItems] = useState<PayrollPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<PayrollPayment["status"] | "">("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setItems([]);
      setError(null);
      setExpanded(null);
      setLoading(false);
      if (!allowed) return;
      setLoading(true);
      void payroll
        .getPayments(runId)
        .then((value) => {
          if (value.some((item) => item.runId !== runId)) throw new Error("Thanh toán trả về không khớp bảng lương.");
          if (active) setItems(value);
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
    }, [allowed, runId, user?.uid, user?.companyCode, user?.branchId, selectedBranch?._id, revision]),
  );
  if (!allowed) return null;
  const rows = items.filter((item) => !status || item.status === status);
  const nameOf = (id: string) => employees.find((employee) => employee.employeeId === id)?.employeeName || id;
  return (
    <Card>
      <Text style={styles.heading}>Lịch sử thanh toán</Text>
      <ChoiceField
        label="Trạng thái thanh toán"
        value={status}
        choices={[
          { value: "", label: "Tất cả" },
          ...Object.entries(paymentStatuses).map(([value, label]) => ({
            value: value as PayrollPayment["status"],
            label,
          })),
        ]}
        disabled={loading}
        onChange={(value) => {
          setStatus(value);
          setExpanded(null);
        }}
      />
      <Button title="Tải lại thanh toán" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
      {loading && <Loading />}
      <ErrorText message={error} />
      {!loading && !error && (
        <>
          <Text style={styles.text}>Tổng đã xác nhận của kỳ: {payslipMoney(confirmedPaymentTotal(items))}</Text>
          <Text style={styles.muted}>
            Không cộng khoản nháp, đã hủy hoặc đã đảo. Tổng không thay đổi theo bộ lọc trạng thái.
          </Text>
          {!rows.length && <Text style={styles.text}>Không có khoản thanh toán phù hợp.</Text>}
          {rows.map((item) => (
            <Card key={item._id}>
              <Text style={styles.heading}>
                {payslipMoney(item.amount)} · {paymentStatuses[item.status] || item.status}
              </Text>
              <Text style={styles.text}>
                Ngày thanh toán: {item.paymentDate ? contractDate(item.paymentDate) : "Chưa ghi nhận"}
              </Text>
              <Button
                title={expanded === item._id ? "Thu gọn" : "Xem phân bổ và thông tin"}
                onPress={() => setExpanded(expanded === item._id ? null : item._id)}
              />
              {expanded === item._id && (
                <>
                  <Text selectable style={styles.muted}>
                    Mã thanh toán: {item._id}
                  </Text>
                  {(item.lines || []).map((line, index) => (
                    <Text key={`${line.employeeId}:${index}`} style={styles.text}>
                      {nameOf(line.employeeId)}: {payslipMoney(line.amount)}
                    </Text>
                  ))}
                  {!item.lines?.length && <Text style={styles.muted}>API chưa có thông tin phân bổ nhân viên.</Text>}
                  <Text style={styles.text}>Ghi chú: {item.note || "—"}</Text>
                  {(
                    [
                      ["Tạo", item.createdAt],
                      ["Xác nhận", item.confirmedAt],
                      ["Hủy", item.cancelledAt],
                      ["Đảo thanh toán", item.reversedAt],
                    ] as const
                  ).map(([label, date]) =>
                    date ? (
                      <Text key={label} style={styles.muted}>
                        {label}: {contractDate(date)}
                      </Text>
                    ) : null,
                  )}
                  {item.evidenceUrl && (
                    <Text selectable style={styles.muted}>
                      Liên kết chứng từ: {item.evidenceUrl}
                    </Text>
                  )}
                </>
              )}
            </Card>
          ))}
        </>
      )}
    </Card>
  );
}
