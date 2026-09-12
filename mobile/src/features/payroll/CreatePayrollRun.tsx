import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { useAppAlert } from "../../components/AppAlert";
import { Button, Card, styles } from "../../ui";
import { validPayrollPeriod } from "./runModel";
import { canCreatePayrollRun, monthlyRunInput, validateCreatedRun } from "./createRunModel";

export function CreatePayrollRun({ period, onChanged }: { period: string; onChanged: () => void }) {
  const { user, selectedBranch } = useSession();
  const branchId = selectedBranch?._id || user?.branchId;
  const allowed = canCreatePayrollRun(user, branchId) && validPayrollPeriod(period);
  const active = useRef(false);
  const attempted = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { showAlert, alertView } = useAppAlert();

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
      };
    }, []),
  );

  const create = async () => {
    if (!allowed || !confirming || attempted.current) return;
    attempted.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = await payroll.createOperationalRun(monthlyRunInput(period));
      validateCreatedRun(saved, period);
      if (active.current) {
        setDone(true);
        showAlert(
          "Tạo kỳ lương thành công",
          `Đã tạo kỳ lương nháp cho kỳ ${period}. Tải lại để xem trạng thái kỳ lương.`,
          [{ text: "Đã hiểu", onPress: onChanged }],
          "success",
        );
      }
    } catch (err) {
      const msg = messageOf(err);
      if (active.current) {
        setError(msg);
        attempted.current = false;
        showAlert(
          "Tạo kỳ lương không thành công",
          msg,
          [
            { text: "Tải lại kỳ", onPress: onChanged },
            { text: "Đã hiểu", style: "cancel" },
          ],
          "error",
        );
      }
    } finally {
      if (active.current) setBusy(false);
    }
  };

  if (!allowed) return null;
  const input = monthlyRunInput(period);

  return (
    <Card>
      <Text style={styles.heading}>Tạo kỳ lương thường {period}</Text>
      {done ? (
        <Text style={styles.text}>Đã tạo kỳ nháp. Tải lại để xem trạng thái kỳ lương.</Text>
      ) : (
        <>
          <Text style={styles.text}>
            Từ {input.startDate} đến {input.endDate}
          </Text>
          <Text style={styles.text}>Chi nhánh: {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}</Text>
          <Text style={styles.muted}>
            Kỳ mới ở trạng thái nháp, chưa có dữ liệu công hoặc kết quả lương. Tải lại để tiếp tục đồng bộ, khóa công và
            tính lương.
          </Text>
          {!confirming ? (
            <Button title="Tạo kỳ nháp theo tháng" onPress={() => setConfirming(true)} />
          ) : (
            <>
              <Text style={styles.text}>Xác nhận tạo kỳ cho khoảng ngày và chi nhánh ở trên.</Text>
              <Button
                title={busy ? "Đang tạo kỳ…" : "Xác nhận tạo kỳ nháp"}
                disabled={busy}
                onPress={() => void create()}
              />
              {!attempted.current && <Button title="Quay lại" onPress={() => setConfirming(false)} />}
            </>
          )}
        </>
      )}
      {(done || error) && <Button title="Tải lại trạng thái kỳ lương" disabled={busy} onPress={onChanged} />}
      {alertView}
    </Card>
  );
}
