import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export type CustomerAlertType = "success" | "error" | "warning" | "info" | "confirm";

export interface CustomerAlertModalProps {
  visible: boolean;
  type?: CustomerAlertType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export const CustomerAlertModal: React.FC<CustomerAlertModalProps> = ({
  visible,
  type = "info",
  title,
  message,
  confirmText = "Đồng ý",
  cancelText,
  isDestructive = false,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  if (!visible) return null;

  const isConfirmDialog = Boolean(cancelText);

  // Badge icon & color configurations
  const getBadgeConfig = () => {
    switch (type) {
      case "success":
        return {
          icon: "checkmark-circle" as const,
          color: "#059669",
          bg: "#ecfdf5",
          borderColor: "#a7f3d0",
        };
      case "error":
        return {
          icon: "alert-circle" as const,
          color: "#e11d48",
          bg: "#fff1f2",
          borderColor: "#fecdd3",
        };
      case "warning":
        return {
          icon: "warning" as const,
          color: "#d97706",
          bg: "#fffbeb",
          borderColor: "#fde68a",
        };
      case "confirm":
        return {
          icon: isDestructive ? ("trash-outline" as const) : ("help-circle" as const),
          color: isDestructive ? "#e11d48" : "#d97706",
          bg: isDestructive ? "#fff1f2" : "#fffbeb",
          borderColor: isDestructive ? "#fecdd3" : "#fde68a",
        };
      case "info":
      default:
        return {
          icon: "information-circle" as const,
          color: "#0284c7",
          bg: "#f0f9ff",
          borderColor: "#bae6fd",
        };
    }
  };

  const badge = getBadgeConfig();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel || onConfirm}
    >
      <View style={styles.overlay}>
        {/* Backdrop click dismiss if non-destructive */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={!loading ? (onCancel || onConfirm) : undefined}
        />

        {/* Dialog card with modern rounded corners */}
        <View style={styles.dialogCard}>
          {/* Status Icon Badge */}
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: badge.bg, borderColor: badge.borderColor },
            ]}
          >
            <Ionicons name={badge.icon} size={30} color={badge.color} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message Description */}
          <Text style={styles.message}>{message}</Text>

          {/* Action Buttons */}
          {isConfirmDialog ? (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.btn, styles.cancelBtn]}
                onPress={onCancel}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>{cancelText}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btn,
                  isDestructive ? styles.destructiveBtn : styles.confirmBtn,
                  loading && { opacity: 0.7 },
                ]}
                onPress={onConfirm}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.confirmBtnText}>{confirmText}</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.singleBtn,
                type === "error" ? styles.destructiveBtn : styles.confirmBtn,
                loading && { opacity: 0.7 },
              ]}
              onPress={onConfirm}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.confirmBtnText}>{confirmText}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  dialogCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  iconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 21,
    paddingHorizontal: 4,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 22,
  },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  singleBtn: {
    width: "100%",
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 22,
  },
  cancelBtn: {
    backgroundColor: "#f1f5f9",
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
  },
  confirmBtn: {
    backgroundColor: "#059669",
  },
  destructiveBtn: {
    backgroundColor: "#e11d48",
  },
  confirmBtnText: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#ffffff",
  },
});
