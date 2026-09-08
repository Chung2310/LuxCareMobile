import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { PayrollRunLine } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Loading, styles } from "../../ui";
import { canReadPayrollRuns, validPayrollPeriod } from "./runModel";
import { parsePeriodInputs, periodInputFields, inputValue, type PeriodInputs } from "./periodInputModel";
export function PayrollPeriodInputs({ period, employees }: { period: string; employees: PayrollRunLine[] }) {
  const { user, selectedBranch } = useSession();
  const branchId = selectedBranch?._id || user?.branchId;
  const allowed = canReadPayrollRuns(user) && !!branchId && validPayrollPeriod(period);
  const [data, setData] = useState<PeriodInputs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setData(null);
      setError(null);
      setExpanded(null);
      setLimit(20);
      setSearch("");
      setLoading(false);
      if (!allowed) return;
      setLoading(true);
      void payroll
        .getPeriodInputs(period)
        .then((value) => {
          const parsed = parsePeriodInputs(value, period);
          if (active) setData(parsed);
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
    }, [allowed, period, branchId, user?.uid, user?.companyCode, revision]),
  );
  if (!allowed) return null;
  const nameOf = (id: string) => employees.find((employee) => employee.employeeId === id)?.employeeName || id;
  const rows =
    data?.items.filter((item) =>
      `${nameOf(item.employeeId)} ${item.employeeId} ${item.reason || ""}`
        .toLocaleLowerCase("vi-VN")
        .includes(search.trim().toLocaleLowerCase("vi-VN")),
    ) || [];
  return (
    <Card>
      <Text style={styles.heading}>Dữ liệu đối soát đầu vào · {period}</Text>
      <Text style={styles.muted}>
        Các giá trị đã nhập riêng theo kỳ, chưa phải kết quả lương. Số 0 là giá trị đã nhập; trường chưa nhập dùng dữ
        liệu nguồn.
      </Text>
      <Button title="Tải lại dữ liệu đối soát" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
      {loading && <Loading />}
      <ErrorText message={error} />
      {data && (
        <>
          <Text style={styles.text}>
            {data.editable
              ? "Kỳ còn cho phép chỉnh dữ liệu đầu vào trên LuxCare."
              : "Dữ liệu đầu vào đã khóa theo trạng thái kỳ."}
          </Text>
          {data.needsRefresh && <Text style={styles.text}>Bảng lương cần cập nhật sau thay đổi dữ liệu đầu vào.</Text>}
          <Field
            label="Tìm nhân viên, mã hoặc lý do"
            value={search}
            onChangeText={(value) => {
              setSearch(value);
              setLimit(20);
              setExpanded(null);
            }}
          />
          <Text style={styles.muted}>{rows.length} bản ghi phù hợp. Chỉ liệt kê nhân viên đã có bản ghi đối soát.</Text>
          {!rows.length && <Text style={styles.text}>Không có bản ghi phù hợp.</Text>}
          {rows.slice(0, limit).map((item) => (
            <Card key={item.employeeId}>
              <Text style={styles.heading}>{nameOf(item.employeeId)}</Text>
              <Button
                title={expanded === item.employeeId ? "Thu gọn" : "Xem giá trị đối soát"}
                onPress={() => setExpanded(expanded === item.employeeId ? null : item.employeeId)}
              />
              {expanded === item.employeeId && (
                <>
                  {Object.entries(periodInputFields).map(([key, label]) => (
                    <Text key={key} style={styles.text}>
                      {label}: {inputValue(item[key as keyof typeof periodInputFields])}
                    </Text>
                  ))}
                  {Object.entries(item.customValues || {}).map(([code, value]) => {
                    const variable = data.variables.find((variable) => variable.code === code);
                    return (
                      <Text key={code} style={styles.text}>
                        {variable?.name || code} ({variable?.unit || "đơn vị chưa có"}): {inputValue(value)}
                      </Text>
                    );
                  })}
                  <Text style={styles.text}>Lý do: {item.reason || "—"}</Text>
                  <Text selectable style={styles.muted}>
                    Mã nhân viên: {item.employeeId} · Phiên bản: {item.version} · Người cập nhật:{" "}
                    {item.updatedBy || "—"}
                  </Text>
                </>
              )}
            </Card>
          ))}
          {rows.length > limit && (
            <Button title="Xem thêm 20 bản ghi" onPress={() => setLimit((value) => value + 20)} />
          )}
          {!!data.variables.length && (
            <>
              <Text style={styles.heading}>Biến tùy chỉnh đang áp dụng</Text>
              {data.variables.map((variable) => (
                <Text key={variable.code} style={styles.text}>
                  {variable.name} ({variable.code}, {variable.unit}) · Mặc định:{" "}
                  {variable.defaultValue === undefined ? "Chưa cấu hình" : inputValue(variable.defaultValue)}
                </Text>
              ))}
              <Text style={styles.muted}>
                Giá trị mặc định được hiển thị riêng, chưa cộng vào các khoản đối soát ở trên.
              </Text>
            </>
          )}
        </>
      )}
    </Card>
  );
}
