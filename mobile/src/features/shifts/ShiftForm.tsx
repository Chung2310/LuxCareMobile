import { useRef, useState } from "react";
import { Text, Switch, View } from "react-native";
import type { WorkShift } from "../../../../src/services/attendanceService";
import { attendance } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Page, styles } from "../../ui";
import { DAYS, shiftDraft, shiftPayload } from "./model";
export function ShiftForm({
  shift,
  onClose,
  setLocked,
}: {
  shift?: WorkShift;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => shiftDraft(shift));
  const [standard, setStandard] = useState(() =>
    shift?.standardMinutes === undefined ? "" : String(shift.standardMinutes),
  );
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const save = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const input = shiftPayload({ ...draft, standardMinutes: standard.trim() ? Number(standard) : undefined });
      try {
        if (shift) await attendance.updateShift(shift._id, input);
        else await attendance.createShift(input);
      } catch (error) {
        if (!(error && typeof error === "object" && "status" in error) || Number(error.status) >= 500) {
          setUncertain(true);
          throw new Error("Chưa xác nhận kết quả lưu. Đóng và tải lại danh sách trước khi thao tác tiếp.");
        }
        throw error;
      }
      onClose();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const disabled = busy || uncertain;
  return (
    <Page title={shift ? "Sửa ca làm" : "Tạo ca làm"}>
      {(["code", "name", "color", "startTime", "endTime"] as const).map((key, index) => (
        <Field
          key={key}
          label={["Mã ca", "Tên ca", "Màu (#RRGGBB)", "Bắt đầu (HH:mm)", "Kết thúc (HH:mm)"][index]}
          value={draft[key]}
          editable={!disabled}
          onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))}
        />
      ))}
      <Card>
        <Text style={styles.heading}>Công chuẩn</Text>
        <Field
          label="Số phút công chuẩn (1–1440)"
          value={standard}
          editable={!disabled}
          keyboardType="number-pad"
          onChangeText={setStandard}
        />
        <Text style={styles.muted}>
          Để trống để tính lại từ giờ ca, trừ thời gian nghỉ không lương. Ca đang sửa giữ số phút đã lưu cho đến khi bạn
          thay đổi.
        </Text>
        <Button title="Tính lại theo giờ ca và giờ nghỉ" disabled={disabled} onPress={() => setStandard("")} />
      </Card>
      <Card>
        <Text style={styles.heading}>Khung giờ chấm công</Text>
        <Text style={styles.muted}>
          Để trống từng mốc để bỏ cấu hình mốc đó. Có thể nhập khoảng qua nửa đêm. Các mốc được lưu vào ca; backend hiện
          chưa áp dụng chúng để chặn chấm công ngoài giờ.
        </Text>
        {(["checkInFrom", "checkInUntil", "checkOutFrom", "checkOutUntil"] as const).map((key, index) => (
          <Field
            key={key}
            label={["Vào từ (HH:mm)", "Vào đến (HH:mm)", "Ra từ (HH:mm)", "Ra đến (HH:mm)"][index]}
            value={draft[key] || ""}
            editable={!disabled}
            onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))}
          />
        ))}
      </Card>
      <Text style={styles.heading}>Ngày làm việc</Text>
      {DAYS.map((day) => (
        <Button
          key={day.value}
          title={`${draft.workingDays.includes(day.value) ? "✓ " : ""}${day.label}`}
          disabled={disabled}
          onPress={() =>
            setDraft((current) => ({
              ...current,
              workingDays: current.workingDays.includes(day.value)
                ? current.workingDays.filter((value) => value !== day.value)
                : [...current.workingDays, day.value],
            }))
          }
        />
      ))}
      {(["allowedLateMinutes", "allowedEarlyLeaveMinutes"] as const).map((key, index) => (
        <Field
          key={key}
          label={index ? "Cho phép về sớm (phút)" : "Cho phép đi muộn (phút)"}
          value={String(draft[key])}
          editable={!disabled}
          keyboardType="number-pad"
          onChangeText={(value) => setDraft((current) => ({ ...current, [key]: Number(value) }))}
        />
      ))}
      {(draft.breakPeriods || []).map((item, index) => (
        <Card key={index}>
          {(["name", "startTime", "endTime"] as const).map((key, i) => (
            <Field
              key={key}
              label={["Tên giờ nghỉ", "Bắt đầu nghỉ (HH:mm)", "Kết thúc nghỉ (HH:mm)"][i]}
              value={item[key]}
              editable={!disabled}
              onChangeText={(value) =>
                setDraft((current) => ({
                  ...current,
                  breakPeriods: current.breakPeriods?.map((entry, j) =>
                    j === index ? { ...entry, [key]: value } : entry,
                  ),
                }))
              }
            />
          ))}
          <View style={styles.row}>
            <Text style={styles.text}>Nghỉ có lương</Text>
            <Switch
              disabled={disabled}
              value={item.paid}
              onValueChange={(paid) =>
                setDraft((current) => ({
                  ...current,
                  breakPeriods: current.breakPeriods?.map((entry, j) => (j === index ? { ...entry, paid } : entry)),
                }))
              }
            />
          </View>
          <Button
            title="Bỏ khoảng nghỉ"
            disabled={disabled}
            onPress={() =>
              setDraft((current) => ({ ...current, breakPeriods: current.breakPeriods?.filter((_, j) => j !== index) }))
            }
          />
        </Card>
      ))}
      <Button
        title="Thêm khoảng nghỉ"
        disabled={disabled}
        onPress={() =>
          setDraft((current) => ({
            ...current,
            breakPeriods: [
              ...(current.breakPeriods || []),
              { name: "Nghỉ giữa ca", startTime: "12:00", endTime: "13:00", paid: false },
            ],
          }))
        }
      />
      {(["isDefault", "isActive"] as const).map((key, index) => (
        <View key={key} style={styles.row}>
          <Text style={styles.text}>{index ? "Hoạt động" : "Ca mặc định của doanh nghiệp"}</Text>
          <Switch
            disabled={disabled}
            value={draft[key]}
            onValueChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
          />
        </View>
      ))}
      <ErrorText message={error} />
      <Button title="Lưu ca" disabled={disabled} onPress={() => void save()} />
      <Button title="Đóng" disabled={busy} onPress={onClose} />
    </Page>
  );
}
