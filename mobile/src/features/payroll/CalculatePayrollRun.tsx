import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import { Text } from "react-native";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { useAppAlert } from "../../components/AppAlert";
import { Button, Card, ErrorText, Loading, styles } from "../../ui";
import { canSyncRunAttendance } from "./syncAttendanceModel";
import {
  canReadFormulas,
  parsePolicies,
  policyForDate,
  percentLabel,
  fundLabels,
  type PayrollPolicyVersion,
} from "./formulaModel";
import { calculationSummary } from "./calculationModel";

export function CalculatePayrollRun({
  run,
  onChanged,
  onUpdated,
  onManageFormulas,
}: {
  run: PayrollRun;
  onChanged: () => void;
  onUpdated?: (minimumVersion?: number) => Promise<void>;
  onManageFormulas?: () => void;
}) {
  const { user, selectedBranch } = useSession();
  const allowed = canSyncRunAttendance(
    user,
    selectedBranch?._id || user?.branchId,
    run,
  );
  const [formulas, setFormulas] = useState<PayrollPolicyVersion[]>([]);
  const [formulaLoading, setFormulaLoading] = useState(true);
  const [formulaError, setFormulaError] = useState<string | null>(null);
  const [formulaReload, setFormulaReload] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      setFormulas([]);
      setFormulaError(null);
      setFormulaLoading(true);
      if (!allowed || !canReadFormulas(user)) {
        setFormulaLoading(false);
        return;
      }
      void payroll
        .getPolicies()
        .then((value) => {
          const items = parsePolicies(value, user!.companyCode!);
          if (mounted) setFormulas(items);
        })
        .catch((err) => {
          if (mounted) setFormulaError(messageOf(err));
        })
        .finally(() => {
          if (mounted) setFormulaLoading(false);
        });
      return () => {
        mounted = false;
      };
    }, [
      allowed,
      run._id,
      selectedBranch?._id,
      user?.uid,
      user?.companyCode,
      user?.branchId,
      formulaReload,
    ]),
  );
  const active = useRef(false);
  const attempted = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReturnType<
    typeof calculationSummary
  > | null>(null);
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

  const calculate = async () => {
    if (!allowed || !confirming || attempted.current || formulaLoading) return;
    attempted.current = true;
    setBusy(true);
    setError(null);
    try {
      const saved = await payroll.calculateOperationalRun(
        run._id,
        run.version!,
        randomUUID(),
      );
      const summary = calculationSummary(saved, run);
      if (active.current) setResult(summary);
      await onUpdated?.(saved.runVersion);
      if (active.current) {
        showAlert(
          "Tính lương thành công",
          `Đã hoàn tất bản tính cho ${summary.employeeCount} dòng lương. Bảng lương đã được cập nhật.`,
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
          "Tính lương không thành công",
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

  const [year, month] = run.periodKey.split("-").map(Number);
  const periodEnd = new Date(Date.UTC(year, month, 0))
    .toISOString()
    .slice(0, 10);
  const policy = policyForDate(formulas, periodEnd);
  if (!allowed) return null;

  return (
    <Card>
      <Text style={styles.heading}>Tính lương kỳ {run.periodKey}</Text>
      <Text style={styles.muted}>
        Chi nhánh: {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}
      </Text>
      {result ? (
        <>
          <Text style={styles.text}>
            Đã hoàn tất bản tính cho {result.employeeCount} dòng lương. Kiểm tra
            số liệu và cảnh báo trước khi duyệt.
          </Text>
          <Text selectable style={styles.muted}>
            Mã bản tính: {result.revisionId}
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.text}>
            Cần có bản công đã khóa trước khi tính lương.
          </Text>
          <Text style={styles.muted}>
            Tính lại sẽ tạo bản tính mới từ bản công đã khóa và dữ liệu lương
            hiện hành. Kỳ vẫn là nháp, chưa chốt hoặc thanh toán.
          </Text>
          <Text style={styles.heading}>Phiên bản công thức của kỳ</Text>
          {formulaLoading && <Loading />}
          <ErrorText message={formulaError} />
          {!!formulaError && (
            <Button
              title="Tải lại công thức"
              disabled={busy || confirming}
              onPress={() => setFormulaReload((value) => value + 1)}
            />
          )}
          {policy && (
            <>
              <Text style={styles.heading}>
                {policy.name} ({policy.code})
              </Text>
              {policy.funds
                .filter((fund) =>
                  ["social", "health", "unemployment"].includes(fund.code),
                )
                .map((fund) => (
                  <Text key={fund.code} style={styles.text}>
                    {fundLabels[fund.code]}: NLĐ{" "}
                    {percentLabel(fund.employeeRate)} · DN{" "}
                    {percentLabel(fund.employerRate)}
                  </Text>
                ))}
              <Text style={styles.text}>
                Thuế TNCN:{" "}
                {policy.taxBrackets
                  .map((bracket) => percentLabel(bracket.rate))
                  .join(" · ")}
              </Text>
            </>
          )}
          {!formulaLoading && !formulaError && !policy && (
            <Text style={styles.muted}>
              {canReadFormulas(user)
                ? "Chưa có phiên bản đang áp dụng có hiệu lực vào cuối kỳ."
                : "Công thức được áp dụng theo cấu hình của công ty."}
            </Text>
          )}
          {canReadFormulas(user) && onManageFormulas && (
            <Button
              title="Chọn / quản lý phiên bản công thức"
              disabled={busy || confirming}
              onPress={onManageFormulas}
            />
          )}
          <Text style={styles.muted}>
            Phiên bản được chọn theo thời gian hiệu lực ở cuối kỳ. Mở Phiên bản
            công thức để cấu hình tỷ lệ thuế, bảo hiểm và áp dụng phiên bản phù
            hợp.
          </Text>
          {!confirming ? (
            <Button
              title="Tính / tính lại lương"
              disabled={formulaLoading}
              onPress={() => setConfirming(true)}
            />
          ) : (
            <>
              <Text style={styles.text}>
                Xác nhận tính lương cho kỳ và chi nhánh ở trên. Các công thức
                được áp dụng theo cấu hình hiện hành của công ty.
              </Text>
              <Button
                title={busy ? "Đang tính lương…" : "Xác nhận tính lương"}
                disabled={busy}
                onPress={() => void calculate()}
              />
              {!attempted.current && (
                <Button title="Quay lại" onPress={() => setConfirming(false)} />
              )}
            </>
          )}
        </>
      )}
      {(result || error) && (
        <Button
          title="Tải lại bảng lương và cảnh báo"
          disabled={busy}
          onPress={onChanged}
        />
      )}
      {alertView}
    </Card>
  );
}
