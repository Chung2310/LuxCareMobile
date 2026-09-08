import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import type { PayrollExportType } from "../../../../src/services/payrollService";
import { Button, Card, ErrorText, styles } from "../../ui";
import { messageOf, useSession } from "../../auth/SessionProvider";
import { canReadRunPayments } from "./paymentModel";
import { canExportPayroll, exportLabels } from "./exportModel";
import { shareWorkbook } from "./shareWorkbook";
export function PayrollExport({ run }: { run: PayrollRun }) {
  const { user, selectedBranch } = useSession();
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState<PayrollExportType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const permissions = user?.permissions?.join("|");
  useFocusEffect(
    useCallback(() => {
      setBusy(null);
      setError(null);
      return () => {
        pending.current?.abort();
        pending.current = null;
      };
    }, [run._id, run.status, user?.uid, user?.companyCode, user?.branchId, selectedBranch?._id, permissions]),
  );
  const share = async (type: PayrollExportType) => {
    if (pending.current || !canExportPayroll(user, run.status, type)) return;
    const request = new AbortController();
    pending.current = request;
    setBusy(type);
    setError(null);
    try {
      await shareWorkbook(run._id, type, run.periodKey, request.signal);
    } catch (error) {
      if (!request.signal.aborted) setError(messageOf(error));
    } finally {
      if (pending.current === request) {
        pending.current = null;
        setBusy(null);
      }
    }
  };
  if (!canReadRunPayments(user)) return null;
  return (
    <Card>
      <Text style={styles.heading}>Xuất báo cáo Excel</Text>
      {!canExportPayroll(user, run.status, "detailed") ? (
        <Text style={styles.muted}>Có thể xuất khi kỳ lương đã chốt hoặc đã thanh toán.</Text>
      ) : (
        <>
          {(Object.keys(exportLabels) as PayrollExportType[])
            .filter((type) => canExportPayroll(user, run.status, type))
            .map((type) => (
              <Button
                key={type}
                title={busy === type ? "Đang tải báo cáo…" : exportLabels[type]}
                disabled={!!busy}
                onPress={() => void share(type)}
              />
            ))}
          <Text style={styles.muted}>
            Lưu hoặc chia sẻ tệp theo mẫu LuxCare. Xuất mẫu chuyển khoản không thực hiện chuyển tiền.
          </Text>
        </>
      )}
      <ErrorText message={error} />
    </Card>
  );
}
