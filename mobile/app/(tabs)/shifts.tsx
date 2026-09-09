import { useCallback, useRef, useState } from "react";
import { Alert, Modal, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import type { WorkShift, ShiftEmployee } from "../../../src/services/attendanceService";
import { attendance } from "../../src/api/services";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { Button, Card, EmptyState, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { ShiftForm } from "../../src/features/shifts/ShiftForm";
import { assignmentDates } from "../../src/features/shifts/model";
export default function Shifts() {
  const { user } = useSession();
  const allowed = canUseModule(user, "hr") && hasPermission(user, "timekeeping:manage");
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [people, setPeople] = useState<ShiftEmployee[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [target, setTarget] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [editing, setEditing] = useState<WorkShift | "new" | null>(null);
  const lock = useRef(false);
  const formLock = useRef(false);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setShifts([]);
      setPeople([]);
      setSelected([]);
      setTarget("");
      setError(null);
      if (!allowed) return;
      setLoading(true);
      void Promise.all([attendance.shifts(), attendance.assignments()])
        .then(([list, employees]) => {
          if (active) {
            setShifts(list);
            setPeople(employees);
            setUncertain(false);
          }
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
    }, [allowed, user?.uid, user?.companyCode, revision]),
  );
  const reload = () => {
    setEditing(null);
    setRevision((value) => value + 1);
  };
  const run = async (action: () => Promise<unknown>, message: string) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await action();
      setSuccess(message);
      reload();
    } catch (error) {
      if (!(error && typeof error === "object" && "status" in error) || Number(error.status) >= 500) {
        setUncertain(true);
        setError("Chưa xác nhận kết quả. Tải lại dữ liệu để kiểm tra trước khi thao tác tiếp.");
      } else setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!allowed)
    return (
      <Page title="Quản lý ca">
        <Text style={styles.text}>Bạn chưa có quyền quản lý ca làm việc.</Text>
      </Page>
    );
  const disabled = busy || loading || uncertain;
  return (
    <>
      <Page title="Quản lý & phân ca">
        <Text style={styles.muted}>
          Danh mục và phân ca áp dụng trong toàn doanh nghiệp. Phân ca mới được lưu với ngày hiệu lực; danh sách dưới
          đây hiển thị lần phân ca mới nhất, có thể ở tương lai.
        </Text>
        <ErrorText message={error} />
        {success && <Text style={styles.text}>{success}</Text>}
        {loading && <Loading />}
        <Button title="Thêm ca" disabled={disabled} onPress={() => setEditing("new")} />
        {!loading && !shifts.length && <EmptyState message="Chưa có ca làm việc nào" />}
        {shifts.map((shift) => (
          <Card key={shift._id}>
            <Text style={styles.heading}>
              {shift.code} · {shift.name}
            </Text>
            <Text style={styles.text}>
              {shift.startTime}–{shift.endTime}
              {shift.crossesMidnight ? " (qua đêm)" : ""} · {shift.isActive ? "Hoạt động" : "Ngừng hoạt động"}
            </Text>
            <Button title="Sửa ca" disabled={disabled} onPress={() => setEditing(shift)} />
            <Button
              title="Xóa ca"
              disabled={disabled}
              onPress={() =>
                Alert.alert(
                  "Xóa ca?",
                  `${shift.name}. Ca đã được phân cho nhân viên có thể bị backend từ chối xóa; hãy ngừng hoạt động nếu cần.`,
                  [
                    { text: "Hủy", style: "cancel" },
                    {
                      text: "Xóa",
                      style: "destructive",
                      onPress: () => void run(() => attendance.removeShift(shift._id), "Đã xóa ca."),
                    },
                  ],
                )
              }
            />
          </Card>
        ))}
        <Card>
          <Text style={styles.heading}>Phân ca cho nhân sự</Text>
          <ChoiceField
            label="Ca đang hoạt động"
            value={target}
            choices={[
              { value: "", label: "Chọn ca" },
              ...shifts.filter((shift) => shift.isActive).map((shift) => ({ value: shift._id, label: shift.name })),
            ]}
            disabled={disabled}
            onChange={setTarget}
          />
          <Field label="Hiệu lực từ (YYYY-MM-DD)" value={start} editable={!disabled} onChangeText={setStart} />
          <Field label="Đến ngày (có thể trống)" value={end} editable={!disabled} onChangeText={setEnd} />
          <Field label="Tìm nhân viên" value={search} editable={!disabled} onChangeText={setSearch} />
          <Text style={styles.muted}>Đã chọn {selected.length} nhân viên</Text>
          {people
            .filter((person) =>
              `${person.displayName} ${person.email}`
                .toLocaleLowerCase("vi-VN")
                .includes(search.toLocaleLowerCase("vi-VN")),
            )
            .map((person) => (
              <Card key={person._id}>
                <Text style={styles.text}>{person.displayName || person.email}</Text>
                <Text style={styles.muted}>
                  {person.assignment
                    ? `${shifts.find((shift) => shift._id === person.assignment?.shiftId)?.name || "Ca đã lưu"} · ${person.assignment.effectiveFrom} → ${person.assignment.effectiveTo || "Không kết thúc"}`
                    : "Chưa có phân ca"}
                </Text>
                <Button
                  title={selected.includes(person._id) ? "Bỏ chọn" : "Chọn"}
                  disabled={disabled}
                  onPress={() =>
                    setSelected((value) =>
                      value.includes(person._id) ? value.filter((id) => id !== person._id) : [...value, person._id],
                    )
                  }
                />
              </Card>
            ))}
          {people.length > 0 &&
            people.filter((person) =>
              `${person.displayName} ${person.email}`
                .toLocaleLowerCase("vi-VN")
                .includes(search.toLocaleLowerCase("vi-VN")),
            ).length === 0 && (
              <EmptyState
                message="Không tìm thấy nhân viên"
                subtitle="Không có nhân sự nào phù hợp với từ khóa."
              />
            )}
          <Button
            title="Xác nhận phân ca"
            disabled={disabled || !selected.length || !target}
            onPress={() => {
              try {
                const dates = assignmentDates(start.trim(), end.trim());
                const shift = shifts.find((item) => item._id === target && item.isActive);
                if (!shift) throw new Error("Chọn ca đang hoạt động.");
                Alert.alert(
                  "Phân ca",
                  `Gán ca ${shift.name} cho ${selected.length} nhân viên từ ${dates.effectiveFrom}${dates.effectiveTo ? ` đến ${dates.effectiveTo}` : ""}, theo các ngày làm việc của ca.`,
                  [
                    { text: "Hủy", style: "cancel" },
                    {
                      text: "Phân ca",
                      onPress: () =>
                        void run(
                          () =>
                            attendance.assign({
                              employeeIds: selected,
                              shiftId: target,
                              ...dates,
                              daysOfWeek: shift.workingDays,
                            }),
                          "Đã lưu phân ca.",
                        ),
                    },
                  ],
                );
              } catch (error) {
                setError(messageOf(error));
              }
            }}
          />
        </Card>
        <Button title="Tải lại" disabled={busy || loading} onPress={reload} />
      </Page>
      <Modal
        visible={editing !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!formLock.current) reload();
        }}
      >
        <SafeAreaView style={styles.page}>
          {editing && (
            <ShiftForm
              shift={editing === "new" ? undefined : editing}
              onClose={reload}
              setLocked={(value) => {
                formLock.current = value;
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}
