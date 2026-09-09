import { useCallback, useRef, useState } from "react";
import { Alert, FlatList, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { GetNotificationsResponse, WebNotification } from "../../../src/services/notificationService";
import { notifications } from "../../src/api/services";
import { messageOf, useSession } from "../../src/auth/SessionProvider";
import { notificationTarget } from "../../src/features/navigation/notificationTarget";
import { ChoiceField } from "../../src/features/leave/ChoiceField";
import { Button, Card, EmptyState, ErrorText, Loading, styles } from "../../src/ui";
export default function Notifications() {
  const { user } = useSession();
  const lock = useRef(false);
  const [type, setType] = useState<"" | "task" | "training" | "he-thong">("");
  const [data, setData] = useState<GetNotificationsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [unread, setUnread] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      setData(null);
      void notifications
        .getNotifications({ page, limit: 20, ...(unread ? { read: false } : {}), ...(type ? { type } : {}) })
        .then((value) => {
          if (active) setData(value);
        })
        .catch((error) => {
          if (active) setError(messageOf(error));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, [page, unread, type, revision, user?.uid]),
  );
  const mutate = async (action: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await action();
      setPage(1);
      setRevision((v) => v + 1);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const open = async (item: WebNotification) => {
    const destination = notificationTarget(item, user);
    if (!destination.target) {
      setError(destination.reason);
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!item.read) await notifications.markAsRead(item._id);
      router.push(destination.target.href);
    } catch (error) {
      setError(messageOf(error));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <FlatList
      style={styles.page}
      contentContainerStyle={styles.content}
      data={data?.data || []}
      keyExtractor={(item) => item._id}
      refreshing={loading}
      onRefresh={() => setRevision((v) => v + 1)}
      ListHeaderComponent={
        <View style={{ gap: 14 }}>
          <Text style={styles.title}>Thông báo</Text>
          <ChoiceField
            label="Loại thông báo"
            value={type}
            choices={[
              { value: "", label: "Tất cả" },
              { value: "task", label: "Công việc" },
              { value: "training", label: "Đào tạo" },
              { value: "he-thong", label: "Hệ thống" },
            ]}
            disabled={busy}
            onChange={(value) => {
              setType(value as typeof type);
              setPage(1);
            }}
          />
          <Text style={styles.muted}>{data ? `${data.unreadCount} chưa đọc` : ""}</Text>
          <Button
            title={unread ? "Hiển thị tất cả" : "Chỉ xem chưa đọc"}
            disabled={busy}
            onPress={() => {
              setUnread((v) => !v);
              setPage(1);
            }}
          />
          <Button
            title="Đánh dấu tất cả đã đọc"
            disabled={busy || !data?.unreadCount}
            onPress={() => void mutate(() => notifications.markAllAsRead())}
          />
          <ErrorText message={error} />
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <Loading />
        ) : !error ? (
          <EmptyState message="Không có thông báo" subtitle="Hiện tại không có thông báo nào." />
        ) : (
          <Button title="Thử lại" onPress={() => setRevision((v) => v + 1)} />
        )
      }
      renderItem={({ item }) => (
        <Card>
          <Text style={styles.heading}>
            {!item.read ? "● " : ""}
            {item.title}
          </Text>
          <Text style={styles.text}>{item.body}</Text>
          <Text style={styles.muted}>{new Date(item.createdAt).toLocaleString("vi-VN")}</Text>
          {item.action &&
            (notificationTarget(item, user).target ? (
              <Button
                title={notificationTarget(item, user).target!.label}
                disabled={busy}
                onPress={() => void open(item)}
              />
            ) : (
              <Text style={styles.muted}>{notificationTarget(item, user).reason}</Text>
            ))}
          {!item.read && (
            <Button
              title="Đánh dấu đã đọc"
              disabled={busy}
              onPress={() => void mutate(() => notifications.markAsRead(item._id))}
            />
          )}
          <Button
            title="Xóa"
            disabled={busy}
            onPress={() =>
              Alert.alert("Xóa thông báo?", item.title, [
                { text: "Hủy", style: "cancel" },
                {
                  text: "Xóa",
                  style: "destructive",
                  onPress: () => void mutate(() => notifications.deleteNotification(item._id)),
                },
              ])
            }
          />
        </Card>
      )}
      ListFooterComponent={
        <View style={styles.row}>
          <Button title="Trang trước" disabled={page === 1 || loading || busy} onPress={() => setPage((v) => v - 1)} />
          <Text style={styles.muted}>{page}</Text>
          <Button
            title="Trang sau"
            disabled={!data || page * data.limit >= data.total || loading || busy}
            onPress={() => setPage((v) => v + 1)}
          />
        </View>
      }
    />
  );
}
