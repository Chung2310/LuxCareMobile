import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { UserProfile } from "../../../../src/types/common";
import { roster } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Loading, styles } from "../../ui";
import { canCreatePayrollRun } from "./createRunModel";
import { validPayrollPeriod } from "./runModel";
import { type PeriodInput, type PeriodInputs } from "./periodInputModel";
import { EditPeriodInput } from "./EditPeriodInput";
import { newPeriodInput, periodInputCandidates } from "./createPeriodInputModel";
export function CreatePeriodInput({
  period,
  data,
  onClose,
  onChanged,
}: {
  period: string;
  data: PeriodInputs;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user, selectedBranch } = useSession();
  const branchId = selectedBranch?._id || user?.branchId;
  const allowed = canCreatePayrollRun(user, branchId) && data.editable && validPayrollPeriod(period);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [selected, setSelected] = useState<{ item: PeriodInput; name: string } | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [limit, setLimit] = useState(20);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setSelected(null);
      setEmployees([]);
      setError(null);
      setLoading(false);
      if (!allowed || !user?.companyCode || !branchId) return;
      setLoading(true);
      void roster
        .list(user.companyCode, branchId)
        .then((value) => {
          const candidates = periodInputCandidates(value, data.items, user.companyCode!, branchId);
          if (active) setEmployees(candidates);
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
    }, [allowed, branchId, user?.uid, user?.companyCode, period, data.items, revision]),
  );
  if (!allowed) return null;
  if (selected)
    return (
      <EditPeriodInput
        key={selected.item.employeeId}
        creating
        item={selected.item}
        name={selected.name}
        editable={data.editable}
        variables={data.variables}
        onClose={() => setSelected(null)}
        onChanged={onChanged}
      />
    );
  const rows = employees.filter((employee) =>
    `${employee.displayName || ""} ${employee.uid}`
      .toLocaleLowerCase("vi-VN")
      .includes(search.trim().toLocaleLowerCase("vi-VN")),
  );
  return (
    <Card>
      <Text style={styles.heading}>Thêm đối soát · {period}</Text>
      <Text style={styles.muted}>
        Chọn nhân viên trong chi nhánh chưa có bản ghi đối soát. Cần nhập ít nhất một giá trị và lý do ở bước tiếp theo.
      </Text>
      {loading && <Loading />}
      <ErrorText message={error} />
      {error && <Button title="Tải lại nhân viên" onPress={() => setRevision((value) => value + 1)} />}
      <Field
        label="Tìm tên hoặc mã nhân viên"
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setLimit(20);
        }}
      />
      {!loading && !error && !rows.length && (
        <Text style={styles.text}>Không có nhân viên phù hợp chưa có đối soát.</Text>
      )}
      {!loading &&
        !error &&
        rows.slice(0, limit).map((employee) => (
          <Button
            key={employee.uid}
            title={`${employee.displayName || employee.uid} · ${employee.uid}`}
            onPress={() => {
              try {
                setSelected({
                  item: newPeriodInput(employee.uid, period, employees),
                  name: employee.displayName || employee.uid,
                });
              } catch (error) {
                setError(messageOf(error));
              }
            }}
          />
        ))}
      {rows.length > limit && <Button title="Xem thêm 20 nhân viên" onPress={() => setLimit((value) => value + 20)} />}
      <Button title="Đóng" onPress={onClose} />
    </Card>
  );
}
