import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import { Text } from "react-native";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, styles } from "../../ui";
import { canSyncRunAttendance, syncAttendanceSummary } from "./syncAttendanceModel";
import { lockedAttendanceSummary } from "./lockAttendanceModel";
export function SyncRunAttendance({ run, onChanged }: { run: PayrollRun; onChanged: () => void }) {
  const { user, selectedBranch } = useSession();
  const allowed = canSyncRunAttendance(user, selectedBranch?._id || user?.branchId, run);
  const active = useRef(false);
  const attempted = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof syncAttendanceSummary> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lockAttempted = useRef(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [locked, setLocked] = useState<ReturnType<typeof lockedAttendanceSummary> | null>(null);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
      };
    }, []),
  );
  const sync = async () => {
    if (!allowed || !confirming || attempted.current) return;
    attempted.current = true;
    setBusy(true);
    try {
      const key = randomUUID();
      const saved = await payroll.syncRunAttendance(run._id, run.version!, key);
      const summary = syncAttendanceSummary(saved, run, key);
      if (active.current) setResult(summary);
    } catch (error) {
      if (active.current) setError(`${messageOf(error)} Tải lại để kiểm tra trạng thái trước khi đồng bộ tiếp.`);
    } finally {
      if (active.current) setBusy(false);
    }
  };
  if (!allowed) return null;
  const lockAttendance = async () => {
    if (!allowed || !result || result.blockingIssueCount !== 0 || !confirmLock || lockAttempted.current) return;
    lockAttempted.current = true;
    setBusy(true);
    try {
      const expectedVersion = run.version! + 1;
      const saved = await payroll.lockRunAttendance(run._id, expectedVersion);
      const summary = lockedAttendanceSummary(saved, run, expectedVersion);
      if (active.current) setLocked(summary);
    } catch (error) {
      if (active.current) setError(`${messageOf(error)} Tải lại kỳ để kiểm tra trạng thái trước khi thao tác tiếp.`);
    } finally {
      if (active.current) setBusy(false);
    }
  };
  return (
    <Card>
      <Text style={styles.heading}>Đồng bộ công kỳ {run.periodKey}</Text>
      <Text style={styles.muted}>Chi nhánh: {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}</Text>
      {result ? (
        <Text style={styles.text}>
          Đã đồng bộ {result.employeeCount} nhân viên · {result.blockingIssueCount} lỗi chặn xử lý. Tải lại kỳ để xem
          danh sách lỗi mới.
        </Text>
      ) : (
        <>
          <Text style={styles.text}>
            Lấy kết quả công đã tổng hợp của kỳ để cập nhật các vấn đề cần xử lý. Chuẩn bị kết quả công trên LuxCare web
            nếu kỳ chưa có dữ liệu.
          </Text>
          <Text style={styles.muted}>
            Bước này chưa khóa công hoặc tính lương. Kiểm tra lỗi sau khi đồng bộ trước khi tiếp tục.
          </Text>
          {!confirming ? (
            <Button title="Đồng bộ dữ liệu công" onPress={() => setConfirming(true)} />
          ) : (
            <>
              <Text style={styles.text}>Xác nhận đồng bộ công cho kỳ và chi nhánh ở trên.</Text>
              <Button
                title={busy ? "Đang đồng bộ…" : "Xác nhận đồng bộ công"}
                disabled={busy || !!error}
                onPress={() => void sync()}
              />
              {!attempted.current && <Button title="Quay lại" onPress={() => setConfirming(false)} />}
            </>
          )}
        </>
      )}
      {result && !locked && result.blockingIssueCount === 0 && !error && (
        <>
          <Text style={styles.muted}>
            Khóa công sẽ lưu bản công vừa đồng bộ để dùng tính lương. Kỳ lương vẫn là nháp.
          </Text>
          {!confirmLock ? (
            <Button title="Khóa bản công vừa đồng bộ" onPress={() => setConfirmLock(true)} />
          ) : (
            <>
              <Text style={styles.text}>
                Xác nhận khóa công của {result.employeeCount} nhân viên cho kỳ {run.periodKey}.
              </Text>
              <Button
                title={busy ? "Đang khóa công…" : "Xác nhận khóa công"}
                disabled={busy}
                onPress={() => void lockAttendance()}
              />
              {!lockAttempted.current && <Button title="Quay lại" onPress={() => setConfirmLock(false)} />}
            </>
          )}
        </>
      )}
      {locked && (
        <>
          <Text style={styles.text}>
            Đã khóa bản công của {locked.employeeCount} nhân viên. Tiếp tục tính lương trên LuxCare web.
          </Text>
          <Text selectable style={styles.muted}>
            Mã bản công: {locked.snapshotId}
          </Text>
        </>
      )}
      <ErrorText message={error} />
      {(result || error) && <Button title="Tải lại trạng thái kỳ lương" disabled={busy} onPress={onChanged} />}
    </Card>
  );
}
