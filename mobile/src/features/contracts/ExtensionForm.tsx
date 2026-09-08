import { useRef, useState } from "react";
import { Text } from "react-native";
import type { Contract } from "../../../../src/types/hrContract";
import type { ContractScope } from "../../../../src/services/hrContractService";
import { contracts } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, ErrorText, Field, Page, styles } from "../../ui";
import { contractDate, contractStatuses } from "./model";
import { extensionDraft, extensionPayload } from "./extensionModel";
import { UploadFields } from "./UploadFields";
import { contractUploadFields, type ContractUploads } from "./uploadModel";
export function ExtensionForm({
  contract,
  scope,
  onClose,
  setLocked,
}: {
  contract: Contract;
  scope: ContractScope;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [draft, setDraft] = useState(extensionDraft);
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const [uploads, setUploads] = useState<ContractUploads>({});
  const save = async () => {
    if (lock.current || blocked) return;
    let payload;
    try {
      payload = extensionPayload(draft, contract);
    } catch (error) {
      setError(messageOf(error));
      return;
    }
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      const result = await contracts.extend(scope, contract._id, { ...payload, ...contractUploadFields(uploads) });
      if (!result?.contract?._id || !result?.extension?._id) throw new Error("Chưa xác nhận được kết quả gia hạn.");
      onClose();
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? Number(error.status) : 0;
      if (!status || status >= 500 || status === 409) {
        setBlocked(true);
        setError(`${messageOf(error)} Đóng và kiểm tra thời hạn cùng lịch sử gia hạn trước khi gửi tiếp.`);
      } else setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  return (
    <Page title="Gia hạn hợp đồng">
      <Text style={styles.heading}>
        {contract.employeeName} · {contract.contractType}
      </Text>
      <Text style={styles.text}>Hết hạn hiện tại: {contractDate(contract.endDate)}</Text>
      <Text style={styles.muted}>
        {contract.status === "expired"
          ? "Gia hạn sẽ chuyển hợp đồng hết hạn về trạng thái đang hiệu lực theo API LuxCare."
          : `Trạng thái sau gia hạn: ${contractStatuses[contract.status]}.`}
      </Text>
      <Field
        label="Ngày hết hạn mới (YYYY-MM-DD)"
        value={draft.newEndDate}
        editable={!busy && !blocked}
        onChangeText={(value) => setDraft((current) => ({ ...current, newEndDate: value }))}
      />
      <Field
        label="Ngày gia hạn (YYYY-MM-DD)"
        value={draft.extensionDate}
        editable={!busy && !blocked}
        onChangeText={(value) => setDraft((current) => ({ ...current, extensionDate: value }))}
      />
      <Field
        label="Lý do gia hạn"
        multiline
        value={draft.reason}
        editable={!busy && !blocked}
        onChangeText={(value) => setDraft((current) => ({ ...current, reason: value }))}
      />
      <ErrorText message={error} />
      <UploadFields
        extension
        scope={scope}
        value={uploads}
        onChange={setUploads}
        disabled={busy || blocked}
        onBusy={(value) => {
          lock.current = value;
          setBusy(value);
          setLocked(value);
        }}
      />
      <Button title={busy ? "Đang xử lý…" : "Lưu gia hạn"} disabled={busy || blocked} onPress={() => void save()} />
      <Button title="Đóng và tải lại" disabled={busy} onPress={onClose} />
    </Page>
  );
}
