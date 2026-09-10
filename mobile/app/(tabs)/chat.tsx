import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useSession } from "../../src/auth/SessionProvider";
import { chat } from "../../src/api/services";
import { userManagementApi } from "../../src/api/userManagementApi";
import type {
  ChatAttachment,
  ChatMessage,
  ChatRoom,
  ChatRoomMember,
} from "../../../src/services/chatService";
import type { UserProfile } from "../../../src/types/common";

const BLUE_PRIMARY = "#0088ff";
const BLUE_HEADER = "#0084ff";

export default function ChatScreen() {
  const { user } = useSession();
  const currentUserId = (user as any)?._id || user?.uid || "";

  // Chat Rooms State
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"priority" | "other">("priority");
  const [searchQuery, setSearchQuery] = useState("");

  // Active Chat Room State
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);

  // New Chat / Create Group Modal State
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");

  // Room Info / Manage Modal
  const [roomInfoModalVisible, setRoomInfoModalVisible] = useState(false);

  // Selected Message Actions Modal
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [messageActionModalVisible, setMessageActionModalVisible] = useState(false);

  // Search in conversation state
  const [showSearchInChat, setShowSearchInChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");

  const flatListRef = useRef<FlatList>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Fetch Rooms from API
  const loadRooms = useCallback(async (silent = false) => {
    if (!silent) setLoadingRooms(true);
    try {
      const data = await chat.getRooms();
      setRooms(data);
    } catch (err: any) {
      console.warn("Lỗi tải danh sách phòng chat:", err?.message);
    } finally {
      setLoadingRooms(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadRooms(true);
  }, [loadRooms]);

  // 2. Load Messages for Active Room
  const loadMessages = useCallback(async (roomId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const data = await chat.getMessages(roomId, 60);
      setMessages(data);
      // Đánh dấu đã đọc
      void chat.markAsRead(roomId);
    } catch (err: any) {
      console.warn("Lỗi tải tin nhắn:", err?.message);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Polling for real-time messages when a room is active
  useEffect(() => {
    if (activeRoom?._id) {
      void loadMessages(activeRoom._id);
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => {
        void loadMessages(activeRoom._id, true);
      }, 3500);
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [activeRoom?._id, loadMessages]);

  // 3. Open Conversation
  const handleOpenRoom = (room: ChatRoom) => {
    setActiveRoom(room);
    setChatSearchQuery("");
    setShowSearchInChat(false);
  };

  const handleCloseRoom = () => {
    setActiveRoom(null);
    void loadRooms(true);
  };

  // 4. Send Message
  const handleSendMessage = async (attachments?: ChatAttachment[]) => {
    if (!activeRoom?._id) return;
    const textToSend = inputText.trim();
    if (!textToSend && (!attachments || attachments.length === 0)) return;

    setSending(true);
    try {
      const sentMsg = await chat.sendMessage(activeRoom._id, textToSend, attachments);
      setMessages((prev) => [...prev, sentMsg]);
      setInputText("");
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      void loadRooms(true);
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không thể gửi tin nhắn.");
    } finally {
      setSending(false);
    }
  };

  // 5. Send Image Attachment
  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]?.uri) {
        const asset = result.assets[0];
        const fileName = asset.fileName || `IMG_${Date.now()}.jpg`;
        const att: ChatAttachment = {
          url: asset.uri,
          name: fileName,
          type: "image/jpeg",
          size: asset.fileSize || 0,
        };
        await handleSendMessage([att]);
      }
    } catch (err: any) {
      Alert.alert("Lỗi", "Không thể chọn hình ảnh.");
    }
  };

  // 6. Send File Attachment
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        const att: ChatAttachment = {
          url: file.uri,
          name: file.name,
          type: file.mimeType || "application/octet-stream",
          size: file.size || 0,
        };
        await handleSendMessage([att]);
      }
    } catch (err: any) {
      Alert.alert("Lỗi", "Không thể chọn tệp đính kèm.");
    }
  };

  // 7. Toggle Pin Room
  const handleTogglePin = async (roomId: string) => {
    try {
      await chat.togglePinRoom(roomId);
      void loadRooms(true);
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không thể thay đổi ghim.");
    }
  };

  // 8. Delete / Revoke Message
  const handleDeleteMessage = async (msg: ChatMessage) => {
    if (!activeRoom?._id) return;
    try {
      await chat.deleteMessage(activeRoom._id, msg._id);
      setMessages((prev) =>
        prev.map((m) => (m._id === msg._id ? { ...m, isDeleted: true, content: "Tin nhắn đã được thu hồi" } : m)),
      );
      setMessageActionModalVisible(false);
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không thể thu hồi tin nhắn.");
    }
  };

  // 9. React to Message
  const handleReactMessage = async (msg: ChatMessage, emoji: string) => {
    if (!activeRoom?._id) return;
    try {
      const updated = await chat.reactToMessage(activeRoom._id, msg._id, emoji);
      setMessages((prev) => prev.map((m) => (m._id === msg._id ? updated : m)));
      setMessageActionModalVisible(false);
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không thể thả cảm xúc.");
    }
  };

  // 10. Pin / Unpin Message in Room
  const handlePinMessage = async (msg: ChatMessage) => {
    if (!activeRoom?._id) return;
    try {
      const updatedRoom = await chat.pinMessage(activeRoom._id, msg._id);
      setActiveRoom(updatedRoom);
      setMessageActionModalVisible(false);
      Alert.alert("Thành công", "Đã ghim tin nhắn lên đầu cuộc trò chuyện.");
    } catch (err: any) {
      Alert.alert("Lỗi", err?.message || "Không thể ghim tin nhắn.");
    }
  };

  // 11. Load Users for Creating New Chat
  const handleOpenCreateModal = async () => {
    setCreateModalVisible(true);
    setSelectedUserIds([]);
    setGroupName("");
    setUserSearchQuery("");
    setLoadingUsers(true);
    try {
      const list = await userManagementApi.getUsers();
      // Filter out self
      setUsersList(list.filter((u) => u.uid !== currentUserId));
    } catch (err: any) {
      console.warn("Lỗi tải danh sách người dùng:", err?.message);
    } finally {
      setLoadingUsers(false);
    }
  };

  // 12. Create New Room
  const handleCreateRoom = async () => {
    if (selectedUserIds.length === 0) {
      Alert.alert("Thông báo", "Vui lòng chọn ít nhất một người để bắt đầu cuộc trò chuyện.");
      return;
    }

    const isGroup = selectedUserIds.length > 1;
    if (isGroup && !groupName.trim()) {
      Alert.alert("Thông báo", "Vui lòng nhập tên nhóm chat.");
      return;
    }

    setCreatingRoom(true);
    try {
      const newRoom = await chat.createRoom({
        isGroup,
        memberIds: selectedUserIds,
        name: isGroup ? groupName.trim() : undefined,
      });
      setCreateModalVisible(false);
      void loadRooms(true);
      setActiveRoom(newRoom);
    } catch (err: any) {
      Alert.alert("Lỗi tạo phòng", err?.message || "Không thể tạo cuộc trò chuyện mới.");
    } finally {
      setCreatingRoom(false);
    }
  };

  // 13. Helpers for Room Display
  const getRoomDisplayName = (room: ChatRoom) => {
    if (room.name) return room.name;
    if (!room.isGroup) {
      const otherMember = room.members.find((m) => {
        const uId = typeof m.userId === "object" ? m.userId?._id || m.userId?.uid : m.userId;
        return uId !== currentUserId;
      });
      if (otherMember && typeof otherMember.userId === "object") {
        return otherMember.userId.displayName || otherMember.userId.email || "Đồng nghiệp";
      }
    }
    return "Cuộc trò chuyện";
  };

  const getRoomAvatarInitial = (room: ChatRoom) => {
    const name = getRoomDisplayName(room);
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const formatMessageTime = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
    }
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
      return days[date.getDay()];
    }
    return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}`;
  };

  // Filtered Rooms
  const filteredRooms = useMemo(() => {
    let list = [...rooms];
    if (activeTab === "other") {
      list = list.filter((r) => r.isChatbot || r.isGroup);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => {
        const name = getRoomDisplayName(r).toLowerCase();
        const lastMsg = (r.lastMessage?.content || "").toLowerCase();
        return name.includes(q) || lastMsg.includes(q);
      });
    }
    // Sort pinned rooms to top
    return list.sort((a, b) => {
      const aPinned = a.isPinned ? 1 : 0;
      const bPinned = b.isPinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });
  }, [rooms, activeTab, searchQuery, currentUserId]);

  // Messages filtered by in-chat search
  const displayedMessages = useMemo(() => {
    if (!chatSearchQuery.trim()) return messages;
    const q = chatSearchQuery.toLowerCase().trim();
    return messages.filter((m) => (m.content || "").toLowerCase().includes(q));
  }, [messages, chatSearchQuery]);

  // Pinned message in active room
  const pinnedMessage = useMemo(() => {
    if (!activeRoom?.pinnedMessageIds || activeRoom.pinnedMessageIds.length === 0) return null;
    const firstPin = activeRoom.pinnedMessageIds[0];
    if (typeof firstPin === "object" && firstPin._id) return firstPin as ChatMessage;
    return messages.find((m) => m._id === firstPin) || null;
  }, [activeRoom, messages]);

  // ==========================================
  // RENDER MAIN SCREEN (ROOMS LIST)
  // ==========================================
  return (
    <SafeAreaView style={styles.safeArea}>
      {/* 1. Header (Zalo style Blue Header) */}
      <View style={styles.topHeader}>
        <View style={styles.searchBarContainer}>
          <Ionicons name="search-outline" size={19} color="#ffffff" style={styles.searchIcon} />
          <TextInput
            style={styles.headerSearchInput}
            placeholder="Tìm kiếm"
            placeholderTextColor="rgba(255,255,255,0.7)"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={6}>
              <Ionicons name="close-circle" size={17} color="#ffffff" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.headerActionBtn} onPress={() => Alert.alert("Mã QR", "Tính năng quét QR chat.")}>
          <Ionicons name="qr-code-outline" size={22} color="#ffffff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerActionBtn} onPress={handleOpenCreateModal}>
          <Ionicons name="add" size={28} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* 2. Sub Tabs: "Ưu tiên" | "Khác" */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === "priority" && styles.tabItemActive]}
          onPress={() => setActiveTab("priority")}
        >
          <Text style={[styles.tabText, activeTab === "priority" && styles.tabTextActive]}>Ưu tiên</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === "other" && styles.tabItemActive]}
          onPress={() => setActiveTab("other")}
        >
          <Text style={[styles.tabText, activeTab === "other" && styles.tabTextActive]}>Khác</Text>
        </TouchableOpacity>
      </View>

      {/* 3. Room List */}
      {loadingRooms && rooms.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={BLUE_PRIMARY} />
          <Text style={styles.loadingText}>Đang tải cuộc trò chuyện...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[BLUE_PRIMARY]} />}
          contentContainerStyle={filteredRooms.length === 0 ? styles.emptyContainer : styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Ionicons name="chatbubbles-outline" size={64} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện nào</Text>
              <Text style={styles.emptySubtitle}>Bấm nút (+) ở góc trên để tạo nhóm hoặc nhắn tin với đồng nghiệp</Text>
              <TouchableOpacity style={styles.emptyActionBtn} onPress={handleOpenCreateModal}>
                <Ionicons name="paper-plane-outline" size={18} color="#ffffff" />
                <Text style={styles.emptyActionBtnText}>Bắt đầu trò chuyện</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const roomName = getRoomDisplayName(item);
            const isMeLastSender =
              typeof item.lastMessage?.senderId === "object"
                ? item.lastMessage?.senderId?._id === currentUserId
                : item.lastMessage?.senderId === currentUserId;

            let lastMsgText = "Chưa có tin nhắn";
            if (item.lastMessage) {
              if (item.lastMessage.isDeleted) {
                lastMsgText = "Tin nhắn đã được thu hồi";
              } else if (item.lastMessage.attachments && item.lastMessage.attachments.length > 0) {
                lastMsgText = isMeLastSender ? "Bạn: [Hình ảnh/Tệp]" : `${item.lastMessage.senderName || "Đồng nghiệp"}: [Hình ảnh/Tệp]`;
              } else if (item.lastMessage.content) {
                lastMsgText = isMeLastSender ? `Bạn: ${item.lastMessage.content}` : `${item.lastMessage.senderName ? `${item.lastMessage.senderName}: ` : ""}${item.lastMessage.content}`;
              }
            }

            const unreadCount = item.unreadCount || 0;

            return (
              <TouchableOpacity
                style={[styles.roomCard, item.isPinned && styles.roomCardPinned]}
                onPress={() => handleOpenRoom(item)}
                onLongPress={() => {
                  Alert.alert(roomName, "Tùy chọn cuộc trò chuyện", [
                    {
                      text: item.isPinned ? "Bỏ ghim" : "Ghim lên đầu",
                      onPress: () => void handleTogglePin(item._id),
                    },
                    {
                      text: "Đánh dấu đã đọc",
                      onPress: () => {
                        void chat.markAsRead(item._id);
                        void loadRooms(true);
                      },
                    },
                    { text: "Đóng", style: "cancel" },
                  ]);
                }}
                activeOpacity={0.7}
              >
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                  {item.avatarURL ? (
                    <Image source={{ uri: item.avatarURL }} style={styles.avatarImg} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, item.isGroup && { backgroundColor: "#0284c7" }]}>
                      {item.isGroup ? (
                        <Ionicons name="people" size={22} color="#ffffff" />
                      ) : (
                        <Text style={styles.avatarInitial}>{getRoomAvatarInitial(item)}</Text>
                      )}
                    </View>
                  )}
                </View>

                {/* Content */}
                <View style={styles.roomContent}>
                  <View style={styles.roomTopRow}>
                    <Text style={styles.roomName} numberOfLines={1}>
                      {roomName}
                    </Text>
                    <View style={styles.roomTimeRow}>
                      {item.isPinned && (
                        <Ionicons name="pin" size={13} color="#94a3b8" style={{ marginRight: 4 }} />
                      )}
                      <Text style={styles.roomTime}>{formatMessageTime(item.lastMessage?.createdAt || item.updatedAt)}</Text>
                    </View>
                  </View>

                  <View style={styles.roomBottomRow}>
                    <Text
                      style={[
                        styles.roomLastMsg,
                        unreadCount > 0 && styles.roomLastMsgUnread,
                        item.lastMessage?.isDeleted && styles.roomLastMsgDeleted,
                      ]}
                      numberOfLines={1}
                    >
                      {lastMsgText}
                    </Text>

                    {unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* ==========================================
          MODAL CONVERSATION CHAT (ROOM VIEW)
          ========================================== */}
      <Modal visible={!!activeRoom} animationType="slide" onRequestClose={handleCloseRoom}>
        <SafeAreaView style={styles.chatRoomSafeArea}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
          >
            {/* Chat Room Header (Zalo style: Back, Title, Search, Menu - NO Video Call) */}
            <View style={styles.chatRoomHeader}>
              <TouchableOpacity onPress={handleCloseRoom} style={styles.chatBackBtn}>
                <Ionicons name="arrow-back" size={24} color="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.chatTitleContainer}
                onPress={() => setRoomInfoModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.chatHeaderTitle} numberOfLines={1}>
                  {activeRoom ? getRoomDisplayName(activeRoom) : ""}
                </Text>
                <Text style={styles.chatHeaderSubtitle}>
                  {activeRoom?.isGroup
                    ? `${activeRoom.members?.length || 0} thành viên`
                    : "Bấm để xem thông tin"}
                </Text>
              </TouchableOpacity>

              {/* Search icon */}
              <TouchableOpacity
                style={styles.chatHeaderIconBtn}
                onPress={() => setShowSearchInChat((prev) => !prev)}
              >
                <Ionicons name="search-outline" size={22} color="#ffffff" />
              </TouchableOpacity>

              {/* Menu icon */}
              <TouchableOpacity
                style={styles.chatHeaderIconBtn}
                onPress={() => setRoomInfoModalVisible(true)}
              >
                <Ionicons name="list" size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* In-chat search bar (toggled) */}
            {showSearchInChat && (
              <View style={styles.inChatSearchBar}>
                <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 6 }} />
                <TextInput
                  style={styles.inChatSearchInput}
                  placeholder="Tìm kiếm tin nhắn trong phòng..."
                  placeholderTextColor="#94a3b8"
                  value={chatSearchQuery}
                  onChangeText={setChatSearchQuery}
                  autoFocus
                />
                {chatSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setChatSearchQuery("")}>
                    <Ionicons name="close-circle" size={16} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Pinned Message Banner */}
            {pinnedMessage && (
              <View style={styles.pinnedBanner}>
                <Ionicons name="chatbox-ellipses-outline" size={18} color={BLUE_PRIMARY} style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pinnedTitle} numberOfLines={1}>
                    {pinnedMessage.content || "[Đính kèm]"}
                  </Text>
                  <Text style={styles.pinnedSubtitle}>
                    Tin nhắn của {pinnedMessage.senderName || "Đồng nghiệp"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert("Tin nhắn ghim", pinnedMessage.content, [
                      {
                        text: "Bỏ ghim",
                        onPress: async () => {
                          if (!activeRoom?._id) return;
                          try {
                            const updated = await chat.unpinMessage(activeRoom._id, pinnedMessage._id);
                            setActiveRoom(updated);
                          } catch {}
                        },
                      },
                      { text: "Đóng", style: "cancel" },
                    ]);
                  }}
                  style={styles.pinnedBadge}
                >
                  <Text style={styles.pinnedBadgeText}>+1</Text>
                  <Ionicons name="chevron-down" size={14} color="#64748b" />
                </TouchableOpacity>
              </View>
            )}

            {/* Messages Body */}
            {loadingMessages && messages.length === 0 ? (
              <View style={styles.centered}>
                <ActivityIndicator size="small" color={BLUE_PRIMARY} />
                <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={displayedMessages}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.messagesList}
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                renderItem={({ item }) => {
                  const isMe =
                    typeof item.senderId === "object"
                      ? item.senderId?._id === currentUserId
                      : item.senderId === currentUserId;

                  const isDeleted = !!item.isDeleted;

                  return (
                    <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
                      {/* Avatar for other users in group chat */}
                      {!isMe && activeRoom?.isGroup && (
                        <View style={styles.msgSenderAvatar}>
                          <Text style={styles.msgSenderAvatarText}>
                            {(item.senderName || "U").slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                      )}

                      <View style={{ maxWidth: "78%" }}>
                        {/* Sender name for group chats */}
                        {!isMe && activeRoom?.isGroup && (
                          <Text style={styles.msgSenderName}>{item.senderName || "Đồng nghiệp"}</Text>
                        )}

                        {/* Bubble */}
                        <TouchableOpacity
                          style={[
                            styles.msgBubble,
                            isMe ? styles.msgBubbleMe : styles.msgBubbleOther,
                            isDeleted && styles.msgBubbleDeleted,
                          ]}
                          onLongPress={() => {
                            setSelectedMessage(item);
                            setMessageActionModalVisible(true);
                          }}
                          activeOpacity={0.85}
                        >
                          {isDeleted ? (
                            <Text style={styles.msgDeletedText}>Tin nhắn đã được thu hồi</Text>
                          ) : (
                            <>
                              {/* Attachments */}
                              {item.attachments && item.attachments.length > 0 && (
                                <View style={styles.msgAttachmentsWrap}>
                                  {item.attachments.map((att: any, idx: number) => (
                                    <View key={idx} style={styles.attItem}>
                                      {att.type?.startsWith("image") ? (
                                        <Image source={{ uri: att.url }} style={styles.attImage} resizeMode="cover" />
                                      ) : (
                                        <TouchableOpacity
                                          style={styles.attFileCard}
                                          onPress={() => Linking.openURL(att.url)}
                                        >
                                          <Ionicons name="document-text" size={24} color={BLUE_PRIMARY} />
                                          <View style={{ marginLeft: 8, flex: 1 }}>
                                            <Text style={styles.attFileName} numberOfLines={1}>
                                              {att.name}
                                            </Text>
                                            <Text style={styles.attFileSize}>
                                              {att.size ? `${(att.size / 1024).toFixed(1)} KB` : "Tệp tin"}
                                            </Text>
                                          </View>
                                        </TouchableOpacity>
                                      )}
                                    </View>
                                  ))}
                                </View>
                              )}

                              {/* Text content */}
                              {item.content ? (
                                <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>
                                  {item.content}
                                </Text>
                              ) : null}
                            </>
                          )}

                          {/* Reaction badge */}
                          {item.reactions && item.reactions.length > 0 && (
                            <View style={styles.reactionBadge}>
                              <Text style={styles.reactionBadgeText}>
                                {item.reactions.map((r: any) => r.emoji).join(" ")} {item.reactions.length}
                              </Text>
                            </View>
                          )}
                        </TouchableOpacity>

                        {/* Timestamp & Status */}
                        <View style={[styles.msgMetaRow, isMe && { justifyContent: "flex-end" }]}>
                          <Text style={styles.msgTimeText}>{formatMessageTime(item.createdAt)}</Text>
                          {isMe && (
                            <Text style={styles.msgStatusText}>
                              {item.readBy && item.readBy.length > 1 ? "✓✓ Đã xem" : "✓✓ Đã nhận"}
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                }}
              />
            )}

            {/* Bottom Input Bar (Zalo Style) */}
            <View style={styles.inputBarContainer}>
              <TouchableOpacity
                style={styles.inputIconBtn}
                onPress={() => Alert.alert("Biểu tượng cảm xúc", "Chức năng chọn sticker/emoji.")}
              >
                <Ionicons name="happy-outline" size={24} color="#64748b" />
              </TouchableOpacity>

              <TextInput
                style={styles.chatTextInput}
                placeholder="Tin nhắn"
                placeholderTextColor="#94a3b8"
                value={inputText}
                onChangeText={setInputText}
                multiline
              />

              {inputText.trim().length === 0 ? (
                <View style={styles.inputActionGroup}>
                  <TouchableOpacity style={styles.inputIconBtn} onPress={handlePickImage}>
                    <Ionicons name="image-outline" size={24} color="#64748b" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.inputIconBtn} onPress={handlePickDocument}>
                    <Ionicons name="attach" size={24} color="#64748b" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.sendBtn, sending && { opacity: 0.5 }]}
                  onPress={() => void handleSendMessage()}
                  disabled={sending}
                >
                  <Ionicons name="send" size={18} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ==========================================
          MODAL: TẠO PHÒNG CHAT / NHÓM MỚI
          ========================================== */}
      <Modal visible={createModalVisible} animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)}>
              <Ionicons name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Tạo cuộc trò chuyện mới</Text>
            <TouchableOpacity
              onPress={handleCreateRoom}
              disabled={creatingRoom || selectedUserIds.length === 0}
              style={[
                styles.modalDoneBtn,
                (selectedUserIds.length === 0 || creatingRoom) && { opacity: 0.4 },
              ]}
            >
              {creatingRoom ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalDoneBtnText}>Tạo</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Group Name input if > 1 selected */}
          {selectedUserIds.length > 1 && (
            <View style={styles.groupNameInputWrap}>
              <Ionicons name="people-outline" size={20} color={BLUE_PRIMARY} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.groupNameInput}
                placeholder="Đặt tên nhóm chat..."
                placeholderTextColor="#94a3b8"
                value={groupName}
                onChangeText={setGroupName}
              />
            </View>
          )}

          {/* User Search Bar */}
          <View style={styles.userSearchWrapper}>
            <Ionicons name="search" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.userSearchInput}
              placeholder="Tìm đồng nghiệp theo tên hoặc email..."
              placeholderTextColor="#94a3b8"
              value={userSearchQuery}
              onChangeText={setUserSearchQuery}
            />
          </View>

          {loadingUsers ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={BLUE_PRIMARY} />
              <Text style={styles.loadingText}>Đang tải danh sách đồng nghiệp...</Text>
            </View>
          ) : (
            <FlatList
              data={usersList.filter((u) => {
                if (!userSearchQuery.trim()) return true;
                const q = userSearchQuery.toLowerCase();
                return (
                  (u.displayName || "").toLowerCase().includes(q) ||
                  (u.email || "").toLowerCase().includes(q)
                );
              })}
              keyExtractor={(item) => item.uid}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
              renderItem={({ item }) => {
                const isSelected = selectedUserIds.includes(item.uid);
                return (
                  <TouchableOpacity
                    style={styles.userPickItem}
                    onPress={() => {
                      if (isSelected) {
                        setSelectedUserIds((prev) => prev.filter((id) => id !== item.uid));
                      } else {
                        setSelectedUserIds((prev) => [...prev, item.uid]);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.userPickAvatar}>
                      <Text style={styles.userPickAvatarText}>
                        {(item.displayName || item.email || "U").slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.userPickName}>{item.displayName || item.email}</Text>
                      <Text style={styles.userPickRole}>{item.role || "Thành viên"}</Text>
                    </View>
                    <Ionicons
                      name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                      size={24}
                      color={isSelected ? BLUE_PRIMARY : "#cbd5e1"}
                    />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ==========================================
          MODAL: THAO TÁC TIN NHẮN (LONG PRESS)
          ========================================== */}
      <Modal
        visible={messageActionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMessageActionModalVisible(false)}
      >
        <Pressable style={styles.actionModalOverlay} onPress={() => setMessageActionModalVisible(false)}>
          <View style={styles.actionModalSheet}>
            <Text style={styles.actionModalTitle}>Thao tác tin nhắn</Text>

            {/* Quick emoji reactions */}
            <View style={styles.reactionRow}>
              {["❤️", "👍", "😂", "😮", "😢", "🔥"].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionBtn}
                  onPress={() => {
                    if (selectedMessage) void handleReactMessage(selectedMessage, emoji);
                  }}
                >
                  <Text style={{ fontSize: 24 }}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Actions list */}
            {selectedMessage && (
              <View style={styles.actionList}>
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    if (selectedMessage) void handlePinMessage(selectedMessage);
                  }}
                >
                  <Ionicons name="pin-outline" size={20} color="#0f172a" />
                  <Text style={styles.actionItemText}>Ghim tin nhắn</Text>
                </TouchableOpacity>

                {/* Revoke / Delete message if sent by me */}
                {(typeof selectedMessage.senderId === "object"
                  ? selectedMessage.senderId?._id === currentUserId
                  : selectedMessage.senderId === currentUserId) && (
                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={() => void handleDeleteMessage(selectedMessage)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#dc2626" />
                    <Text style={[styles.actionItemText, { color: "#dc2626" }]}>Thu hồi tin nhắn</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* ==========================================
          MODAL: THÔNG TIN PHÒNG CHAT & THÀNH VIÊN
          ========================================== */}
      <Modal visible={roomInfoModalVisible} animationType="slide" onRequestClose={() => setRoomInfoModalVisible(false)}>
        <SafeAreaView style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setRoomInfoModalVisible(false)}>
              <Ionicons name="arrow-back" size={24} color="#0f172a" />
            </TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>Thông tin cuộc trò chuyện</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View style={styles.roomInfoHero}>
              <View style={[styles.avatarPlaceholder, { width: 72, height: 72, borderRadius: 36 }]}>
                <Text style={{ fontSize: 28, color: "#ffffff", fontWeight: "700" }}>
                  {activeRoom ? getRoomAvatarInitial(activeRoom) : ""}
                </Text>
              </View>
              <Text style={styles.roomInfoName}>{activeRoom ? getRoomDisplayName(activeRoom) : ""}</Text>
              <Text style={styles.roomInfoType}>
                {activeRoom?.isGroup ? `Nhóm trò chuyện (${activeRoom.members?.length} thành viên)` : "Cuộc trò chuyện cá nhân"}
              </Text>
            </View>

            {/* Member list for group */}
            {activeRoom?.isGroup && (
              <View style={{ marginTop: 24 }}>
                <Text style={styles.sectionHeader}>Danh sách thành viên</Text>
                {activeRoom.members?.map((m: ChatRoomMember, idx: number) => {
                  const mUser = typeof m.userId === "object" ? m.userId : null;
                  return (
                    <View key={idx} style={styles.memberRow}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.memberAvatarText}>
                          {(mUser?.displayName || "U").slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={styles.memberName}>{mUser?.displayName || mUser?.email || "Thành viên"}</Text>
                        <Text style={styles.memberRole}>{m.role === "admin" ? "Trưởng nhóm" : "Thành viên"}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Leave Room / Delete Room Action */}
            <View style={{ marginTop: 32 }}>
              {activeRoom?.isGroup && (
                <TouchableOpacity
                  style={styles.dangerBtn}
                  onPress={() => {
                    Alert.alert("Rời nhóm", "Bạn có chắc chắn muốn rời khỏi nhóm này không?", [
                      { text: "Hủy", style: "cancel" },
                      {
                        text: "Rời nhóm",
                        style: "destructive",
                        onPress: async () => {
                          if (!activeRoom?._id) return;
                          try {
                            await chat.leaveRoom(activeRoom._id);
                            setRoomInfoModalVisible(false);
                            setActiveRoom(null);
                            void loadRooms(true);
                          } catch (err: any) {
                            Alert.alert("Lỗi", err?.message || "Không thể rời nhóm.");
                          }
                        },
                      },
                    ]);
                  }}
                >
                  <Ionicons name="log-out-outline" size={20} color="#dc2626" style={{ marginRight: 8 }} />
                  <Text style={styles.dangerBtnText}>Rời khỏi nhóm trò chuyện</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#64748b",
  },

  /* 1. ZALO BLUE TOP HEADER */
  topHeader: {
    backgroundColor: BLUE_HEADER,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: {
    marginRight: 6,
  },
  headerSearchInput: {
    flex: 1,
    fontSize: 15,
    color: "#ffffff",
    paddingVertical: 0,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  /* 2. SUB TABS: ƯU TIÊN | KHÁC */
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  tabItemActive: {
    borderBottomWidth: 2.5,
    borderBottomColor: "#0f172a",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  tabTextActive: {
    color: "#0f172a",
    fontWeight: "700",
  },

  /* 3. ROOM LIST */
  listContent: {
    paddingBottom: 24,
  },
  roomCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
    backgroundColor: "#ffffff",
  },
  roomCardPinned: {
    backgroundColor: "#f8fafc",
  },
  avatarContainer: {
    position: "relative",
  },
  avatarImg: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: BLUE_PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "700",
  },
  roomContent: {
    flex: 1,
    marginLeft: 14,
    justifyContent: "center",
  },
  roomTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  roomName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    flex: 1,
    marginRight: 8,
  },
  roomTimeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  roomTime: {
    fontSize: 12,
    color: "#94a3b8",
  },
  roomBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  roomLastMsg: {
    fontSize: 13.5,
    color: "#64748b",
    flex: 1,
    marginRight: 8,
  },
  roomLastMsgUnread: {
    fontWeight: "600",
    color: "#0f172a",
  },
  roomLastMsgDeleted: {
    fontStyle: "italic",
    color: "#94a3b8",
  },
  unreadBadge: {
    backgroundColor: "#ef4444",
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },

  /* EMPTY VIEW */
  emptyContainer: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyView: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1e293b",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 20,
  },
  emptyActionBtn: {
    backgroundColor: BLUE_PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  emptyActionBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },

  /* ==========================================
      CHAT ROOM VIEW STYLES
     ========================================== */
  chatRoomSafeArea: {
    flex: 1,
    backgroundColor: "#edf2f7",
  },
  chatRoomHeader: {
    backgroundColor: BLUE_HEADER,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  chatBackBtn: {
    padding: 4,
    marginRight: 8,
  },
  chatTitleContainer: {
    flex: 1,
  },
  chatHeaderTitle: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "700",
  },
  chatHeaderSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 1,
  },
  chatHeaderIconBtn: {
    padding: 6,
    marginLeft: 6,
  },
  inChatSearchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  inChatSearchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    paddingVertical: 2,
  },

  /* PINNED BANNER */
  pinnedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  pinnedTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  pinnedSubtitle: {
    fontSize: 11,
    color: "#64748b",
  },
  pinnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 2,
  },
  pinnedBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748b",
  },

  /* MESSAGES LIST */
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  msgRow: {
    flexDirection: "row",
    marginBottom: 12,
    alignItems: "flex-end",
  },
  msgRowMe: {
    justifyContent: "flex-end",
  },
  msgRowOther: {
    justifyContent: "flex-start",
  },
  msgSenderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0284c7",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    marginBottom: 16,
  },
  msgSenderAvatarText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
  },
  msgSenderName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 3,
    marginLeft: 4,
  },
  msgBubble: {
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  msgBubbleMe: {
    backgroundColor: "#e0f2fe",
    borderBottomRightRadius: 3,
  },
  msgBubbleOther: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 3,
  },
  msgBubbleDeleted: {
    backgroundColor: "#f1f5f9",
  },
  msgText: {
    fontSize: 15,
    lineHeight: 21,
  },
  msgTextMe: {
    color: "#0f172a",
  },
  msgTextOther: {
    color: "#0f172a",
  },
  msgDeletedText: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#94a3b8",
  },
  msgAttachmentsWrap: {
    marginBottom: 6,
  },
  attItem: {
    borderRadius: 8,
    overflow: "hidden",
    marginVertical: 2,
  },
  attImage: {
    width: 200,
    height: 150,
    borderRadius: 8,
  },
  attFileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
    padding: 8,
    borderRadius: 8,
  },
  attFileName: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
  },
  attFileSize: {
    fontSize: 11,
    color: "#64748b",
  },
  reactionBadge: {
    position: "absolute",
    bottom: -8,
    right: 8,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    paddingHorizontal: 5,
    paddingVertical: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  reactionBadgeText: {
    fontSize: 11,
  },
  msgMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
    marginHorizontal: 4,
    gap: 6,
  },
  msgTimeText: {
    fontSize: 11,
    color: "#94a3b8",
  },
  msgStatusText: {
    fontSize: 11,
    color: "#64748b",
  },

  /* INPUT BAR */
  inputBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  chatTextInput: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxHeight: 90,
  },
  inputIconBtn: {
    padding: 6,
  },
  inputActionGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  sendBtn: {
    backgroundColor: BLUE_PRIMARY,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },

  /* ==========================================
      MODAL SHARED STYLES
     ========================================== */
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
  },
  modalDoneBtn: {
    backgroundColor: BLUE_PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  modalDoneBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  groupNameInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#f8fafc",
  },
  groupNameInput: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
  },
  userSearchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
  },
  userSearchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
  },
  userPickItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  userPickAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#0284c7",
    alignItems: "center",
    justifyContent: "center",
  },
  userPickAvatarText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  userPickName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  userPickRole: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },

  /* ACTION MODAL */
  actionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  actionModalSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  actionModalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 12,
    textAlign: "center",
  },
  reactionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    marginBottom: 12,
  },
  reactionBtn: {
    padding: 6,
  },
  actionList: {
    gap: 8,
  },
  actionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  actionItemText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#0f172a",
  },

  /* ROOM INFO HERO */
  roomInfoHero: {
    alignItems: "center",
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  roomInfoName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginTop: 12,
  },
  roomInfoType: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: "700",
    color: "#64748b",
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  memberAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: BLUE_PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  memberAvatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  memberName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  memberRole: {
    fontSize: 12,
    color: "#94a3b8",
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#fee2e2",
  },
  dangerBtnText: {
    color: "#dc2626",
    fontSize: 15,
    fontWeight: "600",
  },
});
