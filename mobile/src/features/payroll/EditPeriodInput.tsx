import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, styles } from "../../ui";
import { periodInputFields, inputValue, type PeriodInput, type PeriodInputs } from "./periodInputModel";
import { canEditPeriodInput, periodInputEditPayload, validateEditedPeriodInput } from "./periodInputEditModel";
export function EditPeriodInput({
  item,
  editable,
  name,
  onClose,
  onChanged,
  variables,
}: {
  item: PeriodInput;
  editable: boolean;
  name: string;
  onClose: () => void;
  onChanged: () => void;
  variables: PeriodInputs["variables"];
}) {
  const { user, selectedBranch } = useSession();
  const allowed = canEditPeriodInput(user, selectedBranch?._id || user?.branchId, editable, item);
  const [values, setValues] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [clearFields, setClearFields] = useState<string[]>([]);
  const [payload, setPayload] = useState<ReturnType<typeof periodInputEditPayload> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
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
    if (!allowed || !payload || attempted.current) return;
    attempted.current = true;
    setBusy(true);
    try {
      validateEditedPeriodInput(await payroll.savePeriodInput(item.periodKey, item.employeeId, payload), item, payload);
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
        Chỉnh đối soát · {name} · {item.periodKey}
      </Text>
      <Text style={styles.muted}>
        Chi nhánh: {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}. Ô trống giữ dữ liệu cũ; nhập 0 để ghi đè
        bằng 0. Chọn “Dùng dữ liệu nguồn” để bỏ giá trị đối soát đã lưu; giá trị nguồn sẽ được xác định khi tính lại
        lương.
      </Text>
      {!payload ? (
        <>
          {(Object.keys(periodInputFields) as (keyof typeof periodInputFields)[]).map((key) => (
            <Card key={key}>
              <Field
                label={`${periodInputFields[key]} · hiện tại: ${inputValue(item[key])}`}
                value={values[key] || ""}
                onChangeText={(value) => setValues((values) => ({ ...values, [key]: value }))}
                keyboardType="decimal-pad"
                editable={!clearFields.includes(key)}
              />
              {item[key] !== undefined && (
                <Button
                  title={clearFields.includes(key) ? "Bỏ chọn hoàn tác" : "Dùng dữ liệu nguồn"}
                  onPress={() =>
                    setClearFields((fields) =>
                      fields.includes(key) ? fields.filter((field) => field !== key) : [...fields, key],
                    )
                  }
                />
              )}
              {clearFields.includes(key) && (
                <Text style={styles.muted}>Sẽ bỏ giá trị đối soát riêng của trường này.</Text>
              )}
            </Card>
          ))}
          <Field label="Lý do đối soát (bắt buộc)" value={reason} onChangeText={setReason} multiline />
          {variables.map((variable) => (
            <Card key={variable.code}>
              <Field
                label={`${variable.name} (${variable.code}, ${variable.unit}) · hiện tại: ${item.customValues?.[variable.code] === undefined ? "Chưa nhập riêng" : inputValue(item.customValues[variable.code])}`}
                value={custom[variable.code] || ""}
                keyboardType="decimal-pad"
                editable={!clearFields.includes(`custom.${variable.code}`)}
                onChangeText={(value) => setCustom((values) => ({ ...values, [variable.code]: value }))}
              />
              <Text style={styles.muted}>
                Mặc định: {variable.defaultValue === undefined ? "Chưa cấu hình" : inputValue(variable.defaultValue)}
              </Text>
              {item.customValues?.[variable.code] !== undefined && (
                <Button
                  title={
                    clearFields.includes(`custom.${variable.code}`)
                      ? "Bỏ chọn hoàn tác biến"
                      : "Bỏ giá trị biến đã nhập"
                  }
                  onPress={() =>
                    setClearFields((fields) =>
                      fields.includes(`custom.${variable.code}`)
                        ? fields.filter((field) => field !== `custom.${variable.code}`)
                        : [...fields, `custom.${variable.code}`],
                    )
                  }
                />
              )}
            </Card>
          ))}
          <Button
            title="Xem lại thay đổi"
            onPress={() => {
              try {
                setPayload(periodInputEditPayload(item, values, reason, clearFields, custom, variables));
                setError(null);
              } catch (error) {
                setError(messageOf(error));
              }
            }}
          />
        </>
      ) : (
        <>
          {(Object.keys(periodInputFields) as (keyof typeof periodInputFields)[])
            .filter((key) => payload[key] !== undefined)
            .map((key) => (
              <Text key={key} style={styles.text}>
                {periodInputFields[key]}: {inputValue(item[key])} → {inputValue(payload[key])}
              </Text>
            ))}
          <Text style={styles.text}>Lý do: {payload.reason}</Text>
          {payload.clearFields
            ?.filter((key) => !key.startsWith("custom."))
            .map((field) => {
              const key = field as keyof typeof periodInputFields;
              return (
                <Text key={key} style={styles.text}>
                  {periodInputFields[key]}: {inputValue(item[key])} → Dùng dữ liệu nguồn
                </Text>
              );
            })}
          {variables
            .filter(
              (variable) =>
                payload.clearFields?.includes(`custom.${variable.code}`) ||
                (payload.customValues?.[variable.code] !== undefined &&
                  payload.customValues[variable.code] !== item.customValues?.[variable.code]),
            )
            .map((variable) => (
              <Text key={variable.code} style={styles.text}>
                {variable.name} ({variable.code}):{" "}
                {item.customValues?.[variable.code] === undefined
                  ? "Chưa nhập riêng"
                  : inputValue(item.customValues[variable.code])}{" "}
                →{" "}
                {payload.clearFields?.includes(`custom.${variable.code}`)
                  ? "Bỏ giá trị riêng, dùng mặc định khi tính lại"
                  : inputValue(payload.customValues?.[variable.code])}
              </Text>
            ))}
          <Text style={styles.muted}>
            Lưu dữ liệu đầu vào chưa tính lại bảng lương. Tải lại kỳ để kiểm tra cờ cần cập nhật.
          </Text>
          {!attempted.current && <Button title="Sửa lại" onPress={() => setPayload(null)} />}
          {!done && (
            <Button
              title={busy ? "Đang lưu…" : "Xác nhận lưu đối soát"}
              disabled={busy || attempted.current}
              onPress={() => void save()}
            />
          )}
        </>
      )}
      <ErrorText message={error} />
      {done && <Text style={styles.text}>Đã lưu dữ liệu đối soát.</Text>}
      {!attempted.current ? (
        <Button title="Đóng" onPress={onClose} />
      ) : (
        <Button title="Tải lại kỳ và đối soát" disabled={busy} onPress={onChanged} />
      )}
    </Card>
  );
}
