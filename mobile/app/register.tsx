import { useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession, messageOf } from "../src/auth/SessionProvider";
import { onboarding } from "../src/api/services";
import { AuthLayout, AuthField, AuthButton, AuthFeedback } from "../src/features/auth/AuthForm";
import { needsOnboarding } from "../../shared/onboarding";

export default function Register() {
  const session = useSession();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [terms, setTerms] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    let alive = true;
    onboarding.capabilities().then((value) => {
      if (!alive) return;
      setEnabled(value.registrationEnabled);
      if (!value.registrationEnabled) setError("Đăng ký đang tạm đóng. Vui lòng thử lại sau.");
    }).catch((reason) => { if (alive) setError(messageOf(reason)); });
    return () => { alive = false; };
  }, []);

  if (session.user) return <Redirect href={needsOnboarding(session.user) ? "/onboarding" : "/(tabs)"} />;

  async function submit() {
    if (busy || (!enabled && !created)) return;
    setError(null);
    if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Nhập họ tên và email hợp lệ.");
      return;
    }
    if (password.length < 8 || password.length > 72) {
      setError("Mật khẩu cần từ 8 đến 72 ký tự.");
      return;
    }
    if (password !== confirmation) {
      setError("Mật khẩu xác nhận chưa khớp.");
      return;
    }
    if (!terms) {
      setError("Vui lòng đồng ý điều khoản và chính sách bảo mật.");
      return;
    }
    setBusy(true);
    Keyboard.dismiss();
    try {
      if (!created) {
        await onboarding.register(email.trim().toLowerCase(), password, name.trim());
        setCreated(true);
      }
      await session.login(email.trim().toLowerCase(), password);
      router.replace("/onboarding");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  const editable = !busy && !created;
  return (
    <AuthLayout title="Đăng ký tài khoản">
      <AuthField label="Họ và tên" icon="person-outline" placeholder="Nhập họ và tên của bạn" value={name} onChangeText={setName} autoComplete="name" autoCapitalize="words" maxLength={100} editable={editable} />
      <AuthField label="Email" icon="mail-outline" placeholder="Nhập địa chỉ email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={254} editable={editable} />
      <AuthField label="Mật khẩu" icon="lock-closed-outline" placeholder="Từ 8 đến 72 ký tự" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" maxLength={72} editable={editable} />
      <AuthField label="Nhập lại mật khẩu" icon="lock-closed-outline" placeholder="Nhập lại mật khẩu của bạn" value={confirmation} onChangeText={setConfirmation} secureTextEntry autoCapitalize="none" autoCorrect={false} autoComplete="new-password" maxLength={72} editable={editable} returnKeyType="done" onSubmitEditing={() => void submit()} />
      <View style={localStyles.termsRow}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityLabel="Đồng ý điều khoản sử dụng và chính sách bảo mật"
          accessibilityState={{ checked: terms, disabled: !editable }}
          disabled={!editable}
          onPress={() => setTerms((value) => !value)}
          style={({ pressed }) => [localStyles.checkboxTouch, pressed && { opacity: 0.7 }]}
        >
          <View style={[localStyles.checkbox, terms && localStyles.checkboxChecked]}>
            {terms && <Ionicons name="checkmark" size={16} color="#ffffff" />}
          </View>
        </Pressable>
        <Text style={localStyles.termsText}>
          Tôi đồng ý với{" "}
          <Text accessibilityRole="link" onPress={() => router.push("/terms-of-service")} style={localStyles.link}>Điều khoản sử dụng</Text>
          {" "}và{" "}
          <Text accessibilityRole="link" onPress={() => router.push("/privacy-policy")} style={localStyles.link}>Chính sách bảo mật</Text>.
        </Text>
      </View>
      <AuthFeedback message={error} error />
      {created && <AuthFeedback message="Tài khoản đã được tạo. Tiếp tục để xác minh email." />}
      <AuthButton title={busy ? "Đang xử lý…" : created ? "Tiếp tục" : "Đăng ký"} onPress={() => void submit()} loading={busy} disabled={!enabled && !created} />
      <View style={localStyles.loginRow}>
        <Text style={localStyles.loginHint}>Đã có tài khoản?</Text>
        <Pressable accessibilityRole="link" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => router.replace("/login")} style={({ pressed }) => [localStyles.loginLink, pressed && { opacity: 0.7 }]}>
          <Text style={localStyles.link}>Đăng nhập</Text>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const localStyles = StyleSheet.create({
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  checkboxTouch: { width: 44, minHeight: 44, alignItems: "center", justifyContent: "center", marginLeft: -10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "#b5cbbf", alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: "#047857", borderColor: "#047857" },
  termsText: { flex: 1, paddingTop: 9, fontFamily: "Inter-Regular", fontSize: 12, lineHeight: 20, color: "#64748b" },
  link: { fontFamily: "Inter-SemiBold", color: "#047857", fontSize: 13 },
  loginRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 4 },
  loginHint: { fontFamily: "Inter-Regular", fontSize: 13, color: "#64748b" },
  loginLink: { minHeight: 44, justifyContent: "center", paddingHorizontal: 6 },
});
