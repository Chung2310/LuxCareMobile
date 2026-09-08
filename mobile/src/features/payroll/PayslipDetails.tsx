import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { Payslip, PayslipDetail } from "../../../../src/types/payslip";
import { buildPayrollDetails } from "../../../../src/components/hr/payrollDetails";
import { payroll } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Loading, styles } from "../../ui";
import { payslipMoney } from "./model";
export function PayslipDetails({ item }: { item: Payslip }) {
  const [data, setData] = useState<PayslipDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setData(null);
      setError(null);
      setLoading(true);
      void payroll
        .getLineDetail(item.runId, item.employeeId)
        .then((value) => {
          if (!value?.calculation || value.employeeId !== item.employeeId)
            throw new Error("Chi tiết phiếu lương không hợp lệ.");
          if (active) setData(value);
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
    }, [item.runId, item.employeeId, revision]),
  );
  if (loading) return <Loading />;
  if (error)
    return (
      <>
        <ErrorText message={error} />
        <Button title="Tải lại chi tiết" onPress={() => setRevision((value) => value + 1)} />
      </>
    );
  if (!data) return null;
  const detail = buildPayrollDetails(data.attendance, data.calculation, data.vietnam);
  const rows = [
    ["Lương cơ bản", detail.monthlySalary],
    ["Đơn giá giờ", detail.hourlyRate],
    ["Lương theo công", detail.adjustedBase],
    ["Nghỉ có lương", detail.paidLeaveValue],
    ["Tăng ca", detail.overtimeValue],
    ["Phụ cấp", detail.allowances],
    ["Thưởng", detail.bonuses],
    ["Tổng thu nhập (Gross)", detail.gross],
    ["Khấu trừ theo công thức", detail.deductions],
    ["BHXH", detail.deductionBreakdown.socialInsurance],
    ["BHYT", detail.deductionBreakdown.healthInsurance],
    ["BHTN", detail.deductionBreakdown.unemploymentInsurance],
    ["Thuế TNCN", detail.deductionBreakdown.personalIncomeTax],
    ["Tạm ứng", detail.deductionBreakdown.advances],
    ["Khấu trừ khác", detail.deductionBreakdown.otherDeductions],
    ["Điều chỉnh", detail.adjustments],
    ["Điều chỉnh KPI", detail.kpiAdjustment],
  ] as const;
  return (
    <Card>
      <Text style={styles.heading}>Chi tiết phiếu lương</Text>
      <Text style={styles.text}>
        Công chuẩn: {detail.standardDays} ngày · Thực tế: {detail.workedDays} ngày{"\n"}Thiếu công:{" "}
        {detail.shortageDays} ngày ({detail.shortageMinutes} phút)
      </Text>
      {rows.map(([label, amount]) => (
        <Text key={label} style={styles.text}>
          {label}: {payslipMoney(amount)}
        </Text>
      ))}
      <Text style={styles.muted}>KPI áp dụng: {detail.appliedKpiPercent}%</Text>
      {(data.warnings || []).map((warning, index) => (
        <Text key={index} style={styles.muted}>
          {warning}
        </Text>
      ))}
      <Text style={styles.muted}>
        Các khoản chi tiết theo dữ liệu và quy tắc hiển thị của LuxCare. Một số khoản đã nằm trong tổng khấu trừ; không
        cộng lại các dòng để suy ra thực nhận.
      </Text>
    </Card>
  );
}
