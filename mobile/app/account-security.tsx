import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useSession, messageOf } from "../src/auth/SessionProvider";
import { DeleteAccountConfirmModal } from "../src/components/common/DeleteAccountConfirmModal";
import { AuthLayout, AuthFeedback, authStyles } from "../src/features/auth/AuthForm";

export default function AccountSecurity() {
  const { user, deleteAccount, logout } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return <Redirect href="/login" />;
  async function remove(password: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      setConfirming(false);
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthLayout
      title="Quản lý tài khoản"
      icon="person-outline"
      headerAction={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại"
          disabled={busy}
          onPress={() => router.replace("/onboarding")}
          style={{ padding: 10, minHeight: 44 }}
        >
          <Ionicons name="arrow-back" size={23} color="#047857" />
        </Pressable>
      }
    >
      <Text style={authStyles.email}>{user.email}</Text>
      <Text style={authStyles.description}>
        Bạn có thể xóa tài khoản ngay cả khi chưa xác minh email. Mật khẩu và bước xác nhận giúp tránh thao tác nhầm.
      </Text>
      <AuthFeedback message={!confirming ? error : null} error />
      <View style={{ gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => {
            setError(null);
            setConfirming(true);
          }}
          style={{
            minHeight: 48,
            justifyContent: "center",
            paddingHorizontal: 14,
            borderRadius: 12,
            backgroundColor: "#fff1f2",
          }}
        >
          <Text style={{ color: "#be123c", fontFamily: "Inter-SemiBold" }}>Xóa tài khoản</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await logout();
            } catch (failure) {
              setError(messageOf(failure));
            } finally {
              setBusy(false);
            }
          }}
          style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}
        >
          <Text style={authStyles.secondaryText}>Đăng xuất</Text>
        </Pressable>
      </View>
      <DeleteAccountConfirmModal
        visible={confirming}
        busy={busy}
        errorMessage={error}
        user={{ displayName: user.displayName, email: user.email, photoURL: user.photoURL, role: user.role }}
        onClose={() => {
          if (!busy) {
            setConfirming(false);
            setError(null);
          }
        }}
        onConfirm={remove}
      />
    </AuthLayout>
  );
}
