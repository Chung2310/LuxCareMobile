import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Text } from "react-native";
import type { PayrollRun } from "../../../../src/types/payrollRun";
import { payroll } from "../../api/services";
import { messageOf, useSession } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, styles } from "../../ui";
import { canPublishPayslips, publicationEmployees, validatePublicationResponse } from "./publicationModel";
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
      const value = await payroll.publishPayslips(run._id, ids);
      validatePublicationResponse(value, run._id, ids);
      if (active.current) setDone(true);
    } catch (error) {
      if (active.current) setError(`${messageOf(error)} Tải lại để kiểm tra trạng thái trước khi thao tác tiếp.`);
    } finally {
      if (active.current) setBusy(false);
    }
  };
  if (!allowed) return null;
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
                disabled={busy || !!error}
                onPress={() => void send()}
              />
              {!attempted.current && <Button title="Sửa danh sách" onPress={() => setConfirming(false)} />}
            </>
          )}
        </>
      )}
      <ErrorText message={error} />
      {(done || error) && <Button title="Tải lại trạng thái kỳ lương" disabled={busy} onPress={onChanged} />}
    </Card>
  );
}
