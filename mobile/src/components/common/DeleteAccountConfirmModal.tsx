import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getRoleDisplayName } from "../../../../src/utils/permissionUtils";

export interface DeleteAccountConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void | Promise<void>;
  user?: {
    displayName?: string | null;
    email?: string | null;
    photoURL?: string | null;
    avatarUrl?: string | null;
    role?: string | null;
  } | null;
  busy?: boolean;
  errorMessage?: string | null;
}

export function DeleteAccountConfirmModal({
  visible,
  onClose,
  onConfirm,
  user,
  busy = false,
  errorMessage = null,
}: DeleteAccountConfirmModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!visible) return null;

  const initialLetter = (user?.displayName || user?.email || "U").charAt(0).toUpperCase();
  const avatarUrl = user?.photoURL || user?.avatarUrl;
  const roleName = user?.role ? getRoleDisplayName(user.role) : null;

  const handleClose = () => {
    if (busy) return;
    setPassword("");
    setLocalError(null);
    onClose();
  };

  const handleConfirm = () => {
    if (!password.trim()) {
      setLocalError("Vui lòng nhập mật khẩu xác nhận.");
      return;
    }
    setLocalError(null);
    void onConfirm(password);
  };

  const activeError = localError || errorMessage;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="Đóng hộp thoại"
        />

        <View style={styles.card} accessibilityViewIsModal>
          {/* Close button */}
          <Pressable
            onPress={handleClose}
            disabled={busy}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Hủy"
            hitSlop={8}
          >
            <Ionicons name="close" size={20} color="#64748b" />
          </Pressable>

          {/* Warning Icon Badge */}
          <View style={styles.iconRing}>
            <View style={styles.iconCircle}>
              <Ionicons name="warning-outline" size={28} color="#dc2626" />
            </View>
          </View>

          {/* Heading */}
          <Text style={styles.title} accessibilityRole="header">
            Xác nhận xóa tài khoản
          </Text>
          <Text style={styles.message}>
            Hành động này mang tính vĩnh viễn và không thể hoàn tác. Toàn bộ dữ liệu tài khoản và quyền truy cập của bạn sẽ bị xóa.
          </Text>

          {/* User Preview */}
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
              </View>
            </View>
          )}

          {/* Password Confirmation Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Nhập mật khẩu để xác nhận</Text>
            <View style={[styles.inputRow, activeError ? styles.inputRowError : null]}>
              <Ionicons name="lock-closed-outline" size={18} color="#94a3b8" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Nhập mật khẩu của bạn"
                placeholderTextColor="#94a3b8"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  if (localError) setLocalError(null);
                }}
                editable={!busy}
                autoCapitalize="none"
              />
              <Pressable
                onPress={() => setShowPassword(!showPassword)}
                hitSlop={10}
                style={styles.eyeBtn}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#64748b"
                />
              </Pressable>
            </View>
          </View>

          {/* Error Banner */}
          {activeError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#dc2626" />
              <Text style={styles.errorText}>{activeError}</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actionRow}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && !busy && styles.pressed,
                busy && styles.btnDisabled,
              ]}
              disabled={busy}
              onPress={handleClose}
              accessibilityRole="button"
              accessibilityLabel="Ở lại"
            >
              <Text style={styles.cancelBtnText}>Ở lại</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.deleteBtn,
                pressed && !busy && styles.pressed,
                busy && styles.btnDisabled,
              ]}
              disabled={busy}
              onPress={handleConfirm}
              accessibilityRole="button"
              accessibilityLabel="Xóa tài khoản vĩnh viễn"
            >
              {busy ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={18} color="#ffffff" />
                  <Text style={styles.deleteBtnText}>Xóa tài khoản</Text>
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
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 390,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 22,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
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
    fontSize: 13.5,
    lineHeight: 20,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 10,
    marginBottom: 16,
    gap: 12,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e2e8f0",
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: "700",
    color: "#dc2626",
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#0f172a",
  },
  userSub: {
    fontSize: 12,
    color: "#64748b",
  },
  inputContainer: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
  },
  inputRowError: {
    borderColor: "#ef4444",
    backgroundColor: "#fef2f2",
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    fontSize: 12.5,
    color: "#b91c1c",
    fontWeight: "500",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  cancelBtnText: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#475569",
  },
  deleteBtn: {
    flex: 1.2,
    minHeight: 46,
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
  deleteBtnText: {
    fontSize: 14.5,
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
