import { useAppAlert } from "../../src/components/AppAlert";
import { useCallback, useRef, useState } from "react";
import { Modal, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import type {
  WorkCalendarDay,
  WorkCalendarDayType,
  WorkCalendarAudit,
} from "../../../src/services/companyWorkCalendarService";
import { workCalendar } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { Button, Card, EmptyState, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { calendarAccess, calendarInput, calendarToggle, DAY_TYPES } from "../../src/features/calendar/model";
import { HolidayForm } from "../../src/features/calendar/HolidayForm";
export default function WorkCalendar() {
  const { showAlert, alertView } = useAppAlert();
  const { user } = useSession();
  const access = calendarAccess(user);
  const [year, setYear] = useState(new Date().getFullYear());
  const [yearText, setYearText] = useState(String(year));
  const [days, setDays] = useState<WorkCalendarDay[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const [editing, setEditing] = useState<WorkCalendarDay | "new" | null>(null);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [dayType, setDayType] = useState<WorkCalendarDayType>("holiday");
  const [reason, setReason] = useState("");
  const [toggle, setToggle] = useState<WorkCalendarDay | null>(null);
  const [audit, setAudit] = useState<{ day: WorkCalendarDay; rows: WorkCalendarAudit[] } | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setDays([]);
      setError(null);
      if (!access.read) return;
      setLoading(true);
      void workCalendar
        .list(year)
        .then((value) => {
          if (active) {
            setDays(value);
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
    }, [access.read, year, user?.uid, user?.companyCode, revision]),
  );
  const close = () => {
    setEditing(null);
    setToggle(null);
    setAudit(null);
  };
  const run = async (action: () => Promise<unknown>, mutation = true) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      if (mutation) {
        close();
        setRevision((value) => value + 1);
      }
    } catch (error) {
      if (mutation && (!(error && typeof error === "object" && "status" in error) || Number(error.status) >= 500)) {
        setUncertain(true);
        setError("Chưa xác nhận kết quả. Đóng form và tải lại danh sách để kiểm tra trước khi thao tác tiếp.");
      } else setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const disabled = busy || loading || uncertain;
  if (!access.read)
    return (
      <Page title="Lịch doanh nghiệp">
        <Text style={styles.text}>Chỉ Admin/Superadmin thuộc doanh nghiệp được xem lịch này.</Text>
        {alertView}
      </Page>
    );
  const open = (day: WorkCalendarDay | "new") => {
    setError(null);
    setEditing(day);
    setDate(day === "new" ? `${year}-01-01` : day.date);
    setName(day === "new" ? "" : day.name);
    setDayType(day === "new" ? "holiday" : day.dayType);
  };
  return (
    <>
      <Page title="Lịch nghỉ & làm bù">
        <Text style={styles.muted}>
          Lịch áp dụng toàn doanh nghiệp và có thể cập nhật công nghỉ lễ. Ngày hệ thống chỉ bật/tắt áp dụng; ngày tự tạo
          có thể sửa/xóa.
        </Text>
        <Field label="Năm" value={yearText} onChangeText={setYearText} keyboardType="number-pad" />
        <Button
          title="Xem năm"
          disabled={busy}
          onPress={() => {
            const value = Number(yearText);
            if (!/^\d{4}$/.test(yearText) || value < 1900 || value > 2100) {
              setError("Nhập năm từ 1900 đến 2100.");
              return;
            }
            setYear(value);
            setRevision((v) => v + 1);
          }}
        />
        {access.write && (
          <>
            <Button title="Thêm ngày" disabled={disabled} onPress={() => open("new")} />
            <Button
              title="Đồng bộ ngày lễ hệ thống"
              disabled={disabled}
              onPress={() =>
                showAlert("Đồng bộ lịch?", `Đồng bộ lịch nghỉ lễ năm ${year} cho doanh nghiệp.`, [
                  { text: "Hủy", style: "cancel" },
                  { text: "Đồng bộ", onPress: () => void run(() => workCalendar.sync(year)) },
                ])
              }
            />
          </>
        )}
        {loading && <Loading />}
        <ErrorText message={error} />
        {days.map((day) => (
          <Card key={day._id}>
            <Text style={styles.heading}>
              {day.date} · {day.name}
            </Text>
            <Text style={styles.muted}>
              {DAY_TYPES.find((item) => item.value === day.dayType)?.label} ·{" "}
              {day.source === "system" ? "Hệ thống" : "Tự tạo"} · {day.isApplied ? "Đang áp dụng" : "Đã tắt"}
            </Text>
            {day.adminReason && <Text style={styles.text}>Lý do: {day.adminReason}</Text>}
            {access.write && (
              <>
                <Button
                  title={day.isApplied ? "Tắt áp dụng" : "Bật áp dụng"}
                  disabled={disabled}
                  onPress={() => {
                    setError(null);
                    setToggle(day);
                    setReason("");
                  }}
                />
                {day.source === "admin" && (
                  <>
                    <Button title="Sửa ngày" disabled={disabled} onPress={() => open(day)} />
                    <Button
                      title="Xóa ngày"
                      disabled={disabled}
                      onPress={() =>
                        showAlert("Xóa ngày?", `${day.date} · ${day.name}. Thay đổi có thể cập nhật công nghỉ lễ.`, [
                          { text: "Hủy", style: "cancel" },
                          {
                            text: "Xóa",
                            style: "destructive",
                            onPress: () => void run(() => workCalendar.remove(day._id)),
                          },
                        ])
                      }
                    />
                  </>
                )}
              </>
            )}
            <Button
              title="Lịch sử thay đổi"
              disabled={busy}
              onPress={() =>
                void run(async () => {
                  setAudit({ day, rows: await workCalendar.audit(day._id) });
                }, false)
              }
            />
          </Card>
        ))}
        {!loading && !days.length && !error && (
          <EmptyState message="Chưa có ngày đặc biệt trong năm" />
        )}
        <Button title="Tải lại" disabled={busy || loading} onPress={() => setRevision((value) => value + 1)} />
      </Page>
      <Modal
        visible={!!editing || !!toggle || !!audit}
        animationType="slide"
        onRequestClose={() => {
          if (!lock.current) close();
        }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }} edges={["top"]}>
          {editing ? (
            <HolidayForm
              holiday={editing === "new" ? undefined : editing}
              year={year}
              onClose={close}
              onSuccess={() => {
                close();
                setRevision((v) => v + 1);
              }}
              setLocked={(v) => {
                lock.current = v;
              }}
            />
          ) : (
            <Page title={audit ? "Lịch sử thay đổi" : "Áp dụng lịch"}>
            {toggle && (
              <>
                <Text style={styles.text}>
                  {toggle.date} · {toggle.name}
                </Text>
                {toggle.isApplied && (
                  <Field
                    label="Lý do tắt áp dụng"
                    value={reason}
                    editable={!disabled}
                    onChangeText={setReason}
                    maxLength={500}
                    multiline
                  />
                )}
                <Button
                  title={toggle.isApplied ? "Xác nhận tắt" : "Xác nhận bật"}
                  disabled={disabled}
                  onPress={() => {
                    try {
                      const input = calendarToggle(toggle, reason);
                      void run(() => workCalendar.update(toggle._id, input));
                    } catch (error) {
                      setError(messageOf(error));
                    }
                  }}
                />
              </>
            )}
            {audit && (
              <>
                <Text style={styles.heading}>{audit.day.name}</Text>
                {audit.rows.map((row) => (
                  <Card key={row._id}>
                    <Text style={styles.text}>
                      {row.action} · {new Date(row.createdAt).toLocaleString("vi-VN")}
                    </Text>
                    <Text style={styles.muted}>Người thực hiện: {row.actorId}</Text>
                    {row.reason && <Text style={styles.text}>{row.reason}</Text>}
                  </Card>
                ))}
                {!audit.rows.length && <Text style={styles.muted}>Chưa có lịch sử thay đổi.</Text>}
              </>
            )}
            <ErrorText message={error} />
            <Button title="Đóng" disabled={busy} onPress={close} />
          </Page>
          )}
        </SafeAreaView>
      </Modal>
      {alertView}
    </>
  );
}
