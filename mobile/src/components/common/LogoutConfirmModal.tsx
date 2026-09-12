import React from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getRoleDisplayName } from "../../../../src/utils/permissionUtils";

export interface LogoutConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  user?: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
    avatarUrl?: string | null;
    role?: string | null;
    companyCode?: string | null;
    branchName?: string | null;
  } | null;
  busy?: boolean;
}

export function LogoutConfirmModal({
  visible,
  onClose,
  onConfirm,
  user,
  busy = false,
}: LogoutConfirmModalProps) {
  if (!visible) return null;

  const initialLetter = (user?.displayName || user?.email || "U").charAt(0).toUpperCase();
  const avatarUrl = user?.photoURL || user?.avatarUrl;
  const roleName = user?.role ? getRoleDisplayName(user.role) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => {
            if (!busy) onClose();
          }}
          accessibilityRole="button"
          accessibilityLabel="Đóng xác nhận"
        />

        <View style={styles.card} accessibilityViewIsModal>
          {/* Close X button */}
          <Pressable
            onPress={() => {
              if (!busy) onClose();
            }}
            disabled={busy}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Hủy đăng xuất"
            hitSlop={8}
          >
            <Ionicons name="close" size={20} color="#64748b" />
          </Pressable>

          {/* Icon Badge */}
          <View style={styles.iconRing}>
            <View style={styles.iconCircle}>
              <Ionicons name="log-out-outline" size={28} color="#dc2626" />
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.title} accessibilityRole="header">
            Xác nhận đăng xuất
          </Text>
          <Text style={styles.message}>
            Bạn có chắc chắn muốn đăng xuất khỏi tài khoản trên thiết bị này không?
          </Text>

          {/* Current User Card */}
          {user && (
            <View style={styles.userCard}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitial}>{initialLetter}</Text>
                </View>
              )}

              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {user.displayName || user.email || "Người dùng"}
                </Text>

                <Text style={styles.userSub} numberOfLines={1}>
                  {user.email || (roleName ? `${roleName}` : "")}
                </Text>

                <View style={styles.syncRow}>
                  <Ionicons name="shield-checkmark" size={13} color="#10b981" />
                  <Text style={styles.syncText}>Dữ liệu làm việc đã lưu an toàn</Text>
                </View>
              </View>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && !busy && styles.pressed,
                busy && styles.btnDisabled,
              ]}
              disabled={busy}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Ở lại"
            >
              <Text style={styles.cancelBtnText}>Ở lại</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.logoutBtn,
                pressed && !busy && styles.pressed,
                busy && styles.btnDisabled,
              ]}
              disabled={busy}
              onPress={() => {
                void onConfirm();
              }}
              accessibilityRole="button"
              accessibilityLabel="Đăng xuất tài khoản"
            >
              {busy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="log-out-outline" size={18} color="#ffffff" />
                  <Text style={styles.logoutBtnText}>Đăng xuất</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  closeBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  iconRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 14,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#fca5a5",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 16,
    padding: 12,
    marginBottom: 20,
    gap: 12,
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e2e8f0",
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "700",
    color: "#dc2626",
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  userSub: {
    fontSize: 12.5,
    color: "#64748b",
  },
  syncRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  syncText: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#10b981",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475569",
  },
  logoutBtn: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  logoutBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.75,
  },
});
