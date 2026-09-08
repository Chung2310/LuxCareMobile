import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import { Text } from "react-native";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, styles } from "../../ui";
import { payslipMoney } from "./model";
import { canCreatePayrollPayment, paymentDraftInput, validatePaymentDraft } from "./paymentFormModel";
import { validatePaymentMetadata } from "./paymentMetadataModel";
import { contractDate } from "../contracts/model";
export function CreatePayrollPayment({ run, onChanged }: { run: PayrollRun; onChanged: () => void }) {
  const { user, selectedBranch } = useSession();
  const allowed = canCreatePayrollPayment(user, selectedBranch?._id || user?.branchId, run);
  const active = useRef(false);
  const attempted = useRef(false);
  const [open, setOpen] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [date, setDate] = useState("");
  const [evidence, setEvidence] = useState("");
  const [payload, setPayload] = useState<ReturnType<typeof paymentDraftInput> | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
      };
    }, []),
  );
  const save = async () => {
    if (!allowed || !payload || attempted.current) return;
    attempted.current = true;
    setBusy(true);
    try {
      const saved = await payroll.createPayment(run._id, { ...payload, idempotencyKey: randomUUID() });
      validatePaymentDraft(saved, run._id, payload);
      validatePaymentMetadata(saved, payload);
      if (active.current) setDone(true);
    } catch (error) {
      if (active.current) setError(`${messageOf(error)} Tải lại thanh toán trước khi tạo tiếp.`);
    } finally {
      if (active.current) setBusy(false);
    }
  };
  if (!allowed) return null;
  return (
    <Card>
      <Text style={styles.heading}>Tạo thanh toán nháp · {run.periodKey}</Text>
      <Text style={styles.muted}>Chi nhánh: {selectedBranch?.name || "Chi nhánh của phiên đăng nhập"}</Text>
      {!open ? (
        <Button title="Thêm thanh toán nháp" onPress={() => setOpen(true)} />
      ) : done ? (
        <Text style={styles.text}>Đã tạo khoản nháp. Tải lại lịch sử để kiểm tra phân bổ.</Text>
      ) : (
        <>
          <Text style={styles.muted}>
            Khoản nháp chưa ghi nhận đã trả lương. Để trống nhân viên không phân bổ; nhập số tiền nguyên VND không có
            dấu phân cách. LuxCare kiểm tra số dư khi lưu.
          </Text>
          {!payload ? (
            <>
              {(run.effectiveLines || []).map((line) => (
                <Field
                  key={line.employeeId}
                  label={line.employeeName || line.employeeId}
                  value={amounts[line.employeeId] || ""}
                  keyboardType="numeric"
                  onChangeText={(value) => setAmounts((values) => ({ ...values, [line.employeeId]: value }))}
                />
              ))}
              <Field label="Ghi chú" value={note} onChangeText={setNote} multiline />
              <Field label="Ngày thanh toán (YYYY-MM-DD, giờ Việt Nam, tùy chọn)" value={date} onChangeText={setDate} />
              <Field
                label="Liên kết chứng từ HTTP/HTTPS (tùy chọn)"
                value={evidence}
                onChangeText={setEvidence}
                autoCapitalize="none"
                keyboardType="url"
              />
              <Button
                title="Xem lại phân bổ"
                onPress={() => {
                  try {
                    setPayload(paymentDraftInput(run, amounts, note, date, evidence));
                    setError(null);
                  } catch (error) {
                    setError(messageOf(error));
                  }
                }}
              />
              <Button title="Thu gọn" onPress={() => setOpen(false)} />
            </>
          ) : (
            <>
              {payload.lines.map((line) => (
                <Text key={line.employeeId} style={styles.text}>
                  {run.effectiveLines?.find((employee) => employee.employeeId === line.employeeId)?.employeeName ||
                    line.employeeId}
                  : {payslipMoney(line.amount)}
                </Text>
              ))}
              <Text style={styles.heading}>Tổng: {payslipMoney(payload.amount)}</Text>
              <Text style={styles.text}>Ghi chú: {payload.note || "—"}</Text>
              <Text style={styles.text}>
                Ngày thanh toán: {payload.paymentDate ? contractDate(payload.paymentDate) : "Chưa ghi nhận"}
              </Text>
              <Text selectable style={styles.text}>
                Chứng từ: {payload.evidenceUrl || "—"}
              </Text>
              <Button
                title={busy ? "Đang tạo…" : "Xác nhận tạo khoản nháp"}
                disabled={busy || attempted.current}
                onPress={() => void save()}
              />
              {!attempted.current && <Button title="Sửa phân bổ" onPress={() => setPayload(null)} />}
            </>
          )}
        </>
      )}
      <ErrorText message={error} />
      {(done || attempted.current) && <Button title="Tải lại kỳ và thanh toán" disabled={busy} onPress={onChanged} />}
    </Card>
  );
}
