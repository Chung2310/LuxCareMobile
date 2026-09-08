import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, styles } from "../../ui";
import { type PayrollVariable, variableUnits } from "./variableModel";
import { canTransitionVariable, validateVariableTransition, type VariableAction } from "./variableTransitionModel";
export function TransitionPayrollVariable({
  item,
  action,
  onClose,
  onChanged,
}: {
  item: PayrollVariable;
  action: VariableAction;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useSession();
  const allowed = canTransitionVariable(user, item, action);
  const active = useRef(false),
    attempted = useRef(false);
  const [busy, setBusy] = useState(false),
    [done, setDone] = useState(false),
    [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
      };
    }, []),
  );
  const save = async () => {
    if (!allowed || attempted.current) return;
    attempted.current = true;
    setBusy(true);
    try {
      const result = await (action === "activate"
        ? payroll.activatePeriodInputVariable(item._id)
        : payroll.retirePeriodInputVariable(item._id));
      validateVariableTransition(result, item, action);
      if (active.current) setDone(true);
    } catch (error) {
      if (active.current) setError(`${messageOf(error)} Tải lại trước khi thao tác tiếp.`);
    } finally {
      if (active.current) setBusy(false);
    }
  };
  if (!allowed) return null;
  return (
    <Card>
      <Text style={styles.heading}>
        {action === "activate" ? "Áp dụng biến" : "Ngưng áp dụng biến"} · {item.code}
      </Text>
      <Text style={styles.text}>
        {item.name} · {variableUnits[item.unit as keyof typeof variableUnits] || item.unit} · Mặc định:{" "}
        {item.defaultValue ?? "Chưa cấu hình"}
      </Text>
      <Text style={styles.muted}>Thay đổi dùng chung công ty {item.companyCode}, không riêng chi nhánh.</Text>
      <Text style={styles.text}>
        {action === "activate"
          ? "Biến sẽ có trong danh sách đang áp dụng khi tải lại dữ liệu đối soát."
          : "Biến sẽ rời danh sách đang áp dụng. Các giá trị đối soát đã lưu không bị xóa."}
      </Text>
      <Text style={styles.muted}>
        Thao tác không tự tính lại bảng lương. Tải lại danh mục và đầu vào để kiểm tra trước lần tính tiếp theo.
      </Text>
      {done && <Text style={styles.text}>Đã cập nhật trạng thái biến.</Text>}
      <ErrorText message={error} />
      {!attempted.current && <Button title="Quay lại" onPress={onClose} />}
      {!done && (
        <Button
          title={busy ? "Đang xử lý…" : action === "activate" ? "Xác nhận áp dụng" : "Xác nhận ngưng áp dụng"}
          disabled={busy || attempted.current}
          onPress={() => void save()}
        />
      )}
      {attempted.current && <Button title="Tải lại danh mục và đầu vào" disabled={busy} onPress={onChanged} />}
    </Card>
  );
}
