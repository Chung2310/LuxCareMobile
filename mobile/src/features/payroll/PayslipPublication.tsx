import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { messageOf, useSession } from "../../auth/SessionProvider";
import { useAppAlert } from "../../components/AppAlert";
import { Button, Card, Field, styles } from "../../ui";
import {
  canPublishPayslips,
  canWithdrawPayslip,
  publicationEmployees,
  validatePublicationResponse,
  validateWithdrawalResponse,
} from "./publicationModel";

export function PayslipPublication({ run, onChanged }: { run: PayrollRun; onChanged: () => void }) {
  const { user, selectedBranch } = useSession();
  const allowed = canPublishPayslips(user, run);
  const active = useRef(false);
  const attempted = useRef(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [withdrawing, setWithdrawing] = useState<string | null>(null);
  const { showAlert, alertView } = useAppAlert();

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
      };
    }, []),
  );

  const lines = run.effectiveLines || [];
  const published = new Set(run.publishedEmployeeIds || []);
  const rows = lines.filter((line) =>
    confirming
      ? selected.includes(line.employeeId)
      : `${line.employeeName || ""} ${line.employeeId}`
          .toLocaleLowerCase("vi-VN")
          .includes(search.trim().toLocaleLowerCase("vi-VN")),
  );

  const send = async () => {
    if (!allowed || attempted.current || !confirming) return;
    try {
      const ids = publicationEmployees(run, selected);
      attempted.current = true;
      setBusy(true);
      setError(null);
      const value = await payroll.publishPayslips(run._id, ids);
      validatePublicationResponse(value, run._id, ids);
      if (active.current) {
        setDone(true);
        showAlert(
          "Phát hành thành công",
          `Đã phát hành phiếu lương cho ${ids.length} nhân viên.`,
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
          "Phát hành không thành công",
          msg,
          [
            { text: "Tải lại", onPress: onChanged },
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
  if (withdrawing) {
    const employee = lines.find((line) => line.employeeId === withdrawing);
    const withdraw = async () => {
      if (attempted.current || !canWithdrawPayslip(user, run, withdrawing)) return;
      attempted.current = true;
      setBusy(true);
      setError(null);
      try {
        const saved = await payroll.withdrawPayslip(run._id, withdrawing);
        validateWithdrawalResponse(saved, run._id, withdrawing);
        if (active.current) {
          setDone(true);
          showAlert(
            "Thu hồi thành công",
            "Đã thu hồi phiếu lương. Tải lại để cập nhật trạng thái.",
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
            "Thu hồi không thành công",
            msg,
            [
              { text: "Tải lại", onPress: onChanged },
              { text: "Đã hiểu", style: "cancel" },
            ],
            "error",
          );
        }
      } finally {
        if (active.current) setBusy(false);
      }
    };
    return (
      <Card>
        <Text style={styles.heading}>Thu hồi phiếu lương · {run.periodKey}</Text>
        <Text style={styles.text}>{employee?.employeeName || withdrawing}</Text>
        <Text style={styles.muted}>Chi nhánh: {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}</Text>
        {done ? (
          <Text style={styles.text}>Đã thu hồi phiếu lương. Tải lại để cập nhật trạng thái.</Text>
        ) : (
          <>
            <Text style={styles.text}>
              Sau khi thu hồi, phiếu này sẽ không còn trong danh sách phiếu được phát hành cho nhân viên. Có thể phát
              hành lại khi cần.
            </Text>
            <Text style={styles.muted}>
              Bản đã tải hoặc chia sẻ trước đó vẫn có thể tồn tại trên thiết bị hay ứng dụng nhận.
            </Text>
            <Button
              title={busy ? "Đang thu hồi…" : "Xác nhận thu hồi phiếu lương"}
              disabled={busy || !canWithdrawPayslip(user, run, withdrawing)}
              onPress={() => void withdraw()}
            />
            {!attempted.current && <Button title="Quay lại" onPress={() => setWithdrawing(null)} />}
          </>
        )}
        {(done || error) && <Button title="Tải lại trạng thái kỳ lương" disabled={busy} onPress={onChanged} />}
        {alertView}
      </Card>
    );
  }
  return (
    <Card>
      <Text style={styles.heading}>Phát hành phiếu lương · {run.periodKey}</Text>
      <Text style={styles.muted}>Chi nhánh: {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}</Text>
      {done ? (
        <Text style={styles.text}>
          Đã phát hành phiếu cho {selected.length} nhân viên. Tải lại để cập nhật danh sách.
        </Text>
      ) : (
        <>
          <Text style={styles.text}>
            Nhân viên được chọn sẽ xem được phiếu lương của mình trong ứng dụng. Phát hành lại cập nhật phiếu theo bản
            lương hiện hành.
          </Text>
          {!confirming && (
            <>
              <Field label="Tìm nhân viên để phát hành" value={search} onChangeText={setSearch} />
              <Button
                title="Chọn tất cả nhân viên trong kỳ"
                onPress={() => setSelected([...new Set(lines.map((line) => line.employeeId))])}
              />
              <Button title="Bỏ chọn tất cả" onPress={() => setSelected([])} />
            </>
          )}
          <Text style={styles.text}>
            {selected.length}/{lines.length} nhân viên được chọn
          </Text>
          {rows.map((line) => (
            <Card key={line.employeeId}>
              <Text style={styles.text}>{line.employeeName || line.employeeId}</Text>
              <Text style={styles.muted}>
                {!Array.isArray(run.publishedEmployeeIds)
                  ? "Chưa có thông tin phát hành"
                  : published.has(line.employeeId)
                    ? "Đã phát hành"
                    : "Chưa phát hành"}
              </Text>
              {!confirming && (
                <Button
                  title={selected.includes(line.employeeId) ? "Bỏ chọn" : "Chọn"}
                  onPress={() =>
                    setSelected((ids) =>
                      ids.includes(line.employeeId)
                        ? ids.filter((id) => id !== line.employeeId)
                        : [...ids, line.employeeId],
                    )
                  }
                />
              )}
              {!confirming && canWithdrawPayslip(user, run, line.employeeId) && (
                <Button title="Thu hồi phiếu đã phát hành" onPress={() => setWithdrawing(line.employeeId)} />
              )}
            </Card>
          ))}
          {!rows.length && <Text style={styles.muted}>Không có nhân viên phù hợp.</Text>}
          {!confirming ? (
            <Button
              title="Xem lại danh sách phát hành"
              disabled={!selected.length}
              onPress={() => setConfirming(true)}
            />
          ) : (
            <>
              <Button
                title={busy ? "Đang phát hành…" : "Xác nhận phát hành phiếu lương"}
                disabled={busy}
                onPress={() => void send()}
              />
              {!attempted.current && <Button title="Sửa danh sách" onPress={() => setConfirming(false)} />}
            </>
          )}
        </>
      )}
      {(done || error) && <Button title="Tải lại trạng thái kỳ lương" disabled={busy} onPress={onChanged} />}
      {alertView}
    </Card>
  );
}
