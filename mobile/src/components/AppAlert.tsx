import React, { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type AlertTone = "info" | "success" | "error";
type AlertButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
};
type AlertContent = {
  title: string;
  message: string;
  buttons: AlertButton[];
  tone: AlertTone;
};

export function useAppAlert() {
  const [content, setContent] = useState<AlertContent | null>(null);
  const showAlert = useCallback((
    title: string,
    message: string,
    buttons: AlertButton[] = [{ text: "Đã hiểu" }],
    tone: AlertTone = "info",
  ) => setContent({ title, message, buttons: buttons.length ? buttons : [{ text: "Đã hiểu" }], tone }), []);
  const dismiss = () => {
    const cancel = content?.buttons.find(button => button.style === "cancel");
    setContent(null);
    cancel?.onPress?.();
  };
  const destructive = content?.buttons.some(button => button.style === "destructive");
  const error = content?.tone === "error" || destructive;
  const color = error ? "#dc2626" : "#008852";
  const icon = error ? "alert-circle-outline" : content?.tone === "success" ? "checkmark-circle" : "information-circle-outline";
  const alertView = (
    <Modal visible={content !== null} transparent animationType="fade" onRequestClose={dismiss} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} accessibilityRole="button" accessibilityLabel="Đóng thông báo" />
        <View style={styles.card} accessibilityViewIsModal>
          <Pressable onPress={dismiss} style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            accessibilityRole="button" accessibilityLabel="Đóng thông báo" hitSlop={8}>
            <Ionicons name="close" size={20} color="#64748b" />
          </Pressable>
          <View style={[styles.iconBadge, { backgroundColor: error ? "#fef2f2" : "#ecfdf5" }]}>
            <Ionicons name={icon} size={34} color={color} />
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} bounces={false}>
            <Text style={styles.title} accessibilityRole="header">{content?.title}</Text>
            <Text style={styles.message}>{content?.message}</Text>
          </ScrollView>
          <View style={styles.actions}>
            {content?.buttons.map((button, index) => {
              const secondary = button.style === "cancel";
              return (
                <Pressable key={index} accessibilityRole="button"
                  onPress={() => { setContent(null); button.onPress?.(); }}
                  style={({ pressed }) => [
                    styles.button, secondary ? styles.secondary : { backgroundColor: button.style === "destructive" ? "#dc2626" : "#008852" },
                    pressed && styles.pressed,
                  ]}>
                  <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{button.text}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
  return { showAlert, alertView };
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "rgba(15, 23, 42, 0.44)" },
  card: { width: "100%", maxWidth: 380, maxHeight: "85%", borderRadius: 24, backgroundColor: "#ffffff", padding: 24,
    borderWidth: 1, borderColor: "#e2e8f0", shadowColor: "#0f172a", shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16, shadowRadius: 24, elevation: 12 },
  close: { position: "absolute", top: 12, right: 12, width: 40, height: 40, borderRadius: 20,
    justifyContent: "center", alignItems: "center", zIndex: 1 },
  iconBadge: { width: 68, height: 68, borderRadius: 22, alignItems: "center", justifyContent: "center", alignSelf: "center", marginTop: 8, marginBottom: 18 },
  body: { flexShrink: 1 },
  bodyContent: { gap: 10 },
  title: { fontSize: 20, lineHeight: 28, fontWeight: "700", color: "#0f172a", textAlign: "center" },
  message: { fontSize: 15, lineHeight: 23, color: "#64748b", textAlign: "center" },
  actions: { gap: 10, marginTop: 24 },
  button: { minHeight: 48, paddingVertical: 13, paddingHorizontal: 16, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  buttonText: { color: "#ffffff", fontSize: 15, lineHeight: 22, fontWeight: "600", textAlign: "center" },
  secondary: { backgroundColor: "#f1f5f9", borderWidth: 1, borderColor: "#e2e8f0" },
  secondaryText: { color: "#475569" },
  pressed: { opacity: 0.75 },
});
