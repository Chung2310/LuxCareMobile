import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Modal,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession } from "../../src/auth/SessionProvider";
import { blog } from "../../src/api/services";
import {
  DEFAULT_BLOG_CHANNELS,
  type BlogChannel,
  type BlogPost,
  type BlogAttachment,
} from "../../../src/services/blogService";

export default function BlogScreen() {
  const router = useRouter();
  const { user } = useSession();

  const [channels, setChannels] = useState<BlogChannel[]>(DEFAULT_BLOG_CHANNELS);
  const [selectedChannel, setSelectedChannel] = useState<BlogChannel>(DEFAULT_BLOG_CHANNELS[0]);
  const [channelModalVisible, setChannelModalVisible] = useState(false);

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [bannerVisible, setBannerVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBarVisible, setSearchBarVisible] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    void loadBlogData();
  }, [selectedChannel]);

  const loadBlogData = async () => {
    setLoading(true);
    try {
      const fetchedChannels = await blog.getChannels();
      if (fetchedChannels.length > 0) setChannels(fetchedChannels);

      const fetchedPosts = await blog.getPosts(selectedChannel.id);
      setPosts(fetchedPosts);
    } catch {
      // Handled in service fallback
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    void loadBlogData();
  };

  const handleToggleReaction = async (postId: string, emoji: string) => {
    await blog.toggleReaction(postId, emoji);
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id !== postId) return p;
        const reactions = p.reactions || [];
        const existing = reactions.find((r: { emoji: string; count: number; userReacted?: boolean }) => r.emoji === emoji);

        let newReactions;
        if (existing) {
          if (existing.userReacted) {
            newReactions = reactions
              .map((r: { emoji: string; count: number; userReacted?: boolean }) => (r.emoji === emoji ? { ...r, count: r.count - 1, userReacted: false } : r))
              .filter((r: { emoji: string; count: number; userReacted?: boolean }) => r.count > 0);
          } else {
            newReactions = reactions.map((r: { emoji: string; count: number; userReacted?: boolean }) =>
              r.emoji === emoji ? { ...r, count: r.count + 1, userReacted: true } : r,
            );
          }
        } else {
          newReactions = [...reactions, { emoji, count: 1, userReacted: true }];
        }
        return { ...p, reactions: newReactions };
      }),
    );
  };

  const handleOpenLink = (url: string) => {
    try {
      void Linking.openURL(url);
    } catch {
      Alert.alert("Thông báo", `Mở liên kết: ${url}`);
    }
  };

  const filteredPosts = posts.filter((p) =>
    searchQuery
      ? p.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.title && p.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.authorName.toLowerCase().includes(searchQuery.toLowerCase())
      : true,
  );

  return (
    <SafeAreaView edges={["top"]} style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header Bar (Matching Web UI Header Title) */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color="#0f172a" />
          </Pressable>

          {/* Channel Selector Trigger */}
          <Pressable
            style={({ pressed }) => [styles.channelTitleBtn, pressed && { opacity: 0.8 }]}
            onPress={() => setChannelModalVisible(true)}
          >
            <Ionicons name={selectedChannel.icon as any} size={15} color="#008852" />
            <Text style={styles.channelTitleText} numberOfLines={1}>
              {selectedChannel.name}
            </Text>
            <Ionicons name="chevron-down" size={15} color="#64748b" />
          </Pressable>

          {/* Search Action Icon Only (No Post Button) */}
          <Pressable
            style={styles.headerIconBtn}
            onPress={() => setSearchBarVisible(!searchBarVisible)}
            hitSlop={6}
          >
            <Ionicons name="search-outline" size={20} color="#0f172a" />
          </Pressable>
        </View>

        {/* Search Bar Input (Toggleable) */}
        {searchBarVisible && (
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color="#64748b" style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm kiếm bài viết, tài liệu, thông báo..."
              placeholderTextColor="#94a3b8"
              style={styles.searchInput}
              autoFocus
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Top Pinned Announcement Banner (Tin Ghim - Matching Web Screenshot) */}
        {bannerVisible && (
          <View style={styles.pinnedBanner}>
            <View style={styles.pinnedLeft}>
              <Text style={styles.pinnedIcon}>📌</Text>
              <Text style={styles.pinnedText} numberOfLines={1}>
                <Text style={{ fontWeight: "800", color: "#ea580c" }}>Tin ghim: </Text>
                Trước thềm năm học mới 2026 - 2027, ngành Y tế và Giáo dục tại nhiều tỉnh...
              </Text>
            </View>
            <Pressable onPress={() => setBannerVisible(false)} hitSlop={8}>
              <Ionicons name="close" size={16} color="#c2410c" />
            </Pressable>
          </View>
        )}

        {/* Timeline Feed ScrollView */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.feedScrollView}
          contentContainerStyle={styles.feedContentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={["#008852"]}
              tintColor="#008852"
            />
          }
        >
          {/* Loading Indicator */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#008852" />
              <Text style={styles.loadingText}>Đang tải bản tin thực tế từ server...</Text>
            </View>
          ) : filteredPosts.length === 0 ? (
            /* Empty State */
            <View style={styles.emptyContainer}>
              <Ionicons name="newspaper-outline" size={44} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Chưa có bài viết nào</Text>
              <Text style={styles.emptySub}>
                Hiện chưa có bản tin hoặc thông báo nào trong chuyên mục "{selectedChannel.name}".
              </Text>
            </View>
          ) : (
            /* Posts Feed List (Matching Web Screenshot) */
            filteredPosts.map((post) => {
              const isUrl = post.content.startsWith("http://") || post.content.startsWith("https://");

              return (
                <View key={post.id} style={styles.postCard}>
                  {/* Card Header: Yellow Circle Avatar + Author Name + Orange Badge + Time */}
                  <View style={styles.postHeaderRow}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarInitials}>
                        {post.authorName ? post.authorName.substring(0, 2).toUpperCase() : "CH"}
                      </Text>
                    </View>

                    <View style={styles.authorMetaCol}>
                      <View style={styles.authorNameRow}>
                        <Text style={styles.authorName}>{post.authorName}</Text>
                        <View style={styles.editorRoleBadge}>
                          <Text style={styles.editorRoleBadgeText}>
                            {post.authorRoleBadge || "Ban Biên Tập"}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.postTime}>{post.createdAt}</Text>
                    </View>
                  </View>

                  {/* Optional Title */}
                  {post.title && <Text style={styles.articleTitle}>{post.title}</Text>}

                  {/* Post Content (Text or Clickable URL) */}
                  {isUrl ? (
                    <Pressable
                      style={styles.urlBox}
                      onPress={() => handleOpenLink(post.content)}
                    >
                      <Ionicons name="link-outline" size={16} color="#2563eb" />
                      <Text style={styles.urlText} numberOfLines={2}>
                        {post.content}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.postContentText}>{post.content}</Text>
                  )}

                  {/* File Attachments (Matching Web screenshot style) */}
                  {post.attachments?.map((att: BlogAttachment) => (
                    <View key={att.id} style={styles.webFileCard}>
                      <View style={styles.webFileIconWrap}>
                        <Ionicons name="document-text" size={20} color="#008852" />
                      </View>
                      <View style={styles.webFileMeta}>
                        <Text style={styles.webFileName} numberOfLines={1}>
                          {att.name}
                        </Text>
                        <Text style={styles.webFileSize}>{att.size || "831.5 KB"}</Text>
                      </View>
                      <Pressable
                        style={styles.webDownloadBtn}
                        onPress={() => handleOpenLink(att.url || post.content)}
                      >
                        <Ionicons name="download-outline" size={14} color="#008852" />
                        <Text style={styles.webDownloadText}>Tải về</Text>
                      </Pressable>
                    </View>
                  ))}

                  {/* Footer Row: Tag + Like Action */}
                  <View style={styles.postCardFooter}>
                    <View style={styles.tagBadge}>
                      <Text style={styles.tagBadgeText}>#{post.channelName || "Thông báo"}</Text>
                    </View>

                    <Pressable
                      style={styles.likeBtn}
                      onPress={() => void handleToggleReaction(post.id, "❤️")}
                    >
                      <Ionicons
                        name={post.reactions?.[0]?.userReacted ? "heart" : "heart-outline"}
                        size={16}
                        color={post.reactions?.[0]?.userReacted ? "#dc2626" : "#64748b"}
                      />
                      <Text style={[styles.likeBtnText, post.reactions?.[0]?.userReacted && { color: "#dc2626" }]}>
                        Thích {post.reactions?.[0]?.count ? `(${post.reactions[0].count})` : ""}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>

        {/* Read-Only Footer Banner (Soft Light Blue Theme) */}
        <View style={styles.readOnlyBlueFooter}>
          <View style={styles.readOnlyLeftCol}>
            <View style={styles.readOnlyTitleRow}>
              <Ionicons name="lock-closed" size={14} color="#0284c7" />
              <Text style={styles.readOnlyTitle}>Chế độ chỉ xem (Read-only Channel)</Text>
            </View>
            <Text style={styles.readOnlySubText}>
              Chỉ tài khoản Ban biên tập / Tác giả đặc biệt mới có quyền gửi bài viết & tin nhắn trong kênh này.
            </Text>
          </View>

          <View style={styles.readOnlyLockTag}>
            <Ionicons name="lock-closed-outline" size={13} color="#0284c7" />
            <Text style={styles.readOnlyLockTagText}>Quyền gửi bị khóa</Text>
          </View>
        </View>

        {/* Channel Selector Modal */}
        <Modal
          visible={channelModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setChannelModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setChannelModalVisible(false)}>
            <View style={styles.channelModalCard}>
              <View style={styles.channelModalHeader}>
                <Text style={styles.channelModalTitle}>Chuyên mục tin tức</Text>
                <Pressable onPress={() => setChannelModalVisible(false)}>
                  <Ionicons name="close" size={20} color="#64748b" />
                </Pressable>
              </View>

              <FlatList
                data={channels}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isSelected = item.id === selectedChannel.id;
                  return (
                    <Pressable
                      style={[styles.channelItem, isSelected && styles.channelItemActive]}
                      onPress={() => {
                        setSelectedChannel(item);
                        setChannelModalVisible(false);
                      }}
                    >
                      <View style={[styles.channelIconWrap, isSelected && styles.channelIconWrapActive]}>
                        <Ionicons
                          name={item.icon as any}
                          size={18}
                          color={isSelected ? "#008852" : "#64748b"}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.channelItemName, isSelected && styles.channelItemNameActive]}>
                          {item.name}
                        </Text>
                        <Text style={styles.channelItemDesc} numberOfLines={1}>
                          {item.description}
                        </Text>
                      </View>
                    </Pressable>
                  );
                }}
              />
            </View>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: {
    padding: 4,
  },
  channelTitleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  channelTitleText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  headerIconBtn: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    fontFamily: "Inter-Regular",
  },
  pinnedBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff7ed",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#ffedd5",
  },
  pinnedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  pinnedIcon: {
    fontSize: 14,
  },
  pinnedText: {
    fontSize: 12,
    color: "#c2410c",
    fontFamily: "Inter-Medium",
    flex: 1,
  },
  feedScrollView: {
    flex: 1,
  },
  feedContentContainer: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 20,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 30,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
    fontFamily: "Inter-Medium",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#475569",
    fontFamily: "Inter-Bold",
  },
  emptySub: {
    fontSize: 12.5,
    color: "#94a3b8",
    textAlign: "center",
    fontFamily: "Inter-Regular",
  },
  postCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  postHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eab308",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
    fontFamily: "Inter-Bold",
  },
  authorMetaCol: {
    flex: 1,
  },
  authorNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  authorName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  editorRoleBadge: {
    backgroundColor: "#fff7ed",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#ffedd5",
  },
  editorRoleBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#c2410c",
    fontFamily: "Inter-Bold",
  },
  postTime: {
    fontSize: 11,
    color: "#94a3b8",
    fontFamily: "Inter-Regular",
    marginTop: 2,
  },
  articleTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    marginBottom: 6,
    lineHeight: 20,
  },
  postContentText: {
    fontSize: 13,
    color: "#1e293b",
    lineHeight: 19,
    fontFamily: "Inter-Regular",
    marginBottom: 10,
  },
  urlBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    padding: 10,
    borderRadius: 8,
    gap: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  urlText: {
    flex: 1,
    fontSize: 12.5,
    color: "#2563eb",
    fontFamily: "Inter-Medium",
  },
  webFileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  webFileIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#e6f4ea",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  webFileMeta: {
    flex: 1,
  },
  webFileName: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  webFileSize: {
    fontSize: 11,
    color: "#64748b",
  },
  webDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e6f4ea",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  webDownloadText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#008852",
    fontFamily: "Inter-Bold",
  },
  postCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  tagBadge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagBadgeText: {
    fontSize: 11,
    color: "#64748b",
    fontFamily: "Inter-Medium",
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  likeBtnText: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Inter-Medium",
  },
  readOnlyBlueFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f0f9ff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: "#bae6fd",
  },
  readOnlyLeftCol: {
    flex: 1,
  },
  readOnlyTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  readOnlyTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: "#0369a1",
    fontFamily: "Inter-Bold",
  },
  readOnlySubText: {
    fontSize: 11,
    color: "#0284c7",
    fontFamily: "Inter-Regular",
    lineHeight: 15,
  },
  readOnlyLockTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#e0f2fe",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bae6fd",
  },
  readOnlyLockTagText: {
    fontSize: 10.5,
    color: "#0284c7",
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  channelModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    maxHeight: 400,
  },
  channelModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  channelModalTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  channelItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    gap: 10,
  },
  channelItemActive: {
    backgroundColor: "#ecfdf5",
  },
  channelIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  channelIconWrapActive: {
    backgroundColor: "#d1fae5",
  },
  channelItemName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#334155",
    fontFamily: "Inter-Bold",
  },
  channelItemNameActive: {
    color: "#008852",
  },
  channelItemDesc: {
    fontSize: 11.5,
    color: "#64748b",
  },
});
