import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Loading, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { canReadPayrollRuns } from "./runModel";
import { inputValue } from "./periodInputModel";
import {
  canManageVariables,
  parseVariables,
  variableStatuses,
  variableUnits,
  type PayrollVariable,
} from "./variableModel";
import { CreatePayrollVariable } from "./CreatePayrollVariable";
import { canTransitionVariable, type VariableAction } from "./variableTransitionModel";
import { TransitionPayrollVariable } from "./TransitionPayrollVariable";
export function PayrollVariables({ onChanged }: { onChanged: () => void }) {
  const { user, selectedBranch } = useSession();
  const allowed = canReadPayrollRuns(user);
  const [items, setItems] = useState<PayrollVariable[]>([]),
    [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false),
    [creating, setCreating] = useState(false),
    [revision, setRevision] = useState(0),
    [limit, setLimit] = useState(20);
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("");
  const [selected, setSelected] = useState<{ item: PayrollVariable; action: VariableAction } | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setItems([]);
      setError(null);
      setCreating(false);
      setSelected(null);
      setLoading(false);
      setLimit(20);
      if (!allowed || !user?.companyCode) return;
      setLoading(true);
      void payroll
        .getPeriodInputVariables()
        .then((value) => {
          const parsed = parseVariables(value, user.companyCode!);
          if (active) setItems(parsed);
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
    }, [allowed, user?.uid, user?.companyCode, selectedBranch?._id, revision]),
  );
  if (!allowed) return null;
  const rows = items.filter(
    (item) =>
      (!status || item.status === status) &&
      `${item.code} ${item.name} ${item.description || ""}`
        .toLocaleLowerCase("vi-VN")
        .includes(search.trim().toLocaleLowerCase("vi-VN")),
  );
  return (
    <Card>
      <Text style={styles.heading}>Danh mục biến lương tùy chỉnh</Text>
      <Text style={styles.muted}>Dùng chung công ty {user?.companyCode}, gồm cả nháp và biến đã ngưng áp dụng.</Text>
      <Button
        title="Tải lại danh mục biến"
        disabled={loading || creating || !!selected}
        onPress={() => setRevision((value) => value + 1)}
      />
      {loading && <Loading />}
      <ErrorText message={error} />
      {!loading && !error && (
        <>
          {canManageVariables(user) && (
            <Button title="Thêm biến nháp" disabled={creating || !!selected} onPress={() => setCreating(true)} />
          )}
          {creating && (
            <CreatePayrollVariable
              existing={items}
              onClose={() => setCreating(false)}
              onChanged={() => setRevision((value) => value + 1)}
            />
          )}
          <Field
            label="Tìm mã, tên hoặc mô tả biến"
            value={search}
            editable={!creating && !selected}
            onChangeText={(value) => {
              setSearch(value);
              setLimit(20);
            }}
          />
          <ChoiceField
            label="Trạng thái biến"
            value={status}
            disabled={creating || !!selected}
            choices={[
              { value: "", label: "Tất cả" },
              ...Object.entries(variableStatuses).map(([value, label]) => ({ value, label })),
            ]}
            onChange={(value) => {
              setStatus(value);
              setLimit(20);
            }}
          />
          {!rows.length && <Text style={styles.text}>Không có biến phù hợp.</Text>}
          {rows.slice(0, limit).map((item) => (
            <Card key={item._id}>
              <Text style={styles.heading}>
                {item.name} · {item.code}
              </Text>
              <Text style={styles.text}>
                {variableStatuses[item.status as keyof typeof variableStatuses] || item.status} ·{" "}
                {variableUnits[item.unit as keyof typeof variableUnits] || item.unit}
              </Text>
              <Text style={styles.text}>
                Mặc định: {item.defaultValue === undefined ? "Chưa cấu hình" : inputValue(item.defaultValue)}
              </Text>
              <Text style={styles.text}>{item.description || "Chưa có mô tả"}</Text>
              {(["activate", "retire"] as const).map(
                (action) =>
                  canTransitionVariable(user, item, action) && (
                    <Button
                      key={action}
                      title={
                        action === "retire"
                          ? "Ngưng áp dụng"
                          : item.status === "retired"
                            ? "Áp dụng lại"
                            : "Áp dụng biến"
                      }
                      disabled={creating || !!selected}
                      onPress={() => setSelected({ item, action })}
                    />
                  ),
              )}
              {selected?.item._id === item._id && (
                <TransitionPayrollVariable
                  item={selected.item}
                  action={selected.action}
                  onClose={() => setSelected(null)}
                  onChanged={onChanged}
                />
              )}
            </Card>
          ))}
          {rows.length > limit && <Button title="Xem thêm 20 biến" onPress={() => setLimit((value) => value + 20)} />}
        </>
      )}
    </Card>
  );
}
