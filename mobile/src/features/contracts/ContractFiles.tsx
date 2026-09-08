import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import type { ContractFileItem } from "../../../../src/types/hrContract";
import { Button, ErrorText, styles } from "../../ui";
import { shareApiFile, MAX_SHARED_FILE_BYTES } from "../../files/shareFile";
import { messageOf } from "../../auth/SessionProvider";
export function ContractFiles({ title, files }: { title: string; files: ContractFileItem[] }) {
  const pending = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  useFocusEffect(
    useCallback(() => {
      setBusy(null);
      setError(null);
      return () => {
        pending.current?.abort();
        pending.current = null;
      };
    }, []),
  );
  const open = async (file: ContractFileItem, index: number) => {
    if (pending.current) return;
    const request = new AbortController();
    pending.current = request;
    setBusy(index);
    setError(null);
    try {
      if (file.size && file.size > MAX_SHARED_FILE_BYTES)
        throw new Error("Tệp vượt quá 20 MB. Vui lòng tải từ LuxCare web.");
      await shareApiFile(file.url, file.name || "tai-lieu", request.signal);
    } catch (error) {
      if (!request.signal.aborted) setError(messageOf(error));
    } finally {
      if (pending.current === request) {
        pending.current = null;
        setBusy(null);
      }
    }
  };
  return (
    <>
      <Text style={styles.heading}>
        {title} ({files.length})
      </Text>
      {files.map((file, index) => (
        <View key={`${file.url}:${index}`}>
          <Text style={styles.text}>
            {file.name || "Tệp tài liệu"}
            {file.size ? ` · ${Math.ceil(file.size / 1024)} KB` : ""}
          </Text>
          <Button
            title={busy === index ? "Đang tải…" : "Tải và mở/chia sẻ"}
            disabled={busy !== null || !file.url}
            onPress={() => void open(file, index)}
          />
        </View>
      ))}
      <ErrorText message={error} />
    </>
  );
}
