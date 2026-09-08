import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { PayrollRun } from "../../../src/types/payrollRun";
import { payroll } from "../../src/api/services";
import { useSession, messageOf } from "../../src/auth/SessionProvider";
import { hasPermission } from "../../src/auth/access";
import { Button, Card, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
import {
  canReadPayrollRuns,
  effectiveRunLines,
  runStatuses,
  validPayrollPeriod,
} from "../../src/features/payroll/runModel";
import { payslipMoney } from "../../src/features/payroll/model";
import { PayslipDetails } from "../../src/features/payroll/PayslipDetails";
import { PaymentHistory } from "../../src/features/payroll/PaymentHistory";
import { PayrollExport } from "../../src/features/payroll/PayrollExport";
import { PayrollIssues } from "../../src/features/payroll/PayrollIssues";
import { CreatePayrollRun } from "../../src/features/payroll/CreatePayrollRun";
import { SyncRunAttendance } from "../../src/features/payroll/SyncRunAttendance";
import { CalculatePayrollRun } from "../../src/features/payroll/CalculatePayrollRun";
import { ReviewPayrollRun } from "../../src/features/payroll/ReviewPayrollRun";
import { PayslipPublication } from "../../src/features/payroll/PayslipPublication";
import { AdjustmentHistory } from "../../src/features/payroll/AdjustmentHistory";
import { PayrollAuditHistory } from "../../src/features/payroll/PayrollAuditHistory";
import { canReadRunPayments } from "../../src/features/payroll/paymentModel";
export default function PayrollRuns() {
  const { user, selectedBranch } = useSession();
  const allowed = canReadPayrollRuns(user);
  const branchId = selectedBranch?._id || user?.branchId;
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [draft, setDraft] = useState(period);
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [issueRunId, setIssueRunId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setRun(null);
      setIssueRunId(null);
      setError(null);
      setMissing(false);
      setExpanded(null);
      setLoading(false);
      if (!allowed || !branchId) return;
      setLoading(true);
      void payroll
        .getRun(period)
        .then((value) => {
          if (!value?._id || value.periodKey !== period) throw new Error("Bảng lương trả về không khớp kỳ đã chọn.");
          if (active) setIssueRunId(value._id);
          effectiveRunLines(value);
          if (active) setRun(value);
        })
        .catch((error) => {
          if (!active) return;
          if (error?.status === 404 && error?.code === "PAYROLL_RUN_NOT_FOUND") setMissing(true);
          else setError(messageOf(error));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [allowed, branchId, user?.uid, user?.companyCode, period, revision]),
  );
  if (!allowed)
    return (
      <Page title="Tra cứu bảng lương">
        <Text style={styles.text}>Cần phân hệ nhân sự và quyền xem kỳ lương.</Text>
      </Page>
    );
  if (!branchId)
    return (
      <Page title="Tra cứu bảng lương">
        <Text style={styles.text}>Chọn chi nhánh trong tài khoản để tra cứu.</Text>
      </Page>
    );
  const lines = run?.effectiveLines || [];
  const rows = lines.filter((line) =>
    `${line.employeeName || ""} ${line.employeeId}`
      .toLocaleLowerCase("vi-VN")
      .includes(search.trim().toLocaleLowerCase("vi-VN")),
  );
  const totalNet = lines.reduce((sum, line) => sum + (line.calculation.net ?? line.calculation.netPay ?? NaN), 0);
  const detailAllowed = hasPermission(user, "payroll-payment:read") || hasPermission(user, "payroll-payment:manage");
  return (
    <Page title="Tra cứu bảng lương">
      <Text style={styles.muted}>Chi nhánh: {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}</Text>
      <Field label="Kỳ lương (YYYY-MM)" value={draft} onChangeText={setDraft} />
      <ErrorText message={inputError} />
      <Button
        title="Tra cứu / tải lại"
        disabled={loading}
        onPress={() => {
          const value = draft.trim();
          if (!validPayrollPeriod(value)) {
            setInputError("Nhập kỳ hợp lệ dạng YYYY-MM, ví dụ 2026-09.");
            return;
          }
          setInputError(null);
          setPeriod(value);
          setRevision((value) => value + 1);
        }}
      />
      {loading && <Loading />}
      <ErrorText message={error} />
      {issueRunId && (
        <PayrollIssues
          key={`issues:${issueRunId}:${revision}`}
          runId={issueRunId}
          employees={run?.effectiveLines || []}
        />
      )}
      {missing && <Text style={styles.text}>Chưa có bảng lương cho kỳ {period}.</Text>}
      {missing && !loading && (
        <CreatePayrollRun
          key={`create:${period}:${revision}`}
          period={period}
          onChanged={() => setRevision((value) => value + 1)}
        />
      )}
      <AdjustmentHistory
        key={`${period}:${revision}`}
        period={period}
        onChanged={() => setRevision((value) => value + 1)}
      />
      {run && (
        <>
          <Card>
            <Text style={styles.heading}>
              Kỳ {run.periodKey} · {runStatuses[run.status] || run.status}
            </Text>
            <Text style={styles.text}>
              {lines.length} nhân viên · Tổng thực nhận: {payslipMoney(totalNet)}
            </Text>
            <Text style={styles.muted}>Tổng theo các dòng lương có hiệu lực, không phải số tiền đã thanh toán.</Text>
          </Card>
          <Field
            label="Tìm tên hoặc mã nhân viên trong kỳ"
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setExpanded(null);
            }}
          />
          <PayrollExport key={`export:${run._id}:${revision}`} run={run} />
          <ReviewPayrollRun
            close
            key={`close:${run._id}:${run.version}:${revision}`}
            run={run}
            onChanged={() => setRevision((value) => value + 1)}
          />
          <ReviewPayrollRun
            key={`review:${run._id}:${run.version}:${revision}`}
            run={run}
            onChanged={() => setRevision((value) => value + 1)}
          />
          <CalculatePayrollRun
            key={`calculate:${run._id}:${run.version}:${revision}`}
            run={run}
            onChanged={() => setRevision((value) => value + 1)}
          />
          <SyncRunAttendance
            key={`sync:${run._id}:${run.version}:${revision}`}
            run={run}
            onChanged={() => setRevision((value) => value + 1)}
          />
          <PayslipPublication
            key={`publication:${run._id}:${revision}`}
            run={run}
            onChanged={() => setRevision((value) => value + 1)}
          />
          {canReadRunPayments(user) && <PaymentHistory key={run._id} runId={run._id} employees={lines} />}
          {!rows.length && <Text style={styles.text}>Không có dòng lương phù hợp.</Text>}
          {rows.map((line) => (
            <Card key={line.employeeId}>
              <Text style={styles.heading}>{line.employeeName || line.employeeId}</Text>
              <Text style={styles.text}>
                Tổng thu nhập: {payslipMoney(line.calculation.gross)}
                {"\n"}Thực nhận: {payslipMoney(line.calculation.net ?? line.calculation.netPay)}
              </Text>
              {(line.warnings || []).map((warning, index) => (
                <Text key={index} style={styles.muted}>
                  {warning}
                </Text>
              ))}
              {detailAllowed && (
                <Button
                  title={expanded === line.employeeId ? "Thu gọn" : "Chi tiết dòng lương"}
                  onPress={() => setExpanded(expanded === line.employeeId ? null : line.employeeId)}
                />
              )}
              {detailAllowed && expanded === line.employeeId && (
                <PayslipDetails item={{ runId: run._id, employeeId: line.employeeId }} />
              )}
            </Card>
          ))}
        </>
      )}
      <PayrollAuditHistory key={`audit:${period}:${revision}`} period={period} />
    </Page>
  );
}
