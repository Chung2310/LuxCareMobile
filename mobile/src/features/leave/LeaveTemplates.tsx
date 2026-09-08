import { useRef, useState } from "react";
import { Alert, Text } from "react-native";
import type { LeaveTemplate, RequestKind, LeaveAttachment } from "../../../../src/types/leave";
import { REQUEST_KIND_OPTIONS } from "../../../../src/types/leave";
import { leave } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { Button, Card, ErrorText, Field, Page, styles } from "../../ui";
import { ChoiceField } from "./ChoiceField";
import { pickLeaveAttachment, shareLeaveFile } from "./files";
export function LeaveTemplates({
  templates,
  canManage,
  reload,
  onClose,
  setLocked,
}: {
  templates: LeaveTemplate[];
  canManage: boolean;
  reload: () => Promise<void>;
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<RequestKind>("leave");
  const [file, setFile] = useState<(LeaveAttachment & { uploadToken: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      await action();
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
      setLocked(false);
      lock.current = false;
    }
  };
  return (
    <Page title="Biểu mẫu đơn từ">
      <ErrorText message={error} />
      {templates.length === 0 && <Text style={styles.muted}>Chưa có biểu mẫu.</Text>}
      {templates.map((item) => (
        <Card key={item._id}>
          <Text style={styles.heading}>{item.name}</Text>
          <Text style={styles.muted}>
            {REQUEST_KIND_OPTIONS.find((kind) => kind.value === item.requestKind)?.label}
          </Text>
          <Button
            title={`Tải / chia sẻ ${item.fileName}`}
            disabled={busy}
            onPress={() => void run(() => shareLeaveFile(item.fileUrl, item.fileName))}
          />
          {canManage && (
            <Button
              title="Xóa biểu mẫu"
              disabled={busy}
              onPress={() =>
                Alert.alert("Xóa biểu mẫu?", item.name, [
                  { text: "Hủy", style: "cancel" },
                  {
                    text: "Xóa",
                    style: "destructive",
                    onPress: () =>
                      void run(async () => {
                        await leave.removeTemplate(item._id);
                        await reload();
                      }),
                  },
                ])
              }
            />
          )}
        </Card>
      ))}
      {canManage && (
        <Card>
          <Text style={styles.heading}>Đăng biểu mẫu</Text>
          <Field label="Tên biểu mẫu" value={name} onChangeText={setName} maxLength={200} editable={!busy} />
          <ChoiceField
            label="Loại yêu cầu"
            value={kind}
            choices={REQUEST_KIND_OPTIONS}
            onChange={setKind}
            disabled={busy}
          />
          {file && <Text style={styles.text}>{file.name}</Text>}
          <Button
            title={file ? "Chọn tệp khác" : "Chọn tệp biểu mẫu"}
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const selected = await pickLeaveAttachment();
                if (selected) setFile(selected);
              })
            }
          />
          <Button
            title="Đăng biểu mẫu"
            disabled={busy || !file || !name.trim()}
            onPress={() =>
              void run(async () => {
                if (!file) return;
                await leave.createTemplate({
                  name: name.trim(),
                  requestKind: kind,
                  fileUrl: file.url,
                  fileName: file.name,
                  uploadToken: file.uploadToken,
                });
                setName("");
                setFile(null);
                await reload();
              })
            }
          />
        </Card>
      )}
      <Button title="Đóng" disabled={busy} onPress={onClose} />
    </Page>
  );
}
