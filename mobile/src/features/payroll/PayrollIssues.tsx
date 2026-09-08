import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { PayrollIssue } from "../../../../src/types/payrollIssue";
import type { PayrollRunLine } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Loading, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { canReadPayrollRuns } from "./runModel";
import { filterPayrollIssues, issueSeverities } from "./issueModel";
export function PayrollIssues({ runId, employees }: { runId: string; employees: PayrollRunLine[] }) {
  const { user, selectedBranch } = useSession();
  const allowed = canReadPayrollRuns(user);
  const [items, setItems] = useState<PayrollIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [severity, setSeverity] = useState("");
  const [search, setSearch] = useState("");
  const [count, setCount] = useState(20);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setItems([]);
      setError(null);
      setCount(20);
      setLoading(false);
      if (!allowed) return;
      setLoading(true);
      void payroll
        .getRunIssues(runId)
        .then((value) => {
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
  const rows = filterPayrollIssues(items, severity, search, employees);
  const names = new Map(employees.map((item) => [item.employeeId, item.employeeName]));
  const severities = [...new Set([...Object.keys(issueSeverities), ...items.map((item) => item.severity)])];
  return (
    <Card>
      <Text style={styles.heading}>Lỗi và cảnh báo kỳ lương</Text>
      <Text style={styles.muted}>
        Các vấn đề được lưu từ lần xử lý kỳ lương. Tải lại danh sách không tính lại lương hay kiểm tra lại dữ liệu đầu
        vào.
      </Text>
      <Field
        label="Tìm nhân viên, mã lỗi hoặc nội dung"
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setCount(20);
        }}
      />
      <ChoiceField
        label="Mức độ"
        value={severity}
        choices={[
          { value: "", label: "Tất cả" },
          ...severities.map((value) => ({ value, label: issueSeverities[value] || value })),
        ]}
        onChange={(value) => {
          setSeverity(value);
          setCount(20);
        }}
      />
      <Button
        title="Đặt lại bộ lọc"
        onPress={() => {
          setSearch("");
          setSeverity("");
          setCount(20);
        }}
      />
      <Button title="Tải lại lỗi và cảnh báo" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
      {loading && <Loading />}
      <ErrorText message={error} />
      {!loading && !error && (
        <>
          <Text style={styles.text}>
            {items.filter((item) => item.severity === "blocking").length} lỗi chặn xử lý ·{" "}
            {items.filter((item) => item.severity === "warning").length} cảnh báo · {rows.length}/{items.length} mục phù
            hợp
          </Text>
          {!rows.length && <Text style={styles.muted}>Không có vấn đề phù hợp trong danh sách đã ghi nhận.</Text>}
          {rows.slice(0, count).map((item, index) => (
            <Card key={`${item.code}:${item.employeeId || "run"}:${index}`}>
              <Text style={styles.heading}>
                {issueSeverities[item.severity] || item.severity} · {item.code}
              </Text>
              <Text style={styles.text}>{item.message}</Text>
              <Text style={styles.text}>
                {item.employeeId ? `Nhân viên: ${names.get(item.employeeId) || item.employeeId}` : "Phạm vi: kỳ lương"}
              </Text>
              {item.field && <Text style={styles.muted}>Trường liên quan: {item.field}</Text>}
              {item.remediation && <Text style={styles.text}>Hướng khắc phục: {item.remediation}</Text>}
            </Card>
          ))}
          {count < rows.length && <Button title="Xem thêm 20 mục" onPress={() => setCount((value) => value + 20)} />}
        </>
      )}
    </Card>
  );
}
