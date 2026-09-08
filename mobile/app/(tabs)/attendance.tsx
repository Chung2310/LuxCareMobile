import { useCallback, useRef, useState } from "react";
import { Modal, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckInForm } from "../../src/features/attendance/CheckInForm";
import { useFocusEffect } from "expo-router";
import { attendance, workCalendar } from "../../src/api/services";
import type { AttendanceLog, TodayAttendance, WorkShift } from "../../../src/services/attendanceService";
import type { WorkCalendarDay } from "../../../src/services/companyWorkCalendarService";
import { currentKpiPeriod, validateKpiPeriod } from "../../../src/services/monthlyKpiService";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { canUseModule, hasPermission } from "../../src/auth/access";
import { calendarAccess } from "../../src/features/calendar/model";
import { Button, Card, ErrorText, Field, Loading, Page, styles } from "../../src/ui";
export default function Attendance() {
  const [action, setAction] = useState<"check-in" | "check-out" | null>(null);
  const actionLock = useRef(false);
  const { user, selectedBranch } = useSession();
  const allowed = canUseModule(user, "hr");
  const manage = hasPermission(user, "timekeeping:manage");
  const [period, setPeriod] = useState(() => currentKpiPeriod());
  const [draft, setDraft] = useState(period);
  const [revision, setRevision] = useState(0);
  const [today, setToday] = useState<TodayAttendance | null>(null);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [days, setDays] = useState<WorkCalendarDay[]>([]);
  const [shifts, setShifts] = useState<WorkShift[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [inputError, setInputError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setToday(null);
      setLogs([]);
      setDays([]);
      setShifts([]);
      setErrors([]);
      if (!allowed || !user) return;
      setLoading(true);
      const [year, month] = period.split("-").map(Number);
      const endDate = `${period}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;
      const jobs = [
        attendance.today().then((value) => {
          if (active) setToday(value);
        }),
        attendance.history(user.uid, user.companyCode || "", `${period}-01`, endDate).then((value) => {
          if (active) setLogs(value);
        }),
        (calendarAccess(user).read ? workCalendar.list(year, true) : Promise.resolve([])).then((value) => {
          if (active) setDays(value.filter((day) => day.date.startsWith(period)));
        }),
        ...(manage
          ? [
              attendance.shifts().then((value) => {
                if (active) setShifts(value);
              }),
            ]
          : []),
      ];
      void Promise.allSettled(jobs).then((results) => {
        if (active) {
          setErrors(
            results.flatMap((result, index) =>
              result.status === "rejected"
                ? [`${["Hôm nay", "Lịch sử", "Lịch làm việc", "Ca làm"][index]}: ${messageOf(result.reason)}`]
                : [],
            ),
          );
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }, [allowed, user?.uid, user?.companyCode, selectedBranch?._id, period, revision, manage]),
  );
  if (!allowed)
    return (
      <Page title="Lịch & chấm công">
        <Text style={styles.text}>Phân hệ nhân sự chưa được kích hoạt.</Text>
      </Page>
    );
  const time = (value?: string | Date) =>
    value ? new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "Chưa ghi nhận";
  const labels: Record<string, string> = {
    Present: "Có mặt",
    Late: "Đi muộn",
    "Left-Early": "Về sớm",
    "Half-Day": "Nửa ngày",
    "Late-Left-Early": "Muộn và về sớm",
    Absent: "Vắng",
    "Approved-Leave": "Nghỉ được duyệt",
    "Paid-Holiday": "Nghỉ lễ hưởng lương",
  };
  return (
    <>
      <Page title="Lịch & chấm công">
        <Text style={styles.muted}>
          Giờ hiển thị theo Việt Nam. Chấm công sử dụng vị trí hiện tại và quy tắc xác nhận của doanh nghiệp.
        </Text>
        <Button
          title="Chấm công vào"
          disabled={loading || !today || !!today.log?.checkIn}
          onPress={() => setAction("check-in")}
        />
        <Button
          title="Chấm công ra"
          disabled={loading || !today?.log?.checkIn || !!today.log?.checkOut}
          onPress={() => setAction("check-out")}
        />
        {today && (
          <Card>
            <Text style={styles.heading}>Hôm nay · {today.workCalendar.date}</Text>
            <Text style={styles.text}>
              {today.workCalendar.label || (today.workCalendar.isWorkingDay ? "Ngày làm việc" : "Ngày nghỉ")}
            </Text>
            {today.log ? (
              <>
                <Text style={styles.muted}>Ngày công: {today.log.date}</Text>
                <Text style={styles.text}>Vào: {time(today.log.checkIn?.time)}</Text>
                <Text style={styles.text}>Ra: {time(today.log.checkOut?.time)}</Text>
              </>
            ) : (
              <Text style={styles.muted}>Chưa có lượt chấm công.</Text>
            )}
          </Card>
        )}
        <Field label="Tháng lịch sử (YYYY-MM)" value={draft} onChangeText={setDraft} />
        <ErrorText message={inputError} />
        <Button
          title="Xem tháng"
          onPress={() => {
            try {
              setPeriod(validateKpiPeriod(draft.trim()));
              setInputError(null);
            } catch (error) {
              setInputError(messageOf(error));
            }
          }}
        />
        {loading && <Loading />}
        {errors.map((error) => (
          <ErrorText key={error} message={error} />
        ))}
        <Card>
          <Text style={styles.heading}>Lịch sử cá nhân · {period}</Text>
          {logs.map((log) => (
            <Card key={log._id}>
              <Text style={styles.text}>
                {log.date} · {labels[log.status || ""] || log.status}
              </Text>
              <Text style={styles.muted}>
                Vào: {time(log.checkIn?.time)}
                {"\n"}Ra: {time(log.checkOut?.time)}
              </Text>
              {!!log.note && <Text style={styles.text}>{log.note}</Text>}
            </Card>
          ))}
          {!loading && !logs.length && !errors.some((error) => error.startsWith("Lịch sử:")) && (
            <Text style={styles.muted}>Không có bản ghi trong tháng.</Text>
          )}
        </Card>
        <Card>
          <Text style={styles.heading}>Lịch nghỉ / làm bù đã áp dụng</Text>
          {!calendarAccess(user).read && (
            <Text style={styles.muted}>
              Danh sách lịch doanh nghiệp chỉ dành cho Admin/Superadmin. Trạng thái ngày hôm nay hiển thị ở trên.
            </Text>
          )}
          {days.map((day) => (
            <Text key={day._id} style={styles.text}>
              {day.date} · {day.name} ·{" "}
              {day.dayType === "working_override"
                ? "Làm bù"
                : day.dayType === "substitute_holiday"
                  ? "Nghỉ bù"
                  : "Nghỉ lễ"}
            </Text>
          ))}
          {calendarAccess(user).read &&
            !loading &&
            !days.length &&
            !errors.some((error) => error.startsWith("Lịch làm việc:")) && (
              <Text style={styles.muted}>Không có ngày đặc biệt trong tháng.</Text>
            )}
        </Card>
        {manage && (
          <Card>
            <Text style={styles.heading}>Danh mục ca làm</Text>
            {shifts.map((shift) => (
              <Card key={shift._id}>
                <Text style={styles.text}>
                  {shift.code} · {shift.name}
                </Text>
                <Text style={styles.muted}>
                  {shift.startTime}–{shift.endTime}
                  {shift.crossesMidnight ? " (qua đêm)" : ""} · {shift.isActive ? "Hoạt động" : "Ngừng hoạt động"}
                </Text>
                <Text style={styles.muted}>
                  {shift.workingDays.map((day) => (day === 0 ? "CN" : `T${day + 1}`)).join(", ")}
                  {shift.isDefault ? " · Ca mặc định" : ""}
                </Text>
              </Card>
            ))}
          </Card>
        )}
        <Button title="Tải lại" disabled={loading} onPress={() => setRevision((value) => value + 1)} />
      </Page>
      <Modal
        visible={action !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!actionLock.current) {
            setAction(null);
            setRevision((value) => value + 1);
          }
        }}
      >
        <SafeAreaView style={styles.page}>
          {action && (
            <CheckInForm
              action={action}
              onClose={() => {
                setAction(null);
                setRevision((value) => value + 1);
              }}
              setLocked={(value) => {
                actionLock.current = value;
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}
