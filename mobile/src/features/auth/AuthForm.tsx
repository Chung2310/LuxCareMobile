import { useState, type ReactNode, type PropsWithChildren } from "react";
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../ui";

type IconName = keyof typeof Ionicons.glyphMap;

export function AuthLayout({ title, children, icon, headerAction }: PropsWithChildren<{ title: string; icon?: IconName; headerAction?: ReactNode }>) {
  return (
    <SafeAreaView style={authStyles.screen}>
      <View pointerEvents="none" style={authStyles.backgroundShape} />
      <KeyboardAvoidingView style={authStyles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={authStyles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={authStyles.container}>
            <View style={authStyles.brand}>
              <Image source={require("../../../public/brand-icon.png")} style={authStyles.logo} resizeMode="contain" />
              <Text style={authStyles.brandName}>LuxCare</Text>
            </View>
            <View style={authStyles.form}>
              <View style={authStyles.headerRow}>
                {icon && <View style={authStyles.headerIcon}><Ionicons name={icon} size={28} color="#047857" /></View>}
                {headerAction}
              </View>
              <Text accessibilityRole="header" style={authStyles.title}>{title}</Text>
              {children}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AuthField({ label, icon, ...props }: TextInputProps & { label: string; icon?: IconName }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={authStyles.field}>
      <Text style={authStyles.label}>{label}</Text>
      <View style={[authStyles.inputBox, focused && authStyles.inputFocused]}>
        {icon && <Ionicons name={icon} size={19} color={focused ? "#047857" : colors.muted} />}
        <TextInput
          {...props}
          accessibilityLabel={label}
          placeholderTextColor="#7c8d88"
          selectionColor="#047857"
          style={[authStyles.input, props.style]}
          onFocus={(event) => { setFocused(true); props.onFocus?.(event); }}
          onBlur={(event) => { setFocused(false); props.onBlur?.(event); }}
        />
      </View>
    </View>
  );
}

export function AuthButton({ title, onPress, disabled = false, loading = false, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; loading?: boolean; secondary?: boolean;
}) {
  const unavailable = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        secondary ? authStyles.secondaryButton : authStyles.primaryButton,
        unavailable && authStyles.disabled,
        pressed && authStyles.pressed,
      ]}
    >
      {loading && <ActivityIndicator size="small" color={secondary ? "#047857" : "#ffffff"} />}
      <Text style={secondary ? authStyles.secondaryText : authStyles.primaryText}>{title}</Text>
    </Pressable>
  );
}

export function AuthFeedback({ message, error = false }: { message?: string | null; error?: boolean }) {
  if (!message) return null;
  return (
    <View style={[authStyles.feedback, error && authStyles.feedbackError]}>
      <Ionicons name={error ? "alert-circle-outline" : "checkmark-circle-outline"} size={18} color={error ? "#be123c" : "#047857"} />
      <Text accessibilityRole="alert" style={[authStyles.feedbackText, error && authStyles.errorText]}>{message}</Text>
    </View>
  );
}

export const authStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#eef8f3" },
  flex: { flex: 1 },
  backgroundShape: { position: "absolute", top: -130, right: -100, width: 330, height: 330, borderRadius: 165, backgroundColor: "#d9eee3" },
  content: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 18, paddingTop: 24, paddingBottom: 32 },
  container: { width: "100%", maxWidth: 460, gap: 24 },
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  logo: { width: 46, height: 46 },
  brandName: { fontFamily: "Inter-SemiBold", fontSize: 24, color: "#065f46", letterSpacing: -0.6 },
  form: { backgroundColor: "#ffffff", borderRadius: 26, padding: 22, gap: 18, shadowColor: "#065f46", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 24, elevation: 2 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerIcon: { width: 58, height: 58, backgroundColor: "#ecfdf5", borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "Inter-Bold", fontSize: 27, lineHeight: 34, color: colors.ink, letterSpacing: -0.7, marginBottom: 2 },
  field: { gap: 8 },
  label: { fontFamily: "Inter-SemiBold", fontSize: 13, color: "#334155" },
  inputBox: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 14, backgroundColor: "#f5faf7", borderWidth: 1, borderColor: "#dce9e2", borderRadius: 14 },
  inputFocused: { borderColor: "#059669", backgroundColor: "#ffffff" },
  input: { flex: 1, minWidth: 0, minHeight: 50, paddingVertical: 12, fontSize: 15, fontFamily: "Inter-Regular", color: colors.ink },
  primaryButton: { flexDirection: "row", gap: 9, minHeight: 52, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#065f46" },
  primaryText: { fontFamily: "Inter-SemiBold", fontSize: 16, color: "#ffffff", textAlign: "center" },
  secondaryButton: { flexDirection: "row", gap: 8, minHeight: 44, alignSelf: "center", alignItems: "center", justifyContent: "center", paddingVertical: 10, paddingHorizontal: 12 },
  secondaryText: { fontFamily: "Inter-SemiBold", fontSize: 14, color: "#047857", textAlign: "center" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  feedback: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, backgroundColor: "#ecfdf5" },
  feedbackError: { backgroundColor: "#fff1f2" },
  feedbackText: { flex: 1, fontFamily: "Inter-Regular", fontSize: 13, lineHeight: 20, color: "#047857" },
  errorText: { color: "#be123c" },
  description: { fontFamily: "Inter-Regular", fontSize: 14, lineHeight: 22, color: colors.muted },
  email: { fontFamily: "Inter-SemiBold", fontSize: 14, lineHeight: 22, color: colors.ink },
});
