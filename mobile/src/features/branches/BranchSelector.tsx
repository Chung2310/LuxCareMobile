import { useRef, useState } from "react";
import { Modal, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { BranchRecord } from "../../../../src/services/branchService";
import { branches } from "../../api/services";
import { useSession, messageOf } from "../../auth/SessionProvider";
import { hasPermission } from "../../auth/access";
import { Button, Card, ErrorText, Loading, Page, styles } from "../../ui";
export function BranchSelector() {
  const { user, selectedBranch, selectBranch } = useSession();
  const [visible, setVisible] = useState(false);
  const [items, setItems] = useState<BranchRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const revision = useRef(0);
  if (user?.role !== "admin" || (!hasPermission(user, "user:read") && !hasPermission(user, "hr:read"))) return null;
  const load = async () => {
    const request = ++revision.current;
    setVisible(true);
    setLoading(true);
    setError(null);
    try {
      const data = await branches.list();
      if (request === revision.current) setItems(data.filter((item) => item.isActive));
    } catch (error) {
      if (request === revision.current) setError(messageOf(error));
    } finally {
      if (request === revision.current) setLoading(false);
    }
  };
  const choose = (branch: BranchRecord | null) => {
    try {
      selectBranch(branch);
      setVisible(false);
      revision.current++;
    } catch (error) {
      setError(messageOf(error));
    }
  };
  return (
    <>
      <Card>
        <Text style={styles.heading}>Chi nhánh làm việc</Text>
        <Text style={styles.text}>{selectedBranch?.name || user.branchName || "Chi nhánh mặc định của tài khoản"}</Text>
        <Button title="Chọn chi nhánh" onPress={() => void load()} />
      </Card>
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={() => {
          setVisible(false);
          revision.current++;
        }}
      >
        <SafeAreaView style={styles.page}>
          <Page title="Chọn chi nhánh">
            <Button title="Dùng chi nhánh mặc định" onPress={() => choose(null)} />
            <ErrorText message={error} />
            {loading && <Loading />}
            {!loading &&
              items.map((item) => (
                <Card key={item._id}>
                  <Text style={styles.heading}>{item.name}</Text>
                  <Text style={styles.muted}>
                    {item.code} · {item.address}
                  </Text>
                  <Button
                    title={selectedBranch?._id === item._id ? "Đang chọn" : "Chọn"}
                    disabled={selectedBranch?._id === item._id}
                    onPress={() => choose(item)}
                  />
                </Card>
              ))}
            {error && <Button title="Tải lại" onPress={() => void load()} />}
            <Button
              title="Đóng"
              onPress={() => {
                setVisible(false);
                revision.current++;
              }}
            />
          </Page>
        </SafeAreaView>
      </Modal>
    </>
  );
}
