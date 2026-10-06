import { useEffect, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession, messageOf } from "../src/auth/SessionProvider";
import { onboarding } from "../src/api/services";
import { AuthLayout, AuthField, AuthButton, AuthFeedback } from "../src/features/auth/AuthForm";
import { OtpCodeInput } from "../src/features/auth/OtpCodeInput";
import { needsEmailVerification } from "../../shared/onboarding";

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
  const [verified, setVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    let alive = true;
    onboarding.capabilities().then((value) => {
      if (!alive) return;
      setEnabled(value.registrationEnabled);
      if (!value.registrationEnabled) setError("Đăng ký đang tạm đóng. Vui lòng thử lại sau.");
    }).catch((reason) => { if (alive) setError(messageOf(reason)); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  if (session.user) return <Redirect href={needsEmailVerification(session.user) ? "/onboarding" : "/(tabs)"} />;

  async function submit() {
    if (busy || (!enabled && !created)) return;
    setError(null);
    if (!created) {
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
    } else if (!verified && verificationCode.length !== 6) {
      setError("Nhập mã xác minh gồm 6 chữ số.");
      return;
    }
    setBusy(true);
    Keyboard.dismiss();
    let registrationVerified = false;
    try {
      if (!created) {
        await onboarding.register(email.trim().toLowerCase(), password, name.trim());
        setCreated(true);
        setResendSeconds(60);
        return;
      }
      if (verified) {
        router.replace("/login");
        return;
      }
      await onboarding.verifyRegistration(email.trim().toLowerCase(), verificationCode);
      registrationVerified = true;
      setVerificationCode("");
      await session.login(email.trim().toLowerCase(), password);
      setVerified(true);
    } catch (reason) {
      if (registrationVerified) {
        router.replace("/login");
        return;
      }
      if ((reason as { code?: string })?.code === "EMAIL_COOLDOWN") {
        setCreated(true);
        setResendSeconds(60);
      }
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  const editable = !busy && !created;
  async function resendCode() {
    if (busy || resendSeconds > 0 || !created || verified) return;
    setBusy(true);
    setError(null);
    try {
      await onboarding.register(email.trim().toLowerCase(), password, name.trim());
      setVerificationCode("");
      setResendSeconds(60);
      setError(null);
    } catch (reason) {
      setError(messageOf(reason));
      if ((reason as { code?: string })?.code === "EMAIL_COOLDOWN") setResendSeconds(60);
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout title="Đăng ký tài khoản">
      {!created ? (
        <>
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
        </>
      ) : (
        <>
          <AuthFeedback message={verified
            ? "Email đã được xác minh và tài khoản đã được tạo. Đăng nhập để tiếp tục nếu app chưa tự vào."
            : `Nhập mã 6 chữ số đã gửi đến ${email}. Nếu đã gửi lại mã, chỉ dùng mã trong email mới nhất. Mã có hiệu lực 15 phút.`} />
          {!verified && <OtpCodeInput label="Mã xác minh" value={verificationCode} onChangeText={setVerificationCode} editable={!busy} />}
          {!verified && <Pressable accessibilityRole="button" disabled={busy || resendSeconds > 0} onPress={() => void resendCode()} style={({ pressed }) => [localStyles.resendButton, pressed && { opacity: 0.7 }]}>
            <Text style={localStyles.link}>{resendSeconds > 0 ? `Gửi lại mã sau ${resendSeconds}s` : "Gửi lại mã xác minh"}</Text>
          </Pressable>}
        </>
      )}
      <AuthFeedback message={error} error />
      <AuthButton
        title={busy ? "Đang xử lý…" : verified ? "Đăng nhập" : created ? "Xác minh và vào app" : "Tạo tài khoản"}
        onPress={() => verified ? router.replace("/login") : void submit()}
        loading={busy}
        disabled={(!enabled && !created) || (created && !verified && verificationCode.length !== 6)}
      />
      {!created && <View style={localStyles.loginRow}>
          <Text style={localStyles.loginHint}>Đã có tài khoản?</Text>
          <Pressable accessibilityRole="link" disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => router.replace("/login")} style={({ pressed }) => [localStyles.loginLink, pressed && { opacity: 0.7 }]}>
            <Text style={localStyles.link}>Đăng nhập</Text>
          </Pressable>
        </View>}
      {created && !verified && <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setCreated(false); setVerificationCode(""); setError(null); }} style={localStyles.editRegistrationButton}>
        <Text style={localStyles.loginHint}>Đổi thông tin đăng ký</Text>
      </Pressable>}
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
  resendButton: { minHeight: 42, alignItems: "center", justifyContent: "center" },
  editRegistrationButton: { minHeight: 40, alignItems: "center", justifyContent: "center" },
  loginHint: { fontFamily: "Inter-Regular", fontSize: 13, color: "#64748b" },
  loginLink: { minHeight: 44, justifyContent: "center", paddingHorizontal: 6 },
});
