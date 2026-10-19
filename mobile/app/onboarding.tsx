import { useCallback, useState } from "react";
import { Alert, Text } from "react-native";
import { Redirect, router, useFocusEffect } from "expo-router";
import { useSession, messageOf } from "../src/auth/SessionProvider";
import { onboarding } from "../src/api/services";
import { Page, Field, Button, ErrorText, Card, styles } from "../src/ui";
import { needsOnboarding, type OnboardingState } from "../../shared/onboarding";

export default function Onboarding() {
  const { user, refreshProfile, logout } = useSession();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [resendAt, setResendAt] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const load = async () => {
        try {
          const value = await onboarding.state();
          if (alive) setState(value);
        } catch (e) {
          if (alive) setError(messageOf(e));
        }
      };
      void load();
      const timer = setInterval(() => void load(), 30000);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [user?.uid]),
  );
  if (!user) return <Redirect href="/login" />;
  const organizationRequired = needsOnboarding(user);
  async function act(task: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await task();
      setState(await onboarding.state());
      await refreshProfile();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page title="Tài khoản & lời mời">
      <Text style={styles.text}>{user.email}</Text>
      <ErrorText message={error} />
      {organizationRequired && (
        <Card>
          <Text style={styles.title}>Tham gia tổ chức để sử dụng LuxCare</Text>
          <Text style={styles.text}>
            LuxCare dành cho nhân viên và thành viên của các tổ chức. Liên hệ quản trị viên công ty để nhận lời mời vào
            email của bạn.
          </Text>
          {user.role === "trial_user" && (
            <Text style={styles.text}>
              Quyền dùng workspace cá nhân đã kết thúc. Dữ liệu cũ được giữ lại và không tự chuyển vào tổ chức bạn tham
              gia. Bạn vẫn có thể quản lý hoặc yêu cầu xóa tài khoản.
            </Text>
          )}
        </Card>
      )}
      {!state ? (
        <Button title="Tải lại" disabled={busy} onPress={() => void act(async () => {})} />
      ) : (
        <>
          {!state.emailVerified && organizationRequired && (
            <Card>
              <Text style={styles.title}>Xác minh email</Text>
              <Field
                label="Mã xác minh"
                value={code}
                onChangeText={(value) => setCode(value.replace(/\D/g, ""))}
                keyboardType="number-pad"
                maxLength={6}
                autoComplete="one-time-code"
              />
              <Button
                title="Xác minh"
                disabled={busy || code.length !== 6}
                onPress={() => void act(() => onboarding.verifyEmail(code))}
              />
              <Button
                title="Gửi lại mã"
                disabled={busy}
                onPress={() => {
                  if (Date.now() < resendAt) {
                    setError("Vui lòng chờ 60 giây trước khi gửi lại mã.");
                    return;
                  }
                  void act(async () => {
                    await onboarding.resendCode();
                    setResendAt(Date.now() + 60000);
                  });
                }}
              />
            </Card>
          )}
          {state.emailVerified && organizationRequired && (
            <Card>
              <Text style={styles.title}>Lời mời vào tổ chức</Text>
              {!state.invitations.length && <Text style={styles.text}>Chưa có lời mời còn hiệu lực.</Text>}
              {state.invitations.map((invite) => (
                <Card key={invite._id}>
                  <Text style={styles.title}>{invite.companyName}</Text>
                  <Text style={styles.text}>Hết hạn: {new Date(invite.expiresAt).toLocaleString("vi-VN")}</Text>
                  <Button
                    title="Xác nhận tham gia"
                    disabled={busy}
                    onPress={() =>
                      Alert.alert(
                        "Tham gia tổ chức?",
                        "Tham gia " + invite.companyName + "? Dữ liệu cá nhân cũ không tự chuyển vào tổ chức.",
                        [
                          { text: "Hủy", style: "cancel" },
                          {
                            text: "Xác nhận",
                            onPress: () =>
                              void act(async () => {
                                await onboarding.answerInvite(invite._id, true);
                              }),
                          },
                        ],
                      )
                    }
                  />
                  <Button
                    title="Từ chối"
                    disabled={busy}
                    onPress={() => void act(() => onboarding.answerInvite(invite._id, false))}
                  />
                </Card>
              ))}
            </Card>
          )}
          {state.deletionRequest && (
            <Card>
              <Text style={styles.title}>Yêu cầu xóa tài khoản</Text>
              <Text style={styles.text}>
                Hạn xử lý: {new Date(state.deletionRequest.dueAt).toLocaleDateString("vi-VN")}.
              </Text>
              <Button
                title="Hủy yêu cầu xóa"
                disabled={busy}
                onPress={() => void act(() => onboarding.cancelDeletion())}
              />
            </Card>
          )}
        </>
      )}
      {!organizationRequired && (
        <Button title="Vào doanh nghiệp" disabled={busy} onPress={() => router.replace("/(tabs)")} />
      )}
      <Button title="Quản lý & xóa tài khoản" disabled={busy} onPress={() => router.push("/account-security")} />
      <Button title="Đăng xuất" disabled={busy} onPress={() => void logout()} />
    </Page>
  );
}
