import React from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
} from "react-native";
import { View } from "react-native";

export const colors = {
  primary: "#059669",
  ink: "#071629",
  muted: "#64748b",
  background: "#f8fafc",
  border: "#e2e8f0",
  error: "#be123c",
};

export const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 14,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0f172a",
    letterSpacing: -0.3,
    fontFamily: "Inter-Bold",
  },
  heading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-SemiBold",
  },
  text: {
    fontSize: 13,
    lineHeight: 21,
    color: "#0f172a",
    fontFamily: "Inter-Regular",
  },
  muted: {
    fontSize: 12,
    lineHeight: 19,
    color: colors.muted,
    fontFamily: "Inter-Regular",
  },
  card: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    gap: 10,
    borderColor: colors.border,
    borderWidth: 1,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    fontSize: 14,
    color: "#0f172a",
    fontFamily: "Inter-Regular",
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    minHeight: 46,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
    fontFamily: "Inter-SemiBold",
  },
  error: {
    color: colors.error,
    backgroundColor: "#fff1f2",
    borderColor: "#fecdd3",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    lineHeight: 20,
    fontFamily: "Inter-Regular",
  },
});

export function Page({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
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
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, props.style]}
      />
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
