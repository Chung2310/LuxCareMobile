import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import type { UserProfile } from "../../../../src/types/common";
import { payroll, roster } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { hasPermission } from "../../auth/access";
import { Button, ErrorText, Field, Loading, Page, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { canReadPayrollRuns } from "./runModel";
import { adjustmentKinds } from "./adjustmentModel";
import { adjustmentInput } from "./adjustmentFormModel";
export function AdjustmentForm({
  period,
  onClose,
  setLocked,
}: {
  period: string;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const { user, selectedBranch } = useSession();
  const branchId = selectedBranch?._id || user?.branchId;
  const allowed = canReadPayrollRuns(user) && hasPermission(user, "payroll-period:manage") && !!branchId;
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [employeeId, setEmployeeId] = useState("");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("bonus");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    setEmployees([]);
    setLoadError(null);
    setLoading(false);
    if (!allowed || !user?.companyCode) return;
    setLoading(true);
    void roster
      .list(user.companyCode, branchId)
      .then((value) => {
        if (active) setEmployees(value.filter((employee) => employee.branchId === branchId));
      })
      .catch((error) => {
        if (active) setLoadError(messageOf(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [allowed, user?.companyCode, branchId, revision]);
  const save = async () => {
    if (lock.current || blocked || loading || loadError || !allowed) return;
    let payload;
    try {
      payload = adjustmentInput(
        employeeId,
        employees.map((item) => item.uid),
        kind,
        amount,
        reason,
      );
    } catch (error) {
      setError(messageOf(error));
      return;
    }
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const saved = await payroll.createAdjustment(period, payload);
      if (!saved?._id || saved.periodKey !== period || saved.employeeId !== employeeId || saved.status !== "pending")
        throw new Error("Chưa xác nhận được khoản điều chỉnh đã tạo.");
      onClose();
    } catch (error) {
      setBlocked(true);
      setError(`${messageOf(error)} Đóng và tải lại để kiểm tra trước khi tạo tiếp.`);
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const disabled = busy || blocked || !allowed;
  return (
    <Page title={`Tạo điều chỉnh kỳ ${period}`}>
      {!allowed && <ErrorText message="Cần quyền đọc/quản lý kỳ lương và chi nhánh của phiên." />}
      {loading && <Loading />}
      <ErrorText message={loadError} />
      {loadError && (
        <Button title="Tải lại nhân viên" disabled={disabled} onPress={() => setRevision((value) => value + 1)} />
      )}
      {!loading && !loadError && !employees.length && (
        <Text style={styles.text}>Không có nhân viên được phép chọn trong chi nhánh.</Text>
      )}
      <Field label="Tìm nhân viên" value={search} onChangeText={setSearch} editable={!disabled} />
      <ChoiceField
        label="Nhân viên"
        value={employeeId}
        disabled={disabled || loading || !!loadError}
        choices={employees
          .filter(
            (item) =>
              item.uid === employeeId ||
              `${item.displayName} ${item.email}`.toLowerCase().includes(search.trim().toLowerCase()),
          )
          .map((item) => ({ value: item.uid, label: item.displayName || item.email || item.uid }))}
        onChange={setEmployeeId}
      />
      <ChoiceField
        label="Loại điều chỉnh"
        value={kind}
        choices={Object.entries(adjustmentKinds).map(([value, label]) => ({ value, label }))}
        onChange={setKind}
        disabled={disabled}
      />
      <Field
        label="Số tiền VND (không có dấu phân cách)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        editable={!disabled}
      />
      <Field label="Lý do" value={reason} onChangeText={setReason} multiline editable={!disabled} />
      <Text style={styles.muted}>
        Khoản mới ở trạng thái chờ duyệt. Chọn Khấu trừ cho khoản giảm, nhập số tiền không âm.
      </Text>
      <ErrorText message={error} />
      <Button
        title={busy ? "Đang gửi…" : "Tạo khoản chờ duyệt"}
        disabled={disabled || loading || !!loadError || !employees.length}
        onPress={() => void save()}
      />
      <Button title="Đóng và tải lại" disabled={busy} onPress={onClose} />
    </Page>
  );
}
