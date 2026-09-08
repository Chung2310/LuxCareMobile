import { useEffect, useRef, useState } from "react";
import { Text } from "react-native";
import type { Credential } from "../../../../src/types/hrCredential";
import type { CredentialFileFields, CredentialList } from "../../../../src/services/hrCredentialService";
import { pickCredentialFile } from "./uploadFile";
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
  const uploadController = useRef<AbortController | null>(null);
  const [upload, setUpload] = useState<CredentialFileFields | null>(null);
  const [uploading, setUploading] = useState(false);
  useEffect(() => () => uploadController.current?.abort(), []);
  const pick = async () => {
    if (lock.current || blocked) return;
    const controller = new AbortController();
    uploadController.current = controller;
    lock.current = true;
    setLocked(true);
    setUploading(true);
    setError(null);
    try {
      const value = await pickCredentialFile(companyCode, controller.signal);
      if (!controller.signal.aborted && value) setUpload(value);
    } catch (error) {
      if (!controller.signal.aborted) setError(messageOf(error));
    } finally {
      if (!controller.signal.aborted) {
        lock.current = false;
        setLocked(false);
        setUploading(false);
      }
    }
  };
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
    const patch = { ...(item ? credentialChanges(payload, item) : payload), ...upload };
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
        : await credentials.create(companyCode, { ...payload, ...upload });
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
  const disabled = busy || blocked || uploading;
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
      <Text style={styles.text}>
        Tài liệu: {upload?.fileName || item?.fileName || (item?.fileUrl ? "Tệp đã lưu" : "Chưa có")}
      </Text>
      <Text style={styles.muted}>
        Một tệp PDF/JPG/PNG/WebP, tối đa 10 MB. Tệp vừa chọn được gắn vào hồ sơ khi bấm lưu.
        {item?.fileUrl
          ? " Lưu tệp mới sẽ thay tài liệu đang hiển thị trong hồ sơ; tệp cũ có thể vẫn còn trong kho LuxCare."
          : ""}
      </Text>
      <Button
        title={uploading ? "Đang tải tài liệu…" : "Chọn tài liệu"}
        disabled={disabled}
        onPress={() => void pick()}
      />
      {upload && <Button title="Bỏ tệp vừa chọn" disabled={disabled} onPress={() => setUpload(null)} />}
      <ErrorText message={error} />
      <Button title={busy ? "Đang lưu…" : "Lưu chứng chỉ"} disabled={disabled} onPress={() => void save()} />
      <Button title="Đóng và tải lại" disabled={busy || uploading} onPress={onClose} />
    </Page>
  );
}
