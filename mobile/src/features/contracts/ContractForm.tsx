import { useRef, useState } from "react";
import { Text } from "react-native";
import type { Contract, Employee } from "../../../../src/types/hrContract";
import type { ContractScope } from "../../../../src/services/hrContractService";
import { contracts } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, ErrorText, Field, Page, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { contractDraft, contractPayload, contractChanges } from "./formModel";
import { contractStatuses } from "./model";
export function ContractForm({
  contract,
  employees,
  scope,
  onClose,
  setLocked,
}: {
  contract?: Contract;
  employees: Employee[];
  scope: ContractScope;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => contractDraft(contract));
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const choices = employees
    .filter(
      (employee) =>
        employee._id === draft.employeeId ||
        `${employee.displayName || ""} ${employee.email} ${employee.department || ""}`
          .toLocaleLowerCase("vi-VN")
          .includes(search.trim().toLocaleLowerCase("vi-VN")),
    )
    .map((employee) => ({
      value: employee._id,
      label: `${employee.displayName || employee.email} · ${employee.email}`,
    }));
  if (contract && !choices.some((item) => item.value === contract.employeeId))
    choices.unshift({ value: contract.employeeId, label: `${contract.employeeName} (nhân viên hiện tại)` });
  const save = async () => {
    if (lock.current || blocked) return;
    let value;
    try {
      value = contractPayload(draft, employees, contract);
    } catch (error) {
      setError(messageOf(error));
      return;
    }
    const patch = contract ? contractChanges(value, contract) : value;
    if (!Object.keys(patch).length) {
      onClose();
      return;
    }
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const saved = contract
        ? await contracts.update(scope, contract._id, patch)
        : await contracts.create(scope, value);
      if (!saved?._id) throw new Error("Chưa xác nhận hợp đồng đã được lưu.");
      onClose();
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
      if (!status || status >= 500 || status === 409) {
        setBlocked(true);
        setError(`${messageOf(error)} Đóng và tải lại danh sách để kiểm tra kết quả trước khi lưu tiếp.`);
      } else setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const disabled = busy || blocked;
  return (
    <Page title={contract ? "Sửa hợp đồng" : "Tạo hợp đồng"}>
      <Field
        label="Tìm nhân viên theo tên/email/phòng ban"
        value={search}
        editable={!disabled}
        onChangeText={setSearch}
      />
      <ChoiceField
        label="Nhân viên"
        value={draft.employeeId}
        choices={choices}
        disabled={disabled}
        onChange={(value) => setDraft((current) => ({ ...current, employeeId: value }))}
      />
      {!choices.length && <Text style={styles.muted}>Không có nhân viên phù hợp trong phạm vi hiện tại.</Text>}
      <Field
        label="Loại hợp đồng"
        value={draft.contractType}
        editable={!disabled}
        onChangeText={(value) => setDraft((current) => ({ ...current, contractType: value }))}
      />
      <Field
        label="Ngày bắt đầu (YYYY-MM-DD)"
        value={draft.startDate}
        editable={!disabled}
        onChangeText={(value) => setDraft((current) => ({ ...current, startDate: value }))}
      />
      <Field
        label="Ngày hết hạn (YYYY-MM-DD)"
        value={draft.endDate}
        editable={!disabled}
        onChangeText={(value) => setDraft((current) => ({ ...current, endDate: value }))}
      />
      <ChoiceField
        label="Trạng thái"
        value={draft.status}
        choices={Object.entries(contractStatuses).map(([value, label]) => ({
          value: value as Contract["status"],
          label,
        }))}
        disabled={disabled}
        onChange={(value) => setDraft((current) => ({ ...current, status: value }))}
      />
      <Field
        label="Ghi chú"
        value={draft.note}
        multiline
        editable={!disabled}
        onChangeText={(value) => setDraft((current) => ({ ...current, note: value }))}
      />
      <ErrorText message={error} />
      <Button title={busy ? "Đang lưu…" : "Lưu hợp đồng"} disabled={disabled} onPress={() => void save()} />
      <Button title="Đóng và tải lại" disabled={busy} onPress={onClose} />
    </Page>
  );
}
