import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import {
  canManageVariables,
  variableUnits,
  variableInput,
  validateVariableDraft,
  type PayrollVariable,
} from "./variableModel";
export function CreatePayrollVariable({
  existing,
  onClose,
  onChanged,
}: {
  existing: PayrollVariable[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user } = useSession();
  const [code, setCode] = useState(""),
    [name, setName] = useState(""),
    [unit, setUnit] = useState("number"),
    [value, setValue] = useState(""),
    [description, setDescription] = useState("");
  const [payload, setPayload] = useState<ReturnType<typeof variableInput> | null>(null);
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  const active = useRef(false),
    attempted = useRef(false);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
      };
    }, []),
  );
  const save = async () => {
    if (!canManageVariables(user) || !user?.companyCode || !payload || attempted.current) return;
    attempted.current = true;
    setBusy(true);
    try {
      validateVariableDraft(await payroll.createPeriodInputVariable(payload), user.companyCode, payload);
      if (active.current) setDone(true);
    } catch (error) {
      if (active.current) setError(`${messageOf(error)} Tải lại trước khi tạo tiếp.`);
    } finally {
      if (active.current) setBusy(false);
    }
  };
  if (!canManageVariables(user)) return null;
  return (
    <Card>
      <Text style={styles.heading}>Tạo biến lương nháp</Text>
      <Text style={styles.muted}>
        Danh mục dùng chung công ty {user?.companyCode}, không riêng chi nhánh. Biến nháp chưa được áp dụng vào đối
        soát.
      </Text>
      {!payload ? (
        <>
          <Field label="Mã biến" value={code} onChangeText={setCode} autoCapitalize="none" />
          <Field label="Tên biến" value={name} onChangeText={setName} />
          <ChoiceField
            label="Đơn vị"
            value={unit}
            choices={Object.entries(variableUnits).map(([value, label]) => ({ value, label }))}
            onChange={setUnit}
          />
          <Field label="Giá trị mặc định (tùy chọn)" value={value} onChangeText={setValue} keyboardType="decimal-pad" />
          <Field label="Mô tả (tùy chọn)" value={description} onChangeText={setDescription} multiline />
          <Button
            title="Xem lại biến mới"
            onPress={() => {
              try {
                setPayload(variableInput(code, name, unit, value, description, existing));
                setError(null);
              } catch (error) {
                setError(messageOf(error));
              }
            }}
          />
        </>
      ) : (
        <>
          <Text style={styles.text}>
            {payload.code} · {payload.name} · {variableUnits[payload.unit as keyof typeof variableUnits]}
          </Text>
          <Text style={styles.text}>Mặc định: {payload.defaultValue ?? "Chưa cấu hình"}</Text>
          <Text style={styles.text}>Mô tả: {payload.description || "—"}</Text>
          {!attempted.current && <Button title="Sửa lại" onPress={() => setPayload(null)} />}
          {!done && (
            <Button
              title={busy ? "Đang tạo…" : "Xác nhận tạo biến nháp"}
              disabled={busy || attempted.current}
              onPress={() => void save()}
            />
          )}
        </>
      )}
      <ErrorText message={error} />
      {done && <Text style={styles.text}>Đã tạo biến nháp.</Text>}
      {!attempted.current ? (
        <Button title="Đóng" onPress={onClose} />
      ) : (
        <Button title="Tải lại danh mục" disabled={busy} onPress={onChanged} />
      )}
    </Card>
  );
}
