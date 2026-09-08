import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Text } from "react-native";
import { account } from "../../api/services";
import { messageOf, useSession } from "../../auth/SessionProvider";
import { Button, ErrorText, Field, Page, styles } from "../../ui";
import { confirmedPassword, profileName } from "./validation";
export function AccountForm({
  mode,
  onClose,
  setLocked,
}: {
  mode: "profile" | "password";
  onClose: () => void;
  setLocked: (value: boolean) => void;
}) {
  const { user, updateDisplayName } = useSession();
  const [name, setName] = useState(user?.displayName || "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const submit = async () => {
    if (lock.current || !user) return;
    lock.current = true;
    setBusy(true);
    setLocked(true);
    setError(null);
    try {
      if (mode === "profile") {
        const displayName = profileName(name);
        const result = await account.updateProfile({ displayName });
        if (result.uid !== user.uid) throw new Error("Hồ sơ trả về không khớp tài khoản hiện tại.");
        updateDisplayName(user.uid, result.displayName);
      } else {
        const next = confirmedPassword(password, confirmation);
        try {
          await account.changePassword(next);
        } catch (error) {
          if (!(error && typeof error === "object" && "status" in error) || Number(error.status) >= 500) {
            setUncertain(true);
            setPassword("");
            setConfirmation("");
            throw new Error(
              "Chưa xác nhận được kết quả đổi mật khẩu. Đóng màn hình và kiểm tra đăng nhập trước khi đổi lại.",
            );
          }
          throw error;
        }
        setPassword("");
        setConfirmation("");
      }
      setSuccess(true);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
      setLocked(false);
    }
  };
  const disabled = busy || success || uncertain;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Page title={mode === "profile" ? "Cập nhật hồ sơ" : "Đổi mật khẩu"}>
        <Text style={styles.muted}>{user?.email}</Text>
        {mode === "profile" ? (
          <Field label="Họ và tên" value={name} editable={!disabled} onChangeText={setName} />
        ) : (
          <>
            <Field
              label="Mật khẩu mới (ít nhất 6 ký tự)"
              value={password}
              editable={!disabled}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
            />
            <Field
              label="Nhập lại mật khẩu mới"
              value={confirmation}
              editable={!disabled}
              onChangeText={setConfirmation}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
            />
          </>
        )}
        {success && (
          <Text style={styles.text}>{mode === "profile" ? "Đã cập nhật hồ sơ." : "Đã đổi mật khẩu thành công."}</Text>
        )}
        <ErrorText message={error} />
        <Button title={busy ? "Đang lưu…" : "Lưu thay đổi"} disabled={disabled} onPress={() => void submit()} />
        <Button title="Đóng" disabled={busy} onPress={onClose} />
      </Page>
    </KeyboardAvoidingView>
  );
}
