import { useRef, useState } from "react";
import { Linking, Text } from "react-native";
import { randomUUID } from "expo-crypto";
import type { TaskAttachment } from "../../../../src/types/hr";
import { Button, Card, ErrorText, Field, Page, styles } from "../../ui";
import { messageOf } from "../../auth/SessionProvider";
import { shareLeaveFile } from "../leave/files";
import { pickWorkAttachment } from "./attachments";
export function AttachmentsForm({
  initial,
  save,
  onClose,
  setLocked,
}: {
  initial: TaskAttachment[];
  save?: (items: TaskAttachment[]) => Promise<void>;
  onClose: () => void;
  setLocked: (locked: boolean) => void;
}) {
  const [items, setItems] = useState(initial);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
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
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const disabled = busy || uncertain;
  return (
    <Page title="Tệp đính kèm">
      <Text style={styles.muted}>
        {items.length} tệp/liên kết{save ? " · Bấm Lưu để áp dụng thay đổi" : ""}
      </Text>
      {items.map((item) => (
        <Card key={item.id}>
          <Text style={styles.text}>{item.name}</Text>
          <Button
            title={item.type === "link" ? "Mở liên kết" : "Tải / chia sẻ"}
            disabled={busy}
            onPress={() =>
              void run(async () => {
                if (item.type === "link") {
                  const target = new URL(item.url);
                  if (!["https:", "http:"].includes(target.protocol))
                    throw new Error("Chỉ hỗ trợ liên kết HTTP/HTTPS.");
                  await Linking.openURL(target.toString());
                } else await shareLeaveFile(item.url, item.name);
              })
            }
          />
          {save && (
            <Button
              title="Gỡ khỏi danh sách"
              disabled={disabled}
              onPress={() => setItems((value) => value.filter((file) => file.id !== item.id))}
            />
          )}
        </Card>
      ))}
      {save && (
        <>
          <Button
            title="Chọn tệp (tối đa 20 MB)"
            disabled={disabled || items.length >= 20}
            onPress={() =>
              void run(async () => {
                const file = await pickWorkAttachment();
                if (file) setItems((value) => [...value, file]);
              })
            }
          />
          <Field label="Tên liên kết" value={name} editable={!disabled} onChangeText={setName} />
          <Field label="Địa chỉ HTTP/HTTPS" value={url} editable={!disabled} onChangeText={setUrl} />
          <Button
            title="Thêm liên kết"
            disabled={disabled || items.length >= 20}
            onPress={() => {
              try {
                const target = new URL(url.trim());
                if (!["https:", "http:"].includes(target.protocol)) throw new Error("Chỉ hỗ trợ HTTP/HTTPS.");
                setItems((value) => [
                  ...value,
                  { id: randomUUID(), name: name.trim() || target.hostname, url: target.toString(), type: "link" },
                ]);
                setUrl("");
                setName("");
                setError(null);
              } catch {
                setError("Vui lòng nhập liên kết HTTP/HTTPS hợp lệ.");
              }
            }}
          />
          <Button
            title="Lưu đính kèm"
            disabled={disabled}
            onPress={() =>
              void run(async () => {
                try {
                  await save(items);
                } catch (error) {
                  if (!(error && typeof error === "object" && "status" in error) || Number(error.status) >= 500) {
                    setUncertain(true);
                    throw new Error(
                      "Chưa xác nhận được kết quả lưu. Đóng và tải lại danh sách trước khi thao tác tiếp.",
                    );
                  }
                  throw error;
                }
                onClose();
              })
            }
          />
        </>
      )}
      <ErrorText message={error} />
      <Button title={save ? "Đóng / bỏ thay đổi chưa lưu" : "Đóng"} disabled={busy} onPress={onClose} />
    </Page>
  );
}
