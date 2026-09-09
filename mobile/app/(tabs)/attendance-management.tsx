import { useCallback, useRef, useState } from "react";
import { Modal, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import type { AttendanceLog, ShiftEmployee } from "../../../src/services/attendanceService";
import { currentKpiPeriod, validateKpiPeriod } from "../../../src/services/monthlyKpiService";
import { attendance } from "../../src/api/services";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { Button, Card, EmptyState, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { AdjustmentForm } from "../../src/features/attendance/AdjustmentForm";
import { ATTENDANCE_STATUSES } from "../../src/features/attendance/adjustment";
export default function AttendanceManagement() {
  const { user, selectedBranch } = useSession();
  const allowed = canUseModule(user, "hr") && hasPermission(user, "timekeeping:manage") && !!user?.companyCode;
  const [people, setPeople] = useState<ShiftEmployee[]>([]);
  const [employee, setEmployee] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState(currentKpiPeriod);
  const [draft, setDraft] = useState(period);
  const [revision, setRevision] = useState(0);
  const [rows, setRows] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peopleError, setPeopleError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AttendanceLog | null>(null);
  const lock = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setPeople([]);
      setPeopleError(null);
      if (allowed)
        void attendance
          .assignments()
          .then((rows) => {
            if (active) setPeople(rows);
          })
          .catch((error) => {
            if (active) setPeopleError(messageOf(error));
          });
      return () => {
        active = false;
      };
    }, [allowed, user?.companyCode, selectedBranch?._id, revision]),
  );
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setRows([]);
      setError(null);
      setLoading(false);
      if (!allowed || !employee || !user?.companyCode) return;
      setLoading(true);
      const [year, month] = period.split("-").map(Number);
      void attendance
        .history(
          employee,
          user.companyCode,
          `${period}-01`,
          `${period}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`,
        )
        .then((rows) => {
          if (active) setRows(rows);
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
    }, [allowed, employee, period, revision, user?.companyCode, selectedBranch?._id]),
  );
  const close = () => {
    if (lock.current) return;
    setSelected(null);
    setRevision((value) => value + 1);
  };
  if (!allowed)
    return (
      <Page title="Quản lý công">
        <Text style={styles.text}>Cần phân hệ nhân sự, doanh nghiệp và quyền quản lý chấm công.</Text>
      </Page>
    );
  return (
    <>
      <Page title="Quản lý công">
        <Text style={styles.muted}>
          Chọn nhân viên để xem công theo tháng trong phạm vi API cho phép. Danh sách chọn gồm nhân viên đang hoạt động
          của doanh nghiệp.
        </Text>
        <Field label="Tìm nhân viên" value={search} onChangeText={setSearch} />
        <ErrorText message={peopleError} />
        <ChoiceField
          label="Nhân viên"
          value={employee}
          choices={people
            .filter(
              (person) =>
                person._id === employee ||
                `${person.displayName || ""} ${person.email}`.toLowerCase().includes(search.toLowerCase()),
            )
            .map((person) => ({ value: person._id, label: person.displayName || person.email }))}
          onChange={setEmployee}
        />
        <Field label="Tháng (YYYY-MM)" value={draft} onChangeText={setDraft} />
        <Button
          title="Xem tháng"
          onPress={() => {
            try {
              setPeriod(validateKpiPeriod(draft.trim()));
              setRevision((value) => value + 1);
            } catch (error) {
              setError(messageOf(error));
            }
          }}
        />
        <ErrorText message={error} />
        {loading && <Loading />}
        {rows.map((log) => (
          <Card key={log._id}>
            <Text style={styles.heading}>{log.date}</Text>
            <Text style={styles.text}>
              {ATTENDANCE_STATUSES.find((item) => item.value === log.status)?.label || log.status}
            </Text>
            <Text style={styles.muted}>{log.note || "Không có ghi chú"}</Text>
            <Button title="Chỉnh công & lịch sử" onPress={() => setSelected(log)} />
          </Card>
        ))}
        {!loading && !error && employee && !rows.length && (
          <EmptyState message="Không có bản ghi trong tháng" />
        )}
        <Button title="Tải lại" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
      </Page>
      <Modal visible={!!selected} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.page}>
          {selected && (
            <AdjustmentForm
              log={selected}
              setLocked={(value) => {
                lock.current = value;
              }}
              onClose={() => {
                setSelected(null);
                setRevision((value) => value + 1);
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}
