import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";

// Same palette as src/index.css; native styles do not depend on the web CSS runtime.
export const colors = {
  primary: "#059669",
  ink: "#071629",
  muted: "#64748b",
  background: "#f6f8fd",
  border: "#e2e8f0",
  error: "#be123c",
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, gap: 16, paddingBottom: 36 },
  title: { fontSize: 26, fontWeight: "700", color: colors.ink, fontFamily: "Inter-Bold" },
  heading: { fontSize: 16, fontWeight: "600", color: colors.ink, fontFamily: "Inter-SemiBold" },
  text: { fontSize: 13, lineHeight: 21, color: colors.ink, fontFamily: "Inter-Regular" },
  muted: { fontSize: 12, lineHeight: 19, color: colors.muted, fontFamily: "Inter-Regular" },
  card: {
    padding: 18,
    borderRadius: 18,
    backgroundColor: "white",
    gap: 10,
    borderColor: colors.border,
    borderWidth: 1,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "white",
    padding: 14,
    borderRadius: 12,
    fontSize: 14,
    color: colors.ink,
    fontFamily: "Inter-Regular",
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    backgroundColor: colors.primary,
    minHeight: 48,
  },
  buttonText: { color: "white", fontWeight: "600", fontSize: 13, fontFamily: "Inter-SemiBold" },
  error: { color: colors.error, backgroundColor: "#fff1f2", borderRadius: 12, padding: 14, lineHeight: 22, fontFamily: "Inter-Regular" },
});
export function Page({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {children}
    </ScrollView>
  );
}
export function Card({ children }: React.PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}
export function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { opacity: disabled ? 0.45 : 1 },
        pressed && !disabled && {
          borderColor: "#008852",
          borderWidth: 2,
          shadowColor: "#008852",
          shadowOpacity: 0.35,
          shadowRadius: 5,
          transform: [{ scale: 0.98 }],
        },
      ]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={styles.text}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} {...props} style={styles.input} />
    </View>
  );
}
export function ErrorText({ message }: { message: string | null }) {
  return message ? (
    <Text accessibilityRole="alert" style={styles.error}>
      {message}
    </Text>
  ) : null;
}
export function Loading() {
  return <ActivityIndicator size="large" color={colors.primary} style={{ padding: 32 }} />;
}

export function EmptyState({
  message = "Không có dữ liệu",
  subtitle,
}: {
  message?: string;
  subtitle?: string;
}) {
  return (
    <View style={emptyStyles.container}>
      <Image
        source={require("../public/khong-co-gi-o-day.png")}
        style={emptyStyles.image}
        resizeMode="contain"
      />
      {message ? <Text style={emptyStyles.message}>{message}</Text> : null}
      {subtitle ? <Text style={emptyStyles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    gap: 6,
  },
  image: {
    width: 240,
    height: 135,
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    fontWeight: "700",
    color: "#334155",
    fontFamily: "Inter-Bold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12,
    color: "#94a3b8",
    fontFamily: "Inter-Regular",
    textAlign: "center",
    maxWidth: 280,
  },
});
