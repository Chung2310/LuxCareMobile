import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { Payslip } from "../../../../src/types/payslip";
import { Button, ErrorText, styles } from "../../ui";
import { messageOf } from "../../auth/SessionProvider";
import { sharePayslip } from "./sharePayslip";
export function SharePayslipButton({ item }: { item: Payslip }) {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      setBusy(false);
      setError(null);
      return () => {
        pending.current?.abort();
        pending.current = null;
      };
    }, []),
  );
  const share = async () => {
    if (pending.current) return;
    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    setError(null);
    try {
      await sharePayslip(item.runId, item.employeeId, item.periodKey || "", request.signal);
    } catch (error) {
      if (!request.signal.aborted) setError(messageOf(error));
    } finally {
      if (pending.current === request) {
        pending.current = null;
        setBusy(false);
      }
    }
  };
  return (
    <>
      <Button
        title={busy ? "Đang tải phiếu lương…" : "Lưu / chia sẻ phiếu lương HTML"}
        disabled={busy}
        onPress={() => void share()}
      />
      <Text style={styles.muted}>
        Chọn ứng dụng nhận hoặc nơi lưu trong bảng chia sẻ của thiết bị. Tệp dùng mẫu phiếu do LuxCare phát hành.
      </Text>
      <ErrorText message={error} />
    </>
  );
}
