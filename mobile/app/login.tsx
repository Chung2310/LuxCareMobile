import { useState } from "react";
import { KeyboardAvoidingView, Platform, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Redirect } from "expo-router";
import { messageOf, useSession } from "../src/auth/SessionProvider";
import { Button, Card, ErrorText, Field, Page, styles } from "../src/ui";
export default function Login() {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (session.user) return <Redirect href="/(tabs)" />;
  const submit = async () => {
    if (busy || !email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await session.login(email, password);
      setPassword("");
    } catch (error) {
      setError(messageOf(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Page title="LuxCare">
          <Text style={styles.muted}>Không gian làm việc của bạn</Text>
          <Card>
            <Text style={styles.heading}>Đăng nhập</Text>
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              editable={!busy}
            />
            <Field
              label="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              editable={!busy}
              onSubmitEditing={() => void submit()}
            />
            <ErrorText message={error} />
            <Button
              title={busy ? "Đang đăng nhập…" : "Đăng nhập"}
              onPress={() => void submit()}
              disabled={busy || !email.trim() || !password}
            />
          </Card>
        </Page>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
