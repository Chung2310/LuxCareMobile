import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { chat } from "../../api/services";

export interface BlockedUserItem {
  blockId: string;
  blockedUser: any;
  reason?: string;
  createdAt: string;
}

export interface BlockedUsersModalProps {
  visible: boolean;
  onClose: () => void;
  onUnblocked?: (unblockedUserId: string) => void;
}

export function BlockedUsersModal({
  visible,
  onClose,
  onUnblocked,
}: BlockedUsersModalProps) {
  const [blockedList, setBlockedList] = useState<BlockedUserItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const loadBlockedUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const list = await chat.getBlockedUsers();
      setBlockedList(Array.isArray(list) ? list : []);
    } catch (err: any) {
      console.warn("Không thể tải danh sách chặn:", err?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void loadBlockedUsers();
    }
  }, [visible, loadBlockedUsers]);

  const handleUnblockPress = (item: BlockedUserItem) => {
    const targetId = String(
      item.blockedUser?._id || item.blockedUser?.uid || item.blockedUser || item.blockId
    );
    const targetName =
      typeof item.blockedUser === "object" && item.blockedUser !== null
        ? item.blockedUser.displayName || item.blockedUser.fullName || item.blockedUser.email || "người dùng này"
        : "người dùng này";

    Alert.alert(
      "Bỏ chặn người dùng",
      `Bạn có chắc chắn muốn bỏ chặn ${targetName}?\n\nSau khi bỏ chặn, hai bên sẽ có thể gửi tin nhắn và thấy hoạt động của nhau.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Bỏ chặn",
          style: "default",
          onPress: async () => {
            try {
              setUnblockingId(targetId);
              await chat.unblockUser(targetId);
              setBlockedList((prev) =>
                prev.filter(
                  (i) =>
                    String(i.blockedUser?._id || i.blockedUser?.uid || i.blockedUser || i.blockId) !== targetId
                )
              );
              onUnblocked?.(targetId);
              Alert.alert("Thành công", `Đã bỏ chặn ${targetName}.`);
            } catch (err: any) {
              Alert.alert("Lỗi", err?.message || "Không thể bỏ chặn người dùng.");
            } finally {
              setUnblockingId(null);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return "";
      return d.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const getReasonLabel = (reason?: string) => {
    switch (reason) {
      case "spam":
        return "Spam / Tin rác";
      case "harassment":
        return "Quấy rối / Đe dọa";
      case "inappropriate":
        return "Nội dung không phù hợp";
      case "fraud":
        return "Lừa đảo / Giả mạo";
      case "other":
        return "Khác";
      default:
        return reason || "Không nêu lý do";
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Đóng danh sách chặn"
          >
            <Ionicons name="close" size={24} color="#0f172a" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Danh sách chặn</Text>
            <Text style={styles.headerSubtitle}>
              {blockedList.length} người dùng đã bị chặn
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Notice Banner */}
        <View style={styles.noticeBanner}>
          <Ionicons name="shield-checkmark-outline" size={18} color="#059669" style={{ marginRight: 8, marginTop: 1 }} />
          <Text style={styles.noticeText}>
            Những người trong danh sách này không thể gửi tin nhắn trực tiếp cho bạn hoặc nhìn thấy tin nhắn trong nhóm chung.
          </Text>
        </View>

        {/* Content */}
        {loading && blockedList.length === 0 ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>Đang tải danh sách chặn...</Text>
          </View>
        ) : blockedList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="shield-checkmark" size={48} color="#10b981" />
            </View>
            <Text style={styles.emptyTitle}>Chưa có ai bị chặn</Text>
            <Text style={styles.emptySubtitle}>
              Khi bạn nhấn giữ tin nhắn của một người dùng và chọn &quot;Chặn&quot;, tài khoản đó sẽ xuất hiện ở đây để bạn quản lý hoặc bỏ chặn khi cần.
            </Text>
          </View>
        ) : (
          <FlatList
            data={blockedList}
            keyExtractor={(item) =>
              String(item.blockedUser?._id || item.blockedUser?.uid || item.blockedUser || item.blockId)
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void loadBlockedUsers(true)}
                colors={["#059669"]}
              />
            }
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const targetId = String(
                item.blockedUser?._id || item.blockedUser?.uid || item.blockedUser || item.blockId
              );
              const targetName =
                typeof item.blockedUser === "object" && item.blockedUser !== null
                  ? item.blockedUser.displayName || item.blockedUser.fullName || item.blockedUser.email || "Người dùng LuxCare"
                  : "Người dùng LuxCare";
              const targetEmail =
                typeof item.blockedUser === "object" && item.blockedUser !== null
                  ? item.blockedUser.email
                  : null;
              const targetAvatar =
                typeof item.blockedUser === "object" && item.blockedUser !== null
                  ? item.blockedUser.photoURL || item.blockedUser.avatarUrl
                  : null;
              const initialLetter = targetName.charAt(0).toUpperCase();
              const isUnblockingThis = unblockingId === targetId;

              return (
                <View style={styles.userCard}>
                  {/* Avatar */}
                  {targetAvatar ? (
                    <Image source={{ uri: targetAvatar }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarInitial}>{initialLetter}</Text>
                    </View>
                  )}

                  {/* Info */}
                  <View style={styles.userInfo}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {targetName}
                    </Text>
                    {!!targetEmail && (
                      <Text style={styles.userEmail} numberOfLines={1}>
                        {targetEmail}
                      </Text>
                    )}
                    <View style={styles.metaRow}>
                      {!!item.reason && (
                        <Text style={styles.reasonBadge}>
                          {getReasonLabel(item.reason)}
                        </Text>
                      )}
                      {!!item.createdAt && (
                        <Text style={styles.dateText}>
                          {formatDate(item.createdAt)}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Unblock Action */}
                  <TouchableOpacity
                    style={[styles.unblockBtn, isUnblockingThis && styles.unblockBtnDisabled]}
                    onPress={() => handleUnblockPress(item)}
                    disabled={isUnblockingThis}
                    activeOpacity={0.7}
                  >
                    {isUnblockingThis ? (
                      <ActivityIndicator size="small" color="#059669" />
                    ) : (
                      <>
                        <Ionicons name="lock-open-outline" size={15} color="#059669" style={{ marginRight: 4 }} />
                        <Text style={styles.unblockBtnText}>Bỏ chặn</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingTop: Platform.OS === "android" ? 28 : 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  noticeBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ecfdf5",
    borderBottomWidth: 1,
    borderBottomColor: "#d1fae5",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: "#065f46",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#64748b",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#ecfdf5",
    borderWidth: 2,
    borderColor: "#a7f3d0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 20,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#e2e8f0",
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  userName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  userEmail: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 6,
  },
  reasonBadge: {
    fontSize: 11,
    color: "#e11d48",
    backgroundColor: "#fff1f2",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: "500",
  },
  dateText: {
    fontSize: 11,
    color: "#94a3b8",
  },
  unblockBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  unblockBtnDisabled: {
    opacity: 0.6,
  },
  unblockBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#059669",
  },
});
