import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { ContractScope, ContractUploadKind } from "../../../../src/services/hrContractService";
import { messageOf } from "../../auth/SessionProvider";
import { pickContractFile } from "./uploadFile";
import type { ContractUploads } from "./uploadModel";

export function UploadFields({
  scope,
  extension = false,
  value,
  onChange,
  disabled,
  onBusy,
}: {
  scope: ContractScope;
  extension?: boolean;
  value: ContractUploads;
  onChange: (value: ContractUploads) => void;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const pick = async (kind: ContractUploadKind, source: "file" | "camera" = "file") => {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError(null);
    try {
      const file = await pickContractFile(scope, kind, source);
      if (mounted.current && file) onChange({ ...value, [kind]: file });
    } catch (err) {
      if (mounted.current) setError(messageOf(err));
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  };

  const groups: { kind: ContractUploadKind; title: string; desc: string; icon: string }[] = extension
    ? [
        {
          kind: "extension",
          title: "Tệp phụ lục gia hạn",
          desc: "PDF hoặc tài liệu phụ lục (tối đa 10 MB)",
          icon: "📄",
        },
        {
          kind: "extensionSigned",
          title: "Ảnh phụ lục đã ký",
          desc: "Ảnh chụp hợp đồng / phụ lục có chữ ký (tối đa 10 MB)",
          icon: "✍️",
        },
      ]
    : [
        {
          kind: "contract",
          title: "Tệp hợp đồng lao động",
          desc: "Bản tài liệu số hoặc scan hợp đồng (tối đa 10 MB)",
          icon: "📄",
        },
        {
          kind: "signed",
          title: "Ảnh hợp đồng đã ký",
          desc: "Ảnh chụp trang có chữ ký hai bên (tối đa 10 MB)",
          icon: "✍️",
        },
      ];

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        📎 Đính kèm tệp hồ sơ (tối đa 10 MB mỗi tệp). Tệp sẽ được lưu cùng hợp đồng khi bạn bấm Lưu.
      </Text>

      <View style={styles.list}>
        {groups.map(({ kind, title, desc, icon }) => {
          const selected = value[kind];
          return (
            <View key={kind} style={styles.card}>
              <View style={styles.headerRow}>
                <View style={styles.iconBox}>
                  <Text style={styles.icon}>{icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.desc}>{desc}</Text>
                </View>
              </View>

              {selected ? (
                <View style={styles.selectedBox}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.selectedLabel}>Đã chọn:</Text>
                    <Text style={styles.selectedName} numberOfLines={1} ellipsizeMode="middle">
                      {selected.name || "Tệp đã tải lên"}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.removeBtn}
                    disabled={disabled || busy}
                    onPress={() => {
                      const next = { ...value };
                      delete next[kind];
                      onChange(next);
                    }}
                  >
                    <Text style={styles.removeBtnText}>✕ Xóa</Text>
                  </Pressable>
                </View>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.pickBtn,
                  selected && styles.pickBtnSecondary,
                  (disabled || busy) && styles.pickBtnDisabled,
                  pressed && { opacity: 0.8 },
                ]}
                disabled={disabled || busy}
                onPress={() => void pick(kind)}
              >
                <Text style={[styles.pickBtnText, selected && styles.pickBtnSecondaryText]}>
                  {selected ? "Đổi tệp khác" : "Chọn tệp từ máy..."}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={"Chụp ảnh trực tiếp: " + title}
                accessibilityState={{ disabled: disabled || busy }}
                style={({ pressed }) => [styles.pickBtn, styles.pickBtnSecondary, (disabled || busy) && styles.pickBtnDisabled, pressed && { opacity: 0.8 }]}
                disabled={disabled || busy}
                onPress={() => void pick(kind, "camera")}
              >
                <Text style={[styles.pickBtnText, styles.pickBtnSecondaryText]}>Chụp ảnh trực tiếp</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {busy && (
        <View style={styles.busyRow}>
          <ActivityIndicator size="small" color="#059669" />
          <Text style={styles.busyText}>Đang tải tệp lên hệ thống...</Text>
        </View>
      )}

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
    gap: 10,
  },
  hint: {
    fontSize: 12,
    color: "#64748b",
    lineHeight: 18,
  },
  list: {
    gap: 10,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  icon: {
    fontSize: 18,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  desc: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 1,
  },
  selectedBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  selectedLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#166534",
    textTransform: "uppercase",
  },
  selectedName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#15803d",
  },
  removeBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "#fee2e2",
  },
  removeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#dc2626",
  },
  pickBtn: {
    backgroundColor: "#059669",
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  pickBtnSecondary: {
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  pickBtnDisabled: {
    opacity: 0.5,
  },
  pickBtnText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
  },
  pickBtnSecondaryText: {
    color: "#334155",
  },
  busyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  busyText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "500",
  },
  errorBox: {
    backgroundColor: "#fff1f2",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fecdd3",
  },
  errorText: {
    color: "#e11d48",
    fontSize: 12,
    fontWeight: "600",
  },
});
