import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../../src/auth/SessionProvider";
import { colors } from "../../src/ui";

interface ConversationItem {
  id: string;
  name: string;
  lastMessage: string;
  time: string;
  unreadCount: number;
  isGroup: boolean;
  online?: boolean;
  avatarColor: string;
}

const DEFAULT_CONVERSATIONS: ConversationItem[] = [
  {
    id: "group-emergency",
    name: "Khoa Cấp Cứu & Trực Viện",
    lastMessage: "BS. Hoàng: Đã bàn giao ca trực sáng cho kíp 2.",
    time: "14:45",
    unreadCount: 3,
    isGroup: true,
    avatarColor: "#e11d48",
  },
  {
    id: "group-pharmacy",
    name: "Kho Dược & Vật Tư Y Tế",
    lastMessage: "Vừa nhập 50 hộp găng tay phẫu thuật và bông gạc.",
    time: "13:20",
    unreadCount: 1,
    isGroup: true,
    avatarColor: "#059669",
  },
  {
    id: "group-hr",
    name: "Phòng Hành Chính - Nhân Sự",
    lastMessage: "Thông báo lịch khám sức khỏe định kỳ cho toàn thể CBNV.",
    time: "11:05",
    unreadCount: 0,
    isGroup: true,
    avatarColor: "#0284c7",
  },
  {
    id: "user-director",
    name: "Giám đốc chuyên môn",
    lastMessage: "Hồ sơ bệnh án trường hợp sáng nay duyệt giúp tôi nhé.",
    time: "09:30",
    unreadCount: 2,
    isGroup: false,
    online: true,
    avatarColor: "#7c3aed",
  },
  {
    id: "user-head-nurse",
    name: "Điều dưỡng trưởng",
    lastMessage: "Dạ vâng, em đã kiểm tra lại lịch trực của các bạn rồi ạ.",
    time: "Hôm qua",
    unreadCount: 0,
    isGroup: false,
    online: false,
    avatarColor: "#0d9488",
  },
  {
    id: "user-tech",
    name: "Kỹ thuật viên Thiết bị y tế",
    lastMessage: "Máy xét nghiệm huyết học đã được bảo dưỡng định kỳ xong.",
    time: "Hôm qua",
    unreadCount: 0,
    isGroup: false,
    online: true,
    avatarColor: "#ea580c",
  },
];

export default function ChatScreen() {
  const { user } = useSession();
  const [conversations, setConversations] = useState<ConversationItem[]>(DEFAULT_CONVERSATIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState<"all" | "personal" | "groups">("all");
  const [refreshing, setRefreshing] = useState(false);

  // Khung chat chi tiết (Modal tương tác)
  const [activeChat, setActiveChat] = useState<ConversationItem | null>(null);
  const [messages, setMessages] = useState<Array<{ id: string; sender: string; text: string; time: string; isMe: boolean }>>([]);
  const [inputText, setInputText] = useState("");

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 600);
  }, []);

  const filteredConversations = useMemo(() => {
    let list = conversations;

    if (selectedTab === "personal") {
      list = list.filter((c) => !c.isGroup);
    } else if (selectedTab === "groups") {
      list = list.filter((c) => c.isGroup);
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase().trim();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.lastMessage.toLowerCase().includes(q),
    );
  }, [conversations, selectedTab, searchQuery]);

  const openConversation = (conv: ConversationItem) => {
    setActiveChat(conv);
    // Đánh dấu đã đọc
    setConversations((prev) =>
      prev.map((c) => (c.id === conv.id ? { ...c, unreadCount: 0 } : c)),
    );
    // Tin nhắn mẫu cho cuộc trò chuyện
    setMessages([
      {
        id: "m1",
        sender: conv.name,
        text: conv.lastMessage,
        time: conv.time,
        isMe: false,
      },
      {
        id: "m2",
        sender: user?.displayName || "Tôi",
        text: "Dạ đã rõ, em đang cập nhật số liệu đây ạ.",
        time: "Vừa xong",
        isMe: true,
      },
    ]);
  };

  const sendMessage = () => {
    if (!inputText.trim()) return;
    const newMsg = {
      id: `msg-${Date.now()}`,
      sender: user?.displayName || "Tôi",
      text: inputText.trim(),
      time: "Vừa xong",
      isMe: true,
    };
    setMessages((prev) => [...prev, newMsg]);

    if (activeChat) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeChat.id
            ? { ...c, lastMessage: `Tôi: ${inputText.trim()}`, time: "Vừa xong" }
            : c,
        ),
      );
    }

    setInputText("");
  };

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Trò chuyện nội bộ</Text>
          <Text style={styles.headerSubtitle}>Trao đổi công việc & ca trực tức thì</Text>
        </View>

        <TouchableOpacity
          style={styles.newChatBtn}
          activeOpacity={0.7}
          onPress={() => {}}
        >
          <Ionicons name="create-outline" size={20} color="#059669" />
        </TouchableOpacity>
      </View>

      {/* Search Input Bar */}
      <View style={styles.searchWrapper}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="#059669" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm đồng nghiệp, nhóm chat..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Category Pills Filter */}
      <View style={styles.pillsContainer}>
        <TouchableOpacity
          style={[styles.pill, selectedTab === "all" && styles.pillActive]}
          onPress={() => setSelectedTab("all")}
          activeOpacity={0.7}
        >
          <Text style={[styles.pillText, selectedTab === "all" && styles.pillTextActive]}>
            Tất cả
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pill, selectedTab === "personal" && styles.pillActive]}
          onPress={() => setSelectedTab("personal")}
          activeOpacity={0.7}
        >
          <Text style={[styles.pillText, selectedTab === "personal" && styles.pillTextActive]}>
            Cá nhân
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.pill, selectedTab === "groups" && styles.pillActive]}
          onPress={() => setSelectedTab("groups")}
          activeOpacity={0.7}
        >
          <Text style={[styles.pillText, selectedTab === "groups" && styles.pillTextActive]}>
            Nhóm phòng ban
          </Text>
        </TouchableOpacity>
      </View>

      {/* Danh sách cuộc trò chuyện */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện nào</Text>
            <Text style={styles.emptySubtitle}>
              Bắt đầu trò chuyện với đồng nghiệp hoặc nhóm khoa phòng
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.convItem}
            onPress={() => openConversation(item)}
            activeOpacity={0.7}
          >
            <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
              {item.isGroup ? (
                <Ionicons name="people" size={20} color="#ffffff" />
              ) : (
                <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
              )}
              {item.online && <View style={styles.onlineDot} />}
            </View>

            <View style={styles.convInfo}>
              <View style={styles.convRow}>
                <Text style={styles.convName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.convTime}>{item.time}</Text>
              </View>

              <View style={styles.convRow}>
                <Text
                  style={[
                    styles.convMessage,
                    item.unreadCount > 0 && styles.convMessageUnread,
                  ]}
                  numberOfLines={1}
                >
                  {item.lastMessage}
                </Text>
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                  </View>
                )}
              </View>
            </View>
          </TouchableOpacity>
        )}
      />

      {/* Modal Khung Chat Trực Tiếp */}
      <Modal
        visible={Boolean(activeChat)}
        animationType="slide"
        onRequestClose={() => setActiveChat(null)}
      >
        <SafeAreaView style={styles.chatModalContainer}>
          {/* Header Phòng Chat */}
          <View style={styles.chatModalHeader}>
            <TouchableOpacity
              onPress={() => setActiveChat(null)}
              style={styles.chatBackBtn}
              activeOpacity={0.7}
            >
              <Ionicons name="arrow-back" size={22} color="#0f172a" />
            </TouchableOpacity>

            <View style={styles.chatModalTitleWrapper}>
              <Text style={styles.chatModalTitle} numberOfLines={1}>
                {activeChat?.name}
              </Text>
              <Text style={styles.chatModalStatus}>
                {activeChat?.isGroup ? "Nhóm làm việc nội bộ" : activeChat?.online ? "Đang trực tuyến" : "Ngoại tuyến"}
              </Text>
            </View>

            <TouchableOpacity style={styles.chatInfoBtn} activeOpacity={0.7}>
              <Ionicons name="ellipsis-vertical" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          {/* Danh Sách Tin Nhắn */}
          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.messageBubbleWrapper,
                  item.isMe ? styles.myBubbleWrapper : styles.theirBubbleWrapper,
                ]}
              >
                {!item.isMe && (
                  <Text style={styles.msgSenderName}>{item.sender}</Text>
                )}
                <View
                  style={[
                    styles.messageBubble,
                    item.isMe ? styles.myBubble : styles.theirBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      item.isMe ? styles.myMessageText : styles.theirMessageText,
                    ]}
                  >
                    {item.text}
                  </Text>
                  <Text
                    style={[
                      styles.messageTime,
                      item.isMe ? styles.myMessageTime : styles.theirMessageTime,
                    ]}
                  >
                    {item.time}
                  </Text>
                </View>
              </View>
            )}
          />

          {/* Ô Soạn Tin Nhắn */}
          <View style={styles.inputArea}>
            <TouchableOpacity style={styles.attachBtn} activeOpacity={0.7}>
              <Ionicons name="attach" size={22} color="#64748b" />
            </TouchableOpacity>

            <TextInput
              style={styles.chatInput}
              placeholder="Nhập tin nhắn..."
              placeholderTextColor="#94a3b8"
              value={inputText}
              onChangeText={setInputText}
              multiline
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                !inputText.trim() && styles.sendBtnDisabled,
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim()}
              activeOpacity={0.8}
            >
              <Ionicons name="send" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  newChatBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    paddingVertical: 0,
  },
  pillsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
  },
  pillActive: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#059669",
  },
  pillText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748b",
  },
  pillTextActive: {
    color: "#059669",
    fontWeight: "700",
  },
  listContent: {
    paddingBottom: 24,
  },
  convItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 13,
    height: 13,
    borderRadius: 6.5,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  convInfo: {
    flex: 1,
    marginLeft: 12,
  },
  convRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  convName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
  },
  convTime: {
    fontSize: 12,
    color: "#94a3b8",
  },
  convMessage: {
    fontSize: 13,
    color: "#64748b",
    flex: 1,
    marginRight: 8,
  },
  convMessageUnread: {
    color: "#0f172a",
    fontWeight: "600",
  },
  unreadBadge: {
    backgroundColor: "#059669",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  unreadText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 20,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#334155",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 18,
  },
  // Modal Phòng Chat
  chatModalContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  chatModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  chatBackBtn: {
    padding: 6,
    marginRight: 8,
  },
  chatModalTitleWrapper: {
    flex: 1,
  },
  chatModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
  },
  chatModalStatus: {
    fontSize: 12,
    color: "#059669",
    marginTop: 1,
  },
  chatInfoBtn: {
    padding: 6,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  messageBubbleWrapper: {
    maxWidth: "80%",
  },
  myBubbleWrapper: {
    alignSelf: "flex-end",
  },
  theirBubbleWrapper: {
    alignSelf: "flex-start",
  },
  msgSenderName: {
    fontSize: 11,
    color: "#64748b",
    marginBottom: 3,
    marginLeft: 4,
  },
  messageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  myBubble: {
    backgroundColor: "#059669",
    borderBottomRightRadius: 4,
  },
  theirBubble: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  myMessageText: {
    color: "#ffffff",
  },
  theirMessageText: {
    color: "#0f172a",
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  myMessageTime: {
    color: "rgba(255, 255, 255, 0.75)",
  },
  theirMessageTime: {
    color: "#94a3b8",
  },
  inputArea: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    gap: 8,
  },
  attachBtn: {
    padding: 6,
  },
  chatInput: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 14,
    color: "#0f172a",
    maxHeight: 100,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: "#cbd5e1",
  },
});
