import { useRef, useState } from "react";
import { Text } from "react-native";
import type { Credential } from "../../../../src/types/hrCredential";
import type { CredentialList } from "../../../../src/services/hrCredentialService";
import { credentials } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, ErrorText, Field, Page, styles } from "../../ui";
import { ChoiceField } from "../leave/ChoiceField";
import { credentialTypes } from "./model";
import { credentialDraft, credentialPayload, credentialChanges } from "./formModel";
export function CredentialForm({
  item,
  employees,
  companyCode,
  onClose,
  setLocked,
}: {
  item?: Credential;
  employees: CredentialList["employees"];
  companyCode: string;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [draft, setDraft] = useState(() => credentialDraft(item));
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false),
    [blocked, setBlocked] = useState(false),
    [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const choices = employees
    .filter(
      (employee) =>
        employee._id === draft.employeeId ||
        `${employee.displayName || ""} ${employee.email}`.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .map((employee) => ({
      value: employee._id,
      label: `${employee.displayName || employee.email} · ${employee.email}`,
    }));
  if (item && !choices.some((choice) => choice.value === item.employeeId))
    choices.unshift({ value: item.employeeId, label: item.employeeName });
  const save = async () => {
    if (lock.current || blocked) return;
    let payload;
    try {
      payload = credentialPayload(draft, employees, item);
    } catch (error) {
      setError(messageOf(error));
      return;
    }
    const patch = item ? credentialChanges(payload, item) : payload;
    if (!Object.keys(patch).length) {
      onClose();
      return;
    }
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const saved = item
        ? await credentials.update(companyCode, item._id, patch)
        : await credentials.create(companyCode, payload);
      if (!saved?._id) throw new Error("Chưa xác nhận được kết quả lưu.");
      onClose();
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
      if (!status || status >= 500 || status === 409) {
        setBlocked(true);
        setError(`${messageOf(error)} Đóng và tải lại danh sách trước khi gửi tiếp.`);
      } else setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const disabled = busy || blocked;
  const fields = [
    { key: "name", label: "Tên văn bằng/chứng chỉ" },
    { key: "credentialNumber", label: "Số hiệu" },
    { key: "issuingOrganization", label: "Nơi cấp" },
    { key: "issueDate", label: "Ngày cấp (YYYY-MM-DD)" },
    { key: "expiryDate", label: "Ngày hết hạn (YYYY-MM-DD, để trống nếu không thời hạn)" },
    { key: "professionalScope", label: "Phạm vi chuyên môn" },
    { key: "reminderDays", label: "Nhắc trước hạn (1–365 ngày)" },
    { key: "note", label: "Ghi chú" },
  ] as const;
  return (
    <Page title={item ? "Sửa chứng chỉ" : "Thêm chứng chỉ"}>
      <Field label="Tìm nhân viên" value={search} editable={!disabled} onChangeText={setSearch} />
      <ChoiceField
        label="Nhân viên"
        value={draft.employeeId}
        choices={choices}
        disabled={disabled}
        onChange={(value) => setDraft((current) => ({ ...current, employeeId: value }))}
      />
      <ChoiceField
        label="Loại"
        value={draft.type}
        choices={Object.entries(credentialTypes).map(([value, label]) => ({
          value: value as Credential["type"],
          label,
        }))}
        disabled={disabled}
        onChange={(value) => setDraft((current) => ({ ...current, type: value }))}
      />
      {fields.map(({ key, label }) => (
        <Field
          key={key}
          label={label}
          value={draft[key]}
          editable={!disabled}
          multiline={key === "note" || key === "professionalScope"}
          keyboardType={key === "reminderDays" ? "numeric" : "default"}
          onChangeText={(value) => setDraft((current) => ({ ...current, [key]: value }))}
        />
      ))}
      <Text style={styles.muted}>Trạng thái hiệu lực được LuxCare tính từ thời hạn và số ngày nhắc.</Text>
      <ErrorText message={error} />
      <Button title={busy ? "Đang lưu…" : "Lưu chứng chỉ"} disabled={disabled} onPress={() => void save()} />
      <Button title="Đóng và tải lại" disabled={busy} onPress={onClose} />
    </Page>
  );
}
