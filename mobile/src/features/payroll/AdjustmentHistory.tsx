import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Modal, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AdjustmentDecision } from "./AdjustmentDecision";
import { canDecideAdjustment } from "./adjustmentModel";
import type { PayrollAdjustment } from "../../../../src/types/payrollAdjustment";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Loading, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { contractDate } from "../contracts/model";
import { canReadPayrollRuns } from "./runModel";
import { payslipMoney } from "./model";
import { adjustmentKinds, adjustmentStatuses, filterAdjustments } from "./adjustmentModel";
export function AdjustmentHistory({ period, onChanged }: { period: string; onChanged: () => void }) {
  const { user, selectedBranch } = useSession();
  const allowed = canReadPayrollRuns(user);
  const [items, setItems] = useState<PayrollAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [revision, setRevision] = useState(0);
  const [decision, setDecision] = useState<{ item: PayrollAdjustment; approve: boolean } | null>(null);
  const lock = useRef(false);
  const close = () => {
    setDecision(null);
    onChanged();
  };
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setItems([]);
      setError(null);
      setLoading(false);
      if (!allowed) return;
      setLoading(true);
      void payroll
        .getAdjustments(period)
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
  const rows = filterAdjustments(items, search, status, kind);
  return (
    <Card>
      <Text style={styles.heading}>Điều chỉnh lương kỳ {period}</Text>
      <Text style={styles.muted}>
        Khoản đã duyệt chưa đồng nghĩa đã tính vào thực nhận. Kiểm tra trạng thái và bản tính lương tương ứng.
      </Text>
      <Field label="Tìm nhân viên hoặc lý do" value={search} onChangeText={setSearch} />
      <ChoiceField
        label="Loại điều chỉnh"
        value={kind}
        choices={[
          { value: "", label: "Tất cả" },
          ...Object.entries(adjustmentKinds).map(([value, label]) => ({ value, label })),
        ]}
        onChange={setKind}
      />
      <ChoiceField
        label="Trạng thái điều chỉnh"
        value={status}
        choices={[
          { value: "", label: "Tất cả" },
          ...Object.entries(adjustmentStatuses).map(([value, label]) => ({ value, label })),
        ]}
        onChange={setStatus}
      />
      <Button
        title="Đặt lại bộ lọc"
        onPress={() => {
          setSearch("");
          setKind("");
          setStatus("");
        }}
      />
      <Button title="Tải lại điều chỉnh" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
      {loading && <Loading />}
      <ErrorText message={error} />
      {!loading && !error && (
        <>
          <Text style={styles.muted}>
            {rows.length}/{items.length} khoản điều chỉnh
          </Text>
          {!rows.length && <Text style={styles.text}>Không có khoản điều chỉnh phù hợp.</Text>}
          {rows.map((item) => (
            <Card key={item._id}>
              <Text style={styles.heading}>{item.employeeName || item.employeeId}</Text>
              <Text style={styles.text}>
                {adjustmentKinds[item.kind] || item.kind}: {payslipMoney(item.amount)}
              </Text>
              <Text style={styles.text}>{adjustmentStatuses[item.status] || item.status}</Text>
              <Text style={styles.text}>Lý do: {item.reason}</Text>
              {canDecideAdjustment(user, item) && (
                <>
                  <Button title="Duyệt" onPress={() => setDecision({ item, approve: true })} />
                  <Button title="Từ chối" onPress={() => setDecision({ item, approve: false })} />
                </>
              )}
              {item.createdAt && <Text style={styles.muted}>Ngày tạo: {contractDate(item.createdAt)}</Text>}
              {item.snapshotAt && (
                <Text style={styles.muted}>Ngày đưa vào bản tính: {contractDate(item.snapshotAt)}</Text>
              )}
            </Card>
          ))}
        </>
      )}
      <Modal
        visible={!!decision}
        animationType="slide"
        onRequestClose={() => {
          if (!lock.current) close();
        }}
      >
        <SafeAreaView style={styles.page}>
          {decision && (
            <AdjustmentDecision
              item={decision.item}
              approve={decision.approve}
              setLocked={(value) => {
                lock.current = value;
              }}
              onClose={close}
            />
          )}
        </SafeAreaView>
      </Modal>
    </Card>
  );
}
