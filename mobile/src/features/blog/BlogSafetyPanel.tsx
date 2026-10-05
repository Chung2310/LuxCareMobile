import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { blogModeration as api } from "../../api/services";
import { messageOf } from "../../auth/SessionProvider";
import { BLOG_REPORT_REASONS, type BlogBlockedAuthor, type BlogReportReason } from "../../../../shared/blog-moderation";
export function BlogSafetyPanel({
  mode,
  post,
  onClose,
  onBlocked,
  onUnblocked,
}: {
  mode: "report" | "block" | "blocks";
  post?: { id: string; authorName: string };
  onClose: () => void;
  onBlocked: (authorId: string) => void;
  onUnblocked: (authorId: string) => void;
}) {
  const [reason, setReason] = useState<BlogReportReason>("inappropriate");
  const [details, setDetails] = useState("");
  const [rows, setRows] = useState<BlogBlockedAuthor[]>([]);
  const [busy, setBusy] = useState(mode === "blocks");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (mode !== "blocks") return;
    let alive = true;
    api
      .blocks()
      .then((items) => {
        if (alive) setRows(items);
      })
      .catch((failure) => {
        if (alive) setError(messageOf(failure));
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [mode]);
  async function run(task: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await task();
    } catch (failure) {
      setError(messageOf(failure));
    } finally {
      setBusy(false);
    }
  }
  const close = () => {
    if (!busy) onClose();
  };
  const title = mode === "blocks" ? "Người đã chặn" : mode === "block" ? "Chặn tác giả" : "Báo cáo bài viết";
  return (
    <Modal visible animationType="slide" onRequestClose={close}>
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Đóng"
            disabled={busy}
            onPress={close}
            style={styles.close}
          >
            <Ionicons name="close" size={24} color="#334155" />
          </Pressable>
        </View>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
            {mode === "blocks" ? (
              <>
                {busy && <ActivityIndicator color="#047857" />}
                {!busy && !rows.length && !error && <Text style={styles.text}>Chưa chặn người dùng nào.</Text>}
                {rows.map((row) => (
                  <View key={row.authorId} style={styles.row}>
                    <Text style={[styles.text, { flex: 1 }]}>{row.authorName}</Text>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      style={styles.close}
                      onPress={() =>
                        void run(async () => {
                          await api.unblock(row.authorId);
                          setRows((items) => items.filter((item) => item.authorId !== row.authorId));
                          onUnblocked(row.authorId);
                        })
                      }
                    >
                      <Text style={styles.link}>Bỏ chặn</Text>
                    </Pressable>
                  </View>
                ))}
              </>
            ) : sent ? (
              <Text accessibilityRole="alert" style={styles.text}>
                Đã gửi báo cáo. Quản trị viên sẽ kiểm tra nội dung này.
              </Text>
            ) : (
              <>
                <Text style={styles.text}>
                  {mode === "block"
                    ? `Ẩn tất cả bài viết của ${post?.authorName}. Chặn cũng áp dụng trong chat. Bạn có thể bỏ chặn sau.`
                    : `Báo cáo bài viết của ${post?.authorName}.`}
                </Text>
                {mode === "report" && (
                  <>
                    <Text style={styles.label}>Lý do</Text>
                    {Object.entries(BLOG_REPORT_REASONS).map(([key, label]) => (
                      <Pressable
                        key={key}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: reason === key, disabled: busy }}
                        disabled={busy}
                        onPress={() => setReason(key as BlogReportReason)}
                        style={[styles.reason, reason === key && styles.selected]}
                      >
                        <Ionicons
                          name={reason === key ? "radio-button-on" : "radio-button-off"}
                          size={20}
                          color="#047857"
                        />
                        <Text style={styles.text}>{label}</Text>
                      </Pressable>
                    ))}
                    <Text style={styles.label}>Chi tiết (không bắt buộc)</Text>
                    <TextInput
                      accessibilityLabel="Chi tiết báo cáo"
                      value={details}
                      onChangeText={setDetails}
                      editable={!busy}
                      multiline
                      maxLength={2000}
                      placeholder="Mô tả vấn đề cần xem xét"
                      placeholderTextColor="#64748b"
                      style={styles.input}
                    />
                  </>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy, busy }}
                  disabled={busy || !post}
                  style={[styles.action, mode === "block" && { backgroundColor: "#be123c" }, busy && { opacity: 0.5 }]}
                  onPress={() =>
                    void run(async () => {
                      if (!post) return;
                      if (mode === "block") {
                        const result = await api.blockAuthor(post.id);
                        onBlocked(result.authorId);
                        onClose();
                      } else {
                        await api.report(post.id, reason, details);
                        setSent(true);
                      }
                    })
                  }
                >
                  <Text style={styles.actionText}>
                    {busy ? "Đang xử lý…" : mode === "block" ? "Xác nhận chặn" : "Gửi báo cáo"}
                  </Text>
                </Pressable>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#ffffff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  title: { fontFamily: "Inter-SemiBold", fontSize: 20, color: "#0f172a" },
  close: { minHeight: 48, minWidth: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  content: { padding: 20, gap: 14 },
  text: { fontFamily: "Inter-Regular", fontSize: 14, lineHeight: 22, color: "#334155" },
  label: { fontFamily: "Inter-SemiBold", fontSize: 14, color: "#0f172a" },
  row: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: "#e2e8f0", gap: 10 },
  link: { fontFamily: "Inter-SemiBold", color: "#047857" },
  error: { color: "#be123c", fontSize: 14 },
  reason: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 12,
  },
  selected: { backgroundColor: "#ecfdf5", borderColor: "#059669" },
  input: {
    minHeight: 110,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    padding: 12,
    color: "#0f172a",
    fontSize: 14,
  },
  action: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#047857",
    borderRadius: 12,
  },
  actionText: { fontFamily: "Inter-SemiBold", color: "#ffffff", fontSize: 15 },
});
