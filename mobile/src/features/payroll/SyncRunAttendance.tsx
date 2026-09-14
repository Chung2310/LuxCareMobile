import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import { Text } from "react-native";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { useAppAlert } from "../../components/AppAlert";
import { Button, Card, styles } from "../../ui";
import {
  canSyncRunAttendance,
  syncAttendanceSummary,
} from "./syncAttendanceModel";
import { CalculatePayrollRun } from "./CalculatePayrollRun";
import { calculationSummary } from "./calculationModel";
import { lockedAttendanceSummary } from "./lockAttendanceModel";

export function SyncRunAttendance({
  run,
  onChanged,
  onUpdated,
  onCalculate,
}: {
  run: PayrollRun;
  onChanged: () => void;
  onCalculate?: () => void;
  onUpdated?: (minimumVersion?: number) => Promise<void>;
}) {
  const { user, selectedBranch } = useSession();
  const allowed = canSyncRunAttendance(
    user,
    selectedBranch?._id || user?.branchId,
    run,
  );
  const active = useRef(false);
  const attempted = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReturnType<
    typeof syncAttendanceSummary
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const syncedVersion = useRef<number | null>(null);
  const lockAttempted = useRef(false);
  const [confirmLock, setConfirmLock] = useState(false);
  const [locked, setLocked] = useState<ReturnType<
    typeof lockedAttendanceSummary
  > | null>(null);
  const [calculated, setCalculated] = useState<ReturnType<
    typeof calculationSummary
  > | null>(null);
  const { showAlert, alertView } = useAppAlert();

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
    setError(null);
    try {
      const key = randomUUID();
      const saved = await payroll.syncRunAttendance(run._id, run.version!, key);
      const summary = syncAttendanceSummary(saved, run, key);
      syncedVersion.current = saved.runVersion;
      if (active.current) setResult(summary);
      await onUpdated?.(saved.runVersion);
      if (active.current) {
        showAlert(
          "Đồng bộ công thành công",
          `Đã đồng bộ ${summary.employeeCount} nhân viên · ${summary.blockingIssueCount} lỗi chặn xử lý.`,
          [{ text: "Đã hiểu" }],
          "success",
        );
      }
    } catch (err) {
      const msg = messageOf(err);
      if (active.current) {
        setError(msg);
        attempted.current = false;
        showAlert(
          "Đồng bộ công không thành công",
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
  if (!run.activeRevisionId)
    return (
      <CalculatePayrollRun
        run={run}
        onChanged={onChanged}
        onUpdated={onUpdated}
      />
    );

  const lockAttendance = async () => {
    if (
      !allowed ||
      !result ||
      result.blockingIssueCount !== 0 ||
      !confirmLock ||
      syncedVersion.current === null ||
      lockAttempted.current
    )
      return;
    lockAttempted.current = true;
    setBusy(true);
    setError(null);
    let completedVersion: number | undefined;
    let failure: string | null = null;
    let calculation: ReturnType<typeof calculationSummary> | null = null;
    let didLock = false;
    try {
      const expectedVersion = syncedVersion.current!;
      const saved = await payroll.lockRunAttendance(run._id, expectedVersion);
      const summary = lockedAttendanceSummary(saved, run, expectedVersion);
      didLock = true;
      completedVersion = saved.run.version;
      if (active.current) setLocked(summary);
      const calculatedRun = await payroll.calculateOperationalRun(
        run._id,
        saved.run.version,
        randomUUID(),
      );
      calculation = calculationSummary(calculatedRun, {
        ...run,
        version: saved.run.version,
      });
      completedVersion = calculatedRun.runVersion;
      if (active.current) setCalculated(calculation);
    } catch (err) {
      failure = messageOf(err);
    }
    // Refresh even when locking succeeded but calculation failed.
    if (completedVersion !== undefined) {
      try {
        await onUpdated?.(completedVersion);
      } catch (err) {
        failure = [failure, messageOf(err)].filter(Boolean).join("; ");
      }
    }
    if (active.current) {
      setBusy(false);
      if (failure) {
        setError(failure);
        if (!didLock) lockAttempted.current = false;
        showAlert(
          calculation
            ? "Chưa tải được bảng lương mới"
            : didLock
              ? "Đã khóa công, tính lương chưa hoàn tất"
              : "Khóa công không thành công",
          failure,
          [
            { text: "Tải lại kỳ", onPress: onChanged },
            { text: "Đã hiểu", style: "cancel" },
          ],
          "error",
        );
      } else if (calculation) {
        showAlert(
          "Khóa công & tính lương thành công",
          "Đã tính lương cho " +
            calculation.employeeCount +
            " nhân viên. Bạn có thể kiểm tra & duyệt lương.",
          [{ text: "Đã hiểu" }],
          "success",
        );
      }
    }
  };

  return (
    <Card>
      <Text style={styles.heading}>Đồng bộ công kỳ {run.periodKey}</Text>
      <Text style={styles.muted}>
        Chi nhánh: {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}
      </Text>
      {result ? (
        <Text style={styles.text}>
          Đã đồng bộ {result.employeeCount} nhân viên ·{" "}
          {result.blockingIssueCount} lỗi chặn xử lý. Trạng thái kỳ đã được cập
          nhật.
        </Text>
      ) : (
        <>
          <Text style={styles.text}>
            Lấy kết quả công đã tổng hợp của kỳ để cập nhật các vấn đề cần xử
            lý. Chuẩn bị kết quả công trên LuxCare web nếu kỳ chưa có dữ liệu.
          </Text>
          <Text style={styles.muted}>
            Bước này chưa khóa công hoặc tính lương. Kiểm tra lỗi sau khi đồng
            bộ trước khi tiếp tục.
          </Text>
          {!confirming ? (
            <Button
              title="Đồng bộ dữ liệu công"
              onPress={() => setConfirming(true)}
            />
          ) : (
            <>
              <Text style={styles.text}>
                Xác nhận đồng bộ công cho kỳ và chi nhánh ở trên.
              </Text>
              <Button
                title={busy ? "Đang đồng bộ…" : "Xác nhận đồng bộ công"}
                disabled={busy}
                onPress={() => void sync()}
              />
              {!attempted.current && (
                <Button title="Quay lại" onPress={() => setConfirming(false)} />
              )}
            </>
          )}
        </>
      )}
      {result && !locked && result.blockingIssueCount === 0 && (
        <>
          <Text style={styles.muted}>
            Khóa bản công vừa đồng bộ và tự động tính lương ngay sau đó. Kỳ
            lương vẫn là nháp để bạn kiểm tra & duyệt.
          </Text>
          {!confirmLock ? (
            <Button
              title="Khóa công & tính lương"
              disabled={busy}
              onPress={() => setConfirmLock(true)}
            />
          ) : (
            <>
              <Text style={styles.text}>
                Xác nhận khóa công của {result.employeeCount} nhân viên cho kỳ{" "}
                {run.periodKey} và tính lương ngay sau khi khóa công.
              </Text>
              <Button
                title={
                  busy
                    ? "Đang khóa công & tính lương…"
                    : "Xác nhận khóa công & tính lương"
                }
                disabled={busy}
                onPress={() => void lockAttendance()}
              />
              {!lockAttempted.current && (
                <Button
                  title="Quay lại"
                  onPress={() => setConfirmLock(false)}
                />
              )}
            </>
          )}
        </>
      )}
      {locked && (
        <>
          <Text style={styles.text}>
            {calculated
              ? "Đã khóa công và tính lương cho " +
                calculated.employeeCount +
                " nhân viên. Có thể kiểm tra & duyệt lương."
              : busy
                ? "Đã khóa công. Đang tính lương…"
                : "Đã khóa công. Tính lương chưa hoàn tất, hãy mở bước tính lương để tiếp tục."}
          </Text>
          <Text selectable style={styles.muted}>
            Mã bản công: {locked.snapshotId}
          </Text>
          {!busy && !calculated && onCalculate && (
            <Button title="Tiếp tục tính lương" onPress={onCalculate} />
          )}
        </>
      )}
      {(result || error) && (
        <Button
          title="Tải lại trạng thái kỳ lương"
          disabled={busy}
          onPress={onChanged}
        />
      )}
      {alertView}
    </Card>
  );
}
