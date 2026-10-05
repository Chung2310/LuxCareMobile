import { useCallback, useState } from "react";
import { Alert, Text } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession, messageOf } from "../src/auth/SessionProvider";
import { onboarding, branches as branchApi } from "../src/api/services";
import { Page, Field, Button, ErrorText, Card, styles } from "../src/ui";
import type { CompanyInvitation } from "../../shared/onboarding";
export default function CompanyInvitations() {
  const { user } = useSession();
  const [email, setEmail] = useState("");
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Array<{ _id: string; name: string }>>([]);
  const [items, setItems] = useState<CompanyInvitation[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([onboarding.invitations(), branchApi.list()])
        .then(([rows, branchRows]) => {
          if (active) {
            setItems(rows);
            setBranches(branchRows.filter((v) => v.isActive));
            setBranchId(branchRows.find((v) => v.isActive)?._id || "");
          }
        })
        .catch((e) => {
          if (active) setError(messageOf(e));
        });
      return () => {
        active = false;
      };
    }, [user?.uid, user?.companyCode]),
  );
  if (!user) return <Redirect href="/login" />;
  if (user.role !== "admin")
    return (
      <Page title="Lời mời">
        <ErrorText message="Bạn không có quyền quản lý lời mời." />
      </Page>
    );
  async function act(task: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage("");
    try {
      await task();
      setItems(await onboarding.invitations());
      setMessage("Đã cập nhật.");
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <Page title="Mời nhân viên">
        <Text style={styles.text}>Người nhận xác minh email và tự xác nhận để tham gia với vai trò nhân viên.</Text>
        <ErrorText message={error} />
        {message ? <Text style={styles.text}>{message}</Text> : null}
        <Card>
          <Field
            label="Email người nhận"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            maxLength={254}
          />
          <Text style={styles.text}>Chọn chi nhánh:</Text>
          {branches.map((v) => (
            <Button
              key={v._id}
              title={(branchId === v._id ? "✓ " : "") + v.name}
              onPress={() => setBranchId(v._id)}
              disabled={busy}
            />
          ))}
          <Button
            title="Gửi lời mời"
            disabled={busy || !email.trim() || !branchId}
            onPress={() =>
              void act(async () => {
                await onboarding.invite(email.trim().toLowerCase(), branchId);
                setEmail("");
              })
            }
          />
        </Card>
        {items.map((v) => (
          <Card key={v._id}>
            <Text style={styles.text}>{v.email}</Text>
            <Text style={styles.text}>
              {
                {
                  pending: "Chờ xác nhận",
                  accepted: "Đã tham gia",
                  declined: "Đã từ chối",
                  revoked: "Đã thu hồi",
                  expired: "Hết hạn",
                }[v.status]
              }{" "}
              · {new Date(v.expiresAt).toLocaleString("vi-VN")}
            </Text>
            {v.status === "pending" && (
              <Button
                title="Thu hồi"
                disabled={busy}
                onPress={() =>
                  Alert.alert("Thu hồi lời mời?", v.email, [
                    { text: "Hủy", style: "cancel" },
                    { text: "Thu hồi", onPress: () => void act(() => onboarding.revoke(v._id)) },
                  ])
                }
              />
            )}
            {v.status === "pending" && (
              <Button
                title="Gửi lại email"
                disabled={busy}
                onPress={() => void act(() => onboarding.resendInvitation(v._id))}
              />
            )}
            {["expired", "declined", "revoked"].includes(v.status) && (
              <Button
                title="Mời lại"
                disabled={busy}
                onPress={() => void act(() => onboarding.invite(v.email, v.branchId))}
              />
            )}
          </Card>
        ))}
      </Page>
    </SafeAreaView>
  );
}
