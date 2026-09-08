import { useRef, useState } from "react";
import { Text } from "react-native";
import type { Credential } from "../../../../src/types/hrCredential";
import { credentials } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, ErrorText, Page, styles } from "../../ui";

export function DeleteCredentialForm({
  item,
  companyCode,
  setLocked,
  onClose,
}: {
  item: Credential;
  companyCode: string;
  setLocked: (value: boolean) => void;
  onClose: () => void;
}) {
  const lock = useRef(false);
  const attempted = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remove = async () => {
    if (lock.current || attempted.current) return;
    attempted.current = true;
    lock.current = true;
    setLocked(true);
    setBusy(true);
    try {
      await credentials.remove(companyCode, item._id);
      onClose();
    } catch (error) {
      setError(`${messageOf(error)} Đóng và tải lại danh sách để kiểm tra kết quả trước khi thao tác tiếp.`);
    } finally {
      lock.current = false;
      setLocked(false);
      setBusy(false);
    }
  };
  return (
    <Page title="Xóa chứng chỉ">
      <Text style={styles.heading}>{item.name}</Text>
      <Text style={styles.text}>Nhân viên: {item.employeeName}</Text>
      <Text style={styles.text}>Hồ sơ này sẽ bị xóa vĩnh viễn. Không thể khôi phục hồ sơ chứng chỉ từ ứng dụng.</Text>
      {(item.fileUrl || item.resourceId) && (
        <Text style={styles.muted}>
          Tài liệu: {item.fileName || "Tệp đính kèm"}. Xóa hồ sơ không đảm bảo xóa tệp đã lưu. Hãy kiểm tra lại tài liệu
          trong LuxCare sau thao tác.
        </Text>
      )}
      <ErrorText message={error} />
      <Button
        title={busy ? "Đang xóa…" : "Xác nhận xóa vĩnh viễn"}
        disabled={busy || !!error}
        onPress={() => void remove()}
      />
      <Button title={error ? "Đóng và tải lại" : "Hủy"} disabled={busy} onPress={onClose} />
    </Page>
  );
}
