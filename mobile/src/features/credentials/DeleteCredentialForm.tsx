import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Credential } from "../../../../src/types/hrCredential";
import { credentials } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { credentialTypes } from "./model";

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
    } catch (err) {
      setError(`${messageOf(err)} Đóng và tải lại danh sách để kiểm tra kết quả.`);
    } finally {
      lock.current = false;
      setLocked(false);
      setBusy(false);
    }
  };

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.container}>
      <View style={styles.navBar}>
        <Text style={styles.navTitle}>Xóa chứng chỉ</Text>
        <Pressable
          onPress={onClose}
          disabled={busy}
          hitSlop={8}
          style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>⚠️</Text>
        </View>

        <Text style={styles.confirmTitle}>Xác nhận xóa vĩnh viễn?</Text>
        <Text style={styles.confirmSubtitle}>
          Hồ sơ này sẽ bị xóa khỏi hệ thống LuxCare. Thao tác này không thể khôi phục lại.
        </Text>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tên chứng chỉ:</Text>
            <Text style={styles.infoValueBold}>{item.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Nhân viên:</Text>
            <Text style={styles.infoValue}>{item.employeeName}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phân loại:</Text>
            <Text style={styles.infoValue}>{credentialTypes[item.type] || item.type}</Text>
          </View>
          {item.credentialNumber ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Số hiệu:</Text>
              <Text style={styles.infoValue}>{item.credentialNumber}</Text>
            </View>
          ) : null}
          {item.fileName ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tài liệu đính kèm:</Text>
              <Text style={styles.infoValue}>{item.fileName}</Text>
            </View>
          ) : null}
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>

      <View style={styles.actionBar}>
        <Pressable
          style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.7 }]}
          disabled={busy}
          onPress={onClose}
        >
          <Text style={styles.cancelBtnText}>Hủy bỏ</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.deleteBtn,
            (busy || !!error) && styles.deleteBtnDisabled,
            pressed && { opacity: 0.85 },
          ]}
          disabled={busy || !!error}
          onPress={() => void remove()}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.deleteBtnText}>🗑️ Xác nhận xóa</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  navTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748b",
  },
  content: {
    flex: 1,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff1f2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  iconText: {
    fontSize: 32,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
  },
  confirmSubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },
  infoCard: {
    width: "100%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
    marginTop: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 13,
    color: "#64748b",
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  infoValueBold: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  errorBanner: {
    width: "100%",
    backgroundColor: "#fff1f2",
    borderWidth: 1,
    borderColor: "#fecdd3",
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: "#be123c",
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  actionBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  deleteBtn: {
    flex: 2,
    backgroundColor: "#e11d48",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    shadowColor: "#e11d48",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  deleteBtnDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  deleteBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
  },
});
