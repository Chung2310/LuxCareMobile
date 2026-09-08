import { useRef, useState } from "react";
import { Alert, Modal, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AccountForm } from "../../src/features/account/AccountForm";
import { getRoleDisplayName } from "../../../src/utils/permissionUtils";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { Button, Card, ErrorText, Page, styles } from "../../src/ui";
import { BranchSelector } from "../../src/features/branches/BranchSelector";
export default function Profile() {
  const [editing, setEditing] = useState<"profile" | "password" | null>(null);
  const formLock = useRef(false);
  const { user, logout } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = () =>
    Alert.alert("Đăng xuất", "Kết thúc phiên làm việc trên thiết bị này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          void logout()
            .catch((error) => setError(messageOf(error)))
            .finally(() => setBusy(false));
        },
      },
    ]);
  return (
    <>
      <Page title="Tài khoản">
        <Card>
          <Text style={styles.heading}>{user?.displayName}</Text>
          <Text style={styles.text}>{user?.email}</Text>
          <Text style={styles.muted}>{getRoleDisplayName(user?.role || "")}</Text>
        </Card>
        <Card>
          <Text style={styles.heading}>Thông tin công việc</Text>
          <Text style={styles.text}>{user?.companyName || "Chưa có thông tin doanh nghiệp"}</Text>
          <Text style={styles.text}>{user?.branchName || "Chưa có thông tin chi nhánh"}</Text>
          <Text style={styles.text}>{user?.department || "Chưa có thông tin phòng ban"}</Text>
          <Text style={styles.muted}>{user?.jobTitle}</Text>
        </Card>
        <BranchSelector />
        <Button title="Sửa tên hiển thị" disabled={busy} onPress={() => setEditing("profile")} />
        <Button title="Đổi mật khẩu" disabled={busy} onPress={() => setEditing("password")} />
        <ErrorText message={error} />
        <Button title={busy ? "Đang đăng xuất…" : "Đăng xuất"} disabled={busy} onPress={submit} />
      </Page>
      <Modal
        visible={editing !== null}
        animationType="slide"
        onRequestClose={() => {
          if (!formLock.current) setEditing(null);
        }}
      >
        <SafeAreaView style={styles.page}>
          {editing && (
            <AccountForm
              mode={editing}
              onClose={() => setEditing(null)}
              setLocked={(value) => {
                formLock.current = value;
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}
