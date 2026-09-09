import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import type { ContractFileItem } from "../../../../src/types/hrContract";
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

  if (!files.length) return null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{files.length}</Text>
        </View>
      </View>

      <View style={styles.fileList}>
        {files.map((file, index) => {
          const isImage = /\.(jpe?g|png|webp)$/i.test(file.name || file.url);
          const icon = isImage ? "🖼️" : "📄";
          const isLoading = busy === index;

          return (
            <View key={`${file.url}:${index}`} style={styles.fileCard}>
              <View style={styles.fileIconBox}>
                <Text style={styles.fileIcon}>{icon}</Text>
              </View>

              <View style={styles.fileInfo}>
                <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                  {file.name || "Tệp đính kèm"}
                </Text>
                <Text style={styles.fileMeta}>
                  {file.size ? `${Math.ceil(file.size / 1024)} KB` : "Tệp hợp lệ"}
                </Text>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.openBtn,
                  pressed && { opacity: 0.8 },
                  isLoading && styles.openBtnLoading,
                ]}
                disabled={busy !== null || !file.url}
                onPress={() => void open(file, index)}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.openBtnText}>Mở / Tải</Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </View>

      {!!error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 10,
    gap: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
  },
  countBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#64748b",
  },
  fileList: {
    gap: 8,
  },
  fileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  fileIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  fileIcon: {
    fontSize: 18,
  },
  fileInfo: {
    flex: 1,
    gap: 2,
  },
  fileName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  fileMeta: {
    fontSize: 11,
    color: "#64748b",
  },
  openBtn: {
    backgroundColor: "#0284c7",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 78,
  },
  openBtnLoading: {
    backgroundColor: "#38bdf8",
  },
  openBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  errorBox: {
    backgroundColor: "#fff1f2",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorText: {
    color: "#e11d48",
    fontSize: 12,
    fontWeight: "500",
  },
});
