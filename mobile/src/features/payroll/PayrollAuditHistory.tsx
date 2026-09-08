import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { PayrollAudit } from "../../../../src/types/payrollAudit";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Loading, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { canReadPayrollRuns } from "./runModel";
import { auditActions, auditTime, filterPayrollAudit } from "./auditModel";
export function PayrollAuditHistory({ period }: { period: string }) {
  const { user, selectedBranch } = useSession();
  const allowed = canReadPayrollRuns(user);
  const [items, setItems] = useState<PayrollAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [count, setCount] = useState(20);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setItems([]);
      setError(null);
      setLoading(false);
      setCount(20);
      if (!allowed) return;
      setLoading(true);
      void payroll
        .getAudit(period)
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
    }, [allowed, period, user?.uid, user?.companyCode, user?.branchId, selectedBranch?._id, revision]),
  );
  if (!allowed) return null;
  const actions = [...new Set([...items.map((item) => item.action), action])].filter(Boolean);
  const rows = filterPayrollAudit(items, action, search);
  return (
    <Card>
      <Text style={styles.heading}>Nhật ký kỳ {period}</Text>
      <Text style={styles.muted}>
        Các thao tác do API ghi nhận, mới nhất trước. Người thực hiện hiển thị bằng mã tài khoản do API cung cấp.
      </Text>
      <Field
        label="Tìm thao tác hoặc mã người thực hiện"
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setCount(20);
        }}
      />
      <ChoiceField
        label="Loại thao tác"
        value={action}
        choices={[
          { value: "", label: "Tất cả" },
          ...actions.map((value) => ({ value, label: auditActions[value] || value })),
        ]}
        onChange={(value) => {
          setAction(value);
          setCount(20);
        }}
      />
      <Button
        title="Đặt lại bộ lọc"
        onPress={() => {
          setSearch("");
          setAction("");
          setCount(20);
        }}
      />
      <Button title="Tải lại nhật ký" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
      {loading && <Loading />}
      <ErrorText message={error} />
      {!loading && !error && (
        <>
          <Text style={styles.muted}>{rows.length} bản ghi phù hợp</Text>
          {!rows.length && <Text style={styles.text}>Chưa có nhật ký phù hợp.</Text>}
          {rows.slice(0, count).map((item) => (
            <Card key={item._id}>
              <Text style={styles.heading}>{auditActions[item.action] || item.action}</Text>
              <Text style={styles.text}>{auditTime(item.createdAt)}</Text>
              <Text selectable style={styles.text}>
                Người thực hiện: {item.actorId}
              </Text>
              {typeof item.metadata?.reason === "string" && (
                <Text style={styles.text}>Lý do: {item.metadata.reason}</Text>
              )}
              {typeof item.metadata?.adjustmentId === "string" && (
                <Text selectable style={styles.muted}>
                  Mã điều chỉnh: {item.metadata.adjustmentId}
                </Text>
              )}
            </Card>
          ))}
          {count < rows.length && (
            <Button title="Xem thêm 20 bản ghi" onPress={() => setCount((value) => value + 20)} />
          )}
        </>
      )}
    </Card>
  );
}
