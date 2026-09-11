import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Modal,
  FlatList,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Linking,
  Image,
  Share,
  ImageBackground,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { useSession } from "../../src/auth/SessionProvider";
import { blog, kanbanMedia } from "../../src/api/services";
import { isBlogEditorUser } from "../../../src/utils/permissionUtils";
import {
  DEFAULT_BLOG_CHANNELS,
  type BlogChannel,
  type BlogPost,
  type BlogAttachment,
} from "../../../src/services/blogService";

const CATEGORY_TAGS = ["Thông báo", "Tin tức", "Sự kiện", "Quy trình", "Chuyên môn", "Vinh danh"];

function PinIcon({ size = 15, color = "#92400e", style }: { size?: number; color?: string; style?: any }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <Path d="M12 17v5" />
      <Path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </Svg>
  );
}

export default function BlogScreen() {
  const router = useRouter();
  const { user, logout } = useSession();
  const isEditor = isBlogEditorUser(user);

  const [channels, setChannels] = useState<BlogChannel[]>(DEFAULT_BLOG_CHANNELS);
  const [selectedChannel, setSelectedChannel] = useState<BlogChannel>(DEFAULT_BLOG_CHANNELS[0]);
  const [channelModalVisible, setChannelModalVisible] = useState(false);

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [bannerVisible, setBannerVisible] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBarVisible, setSearchBarVisible] = useState(false);

  // Editor Inline Composer State
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [selectedTag, setSelectedTag] = useState("Thông báo");
  const [attachments, setAttachments] = useState<{ id: string; name: string; type: "file" | "image"; sizeBytes?: number; sizeLabel?: string; localUri?: string }[]>([]);
  const [posting, setPosting] = useState(false);

  // Pinned Posts Modal & Layout Scrolling State
  const [pinnedModalVisible, setPinnedModalVisible] = useState(false);
  const postLayouts = useRef<Record<string, number>>({});
  const isSharingRef = useRef(false);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);

  const pinnedPosts = useMemo(
    () => posts.filter((p) => p.isPinned),
    [posts],
  );

  const jumpToPost = (postId: string) => {
    setPinnedModalVisible(false);
    setTimeout(() => {
      const y = postLayouts.current[postId];
      if (typeof y === "number") {
        scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
      }
    }, 200);
  };

  const handleLongPressPost = (post: BlogPost) => {
    if (!isEditor) return;
    const isAlreadyPinned = Boolean(post.isPinned);
    showAlert(
      isAlreadyPinned ? "Bỏ ghim bài viết" : "Ghim bài viết",
      isAlreadyPinned
        ? `Bạn có chắc chắn muốn bỏ ghim bài viết "${post.title || post.content.substring(0, 30)}..." khỏi danh sách tin ghim?`
        : `Bạn có chắc chắn muốn ghim bài viết "${post.title || post.content.substring(0, 30)}..." lên danh sách tin ghim ở đầu trang?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: isAlreadyPinned ? "Bỏ ghim" : "Ghim bài",
          style: "default",
          onPress: () => void handleTogglePin(post.id),
        },
      ],
    );
  };

  // Rounded Custom Alert Modal State
  const [alertState, setAlertState] = useState<{
    visible: boolean;
    title: string;
    message: string;
    buttons?: { text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => void }[];
  }>({
    visible: false,
    title: "",
    message: "",
  });

  const showAlert = (
    title: string,
    message: string,
    buttons?: { text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => void }[]
  ) => {
    setAlertState({
      visible: true,
      title,
      message,
      buttons: buttons || [{ text: "Đồng ý", style: "default" }],
    });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, visible: false }));
  };

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

  const handlePickDocument = () => {
    showAlert("Đính kèm", "Chọn loại đính kèm:", [
      {
        text: "Tài liệu (Word/PDF/Excel)",
        onPress: async () => {
          try {
            const result = await DocumentPicker.getDocumentAsync({
              type: [
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.ms-excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              ],
              copyToCacheDirectory: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
              const file = result.assets[0];
              setAttachments((prev) => [
                ...prev,
                {
                  id: `doc-${Date.now()}`,
                  name: file.name,
                  type: "file" as const,
                  sizeBytes: file.size ?? 0,
                  sizeLabel: file.size ? `${(file.size / 1024).toFixed(1)} KB` : "Không rõ",
                  localUri: file.uri,
                },
              ]);
            }
          } catch (err) {
            showAlert("Lỗi", "Không thể chọn tệp đính kèm.");
          }
        },
      },
      {
        text: "Thêm Liên kết (Link)",
        onPress: () => {
          setNewContent((prev) => prev + (prev.length > 0 ? "\n" : "") + "https://");
        },
      },
      { text: "Hủy", style: "cancel" },
    ]);
  };

  const handlePickImage = () => {
    showAlert("Đính kèm hình ảnh", "Bạn muốn tải ảnh lên từ đâu?", [
      {
        text: "Thư viện ảnh",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.8,
          });
          if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            const name = asset.fileName || `image-${Date.now()}.jpg`;
            setAttachments((prev) => [
              ...prev,
              {
                id: `img-${Date.now()}`,
                name,
                type: "image" as const,
                sizeBytes: asset.fileSize ?? 0,
                sizeLabel: asset.fileSize ? `${(asset.fileSize / 1024).toFixed(1)} KB` : "Không rõ",
                localUri: asset.uri,
              },
            ]);
          }
        },
      },
      {
        text: "Mở Camera",
        onPress: async () => {
          const permission = await ImagePicker.requestCameraPermissionsAsync();
          if (permission.granted) {
            const result = await ImagePicker.launchCameraAsync({
              allowsEditing: false,
              quality: 0.8,
            });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              const asset = result.assets[0];
              const name = asset.fileName || `photo-${Date.now()}.jpg`;
              setAttachments((prev) => [
                ...prev,
                {
                  id: `img-${Date.now()}`,
                  name,
                  type: "image" as const,
                  sizeBytes: asset.fileSize ?? 0,
                  sizeLabel: asset.fileSize ? `${(asset.fileSize / 1024).toFixed(1)} KB` : "Không rõ",
                  localUri: asset.uri,
                },
              ]);
            }
          } else {
            showAlert("Lỗi", "Cần cấp quyền Camera để chụp ảnh.");
          }
        },
      },
      { text: "Hủy", style: "cancel" },
    ]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const uploadAttachmentToCloudinary = async (att: {
    name: string;
    type: "file" | "image";
    sizeBytes?: number;
    localUri?: string;
  }) => {
    if (!att.localUri) return null;
    const uri = att.localUri;
    const fileName = att.name || (att.type === "image" ? `image_${Date.now()}.jpg` : `file_${Date.now()}`);
    const mimeType = att.type === "image" ? "image/jpeg" : "application/octet-stream";

    let base64 = "";
    try {
      const file = new File(uri);
      base64 = await file.base64();
    } catch {
      const fs = await import("expo-file-system");
      if (fs.readAsStringAsync) {
        base64 = await fs.readAsStringAsync(uri, { encoding: "base64" as any });
      }
    }

    if (base64) {
      const dataUri = base64.startsWith("data:") ? base64 : `data:${mimeType};base64,${base64}`;
      const uploadRes = await kanbanMedia.upload({
        file: dataUri,
        fileName,
        mimeType,
        size: att.sizeBytes || Math.round((base64.length * 3) / 4),
      });
      if (uploadRes.url) {
        return {
          name: fileName,
          type: att.type,
          url: uploadRes.url,
          size: att.sizeBytes ?? 0,
        };
      }
    }
    return null;
  };

  const handleCreatePost = async () => {
    if (!newContent.trim() && attachments.length === 0) {
      showAlert("Thông báo", "Vui lòng nhập nội dung bài viết hoặc chọn tệp đính kèm.");
      return;
    }
    setPosting(true);
    try {
      const uploadedAttachments: { name: string; type: string; url: string; size: number }[] = [];

      // 1. Tải toàn bộ tệp và ảnh lên Cloudinary để mọi thiết bị và Website đều xem được
      if (attachments.length > 0) {
        for (const att of attachments) {
          try {
            const uploaded = await uploadAttachmentToCloudinary(att);
            if (uploaded) {
              uploadedAttachments.push(uploaded);
            } else if (att.localUri && (att.localUri.startsWith("http://") || att.localUri.startsWith("https://"))) {
              uploadedAttachments.push({
                name: att.name,
                type: att.type,
                url: att.localUri,
                size: att.sizeBytes ?? 0,
              });
            }
          } catch (uploadErr) {
            console.warn("[BlogScreen] Tải tệp lên Cloudinary thất bại:", uploadErr);
          }
        }
      }

      // 2. Tạo bài viết với các đường dẫn đám mây công khai
      await blog.createPost({
        title: newTitle.trim() || undefined,
        content: newContent.trim(),
        tags: [selectedTag],
        attachments: uploadedAttachments,
      });

      showAlert("Thành công", "Đã đăng bài viết mới lên Kênh Blog cho toàn hệ thống!");
      setNewTitle("");
      setNewContent("");
      setAttachments([]);
      setShowTitleInput(false);
      setIsPinned(false);
      await loadBlogData();
      // Scroll to bottom to show the newly posted item
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 300);
    } catch (error: any) {
      showAlert("Lỗi", error?.message || "Không thể đăng bài viết. Vui lòng thử lại.");
    } finally {
      setPosting(false);
    }
  };

  const handleDeletePost = (postId: string) => {
    showAlert("Xác nhận xóa", "Bạn có chắc chắn muốn xóa bài viết này khỏi Kênh Blog?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa bài",
        style: "destructive",
        onPress: async () => {
          try {
            await blog.deletePost(postId);
            setPosts((prev) => prev.filter((p) => p.id !== postId));
            showAlert("Thông báo", "Đã xóa bài viết thành công!");
          } catch {
            showAlert("Lỗi", "Không thể xóa bài viết.");
          }
        },
      },
    ]);
  };

  const handleTogglePin = async (postId: string) => {
    try {
      await blog.togglePinPost(postId);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, isPinned: !p.isPinned } : p)),
      );
    } catch {
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, isPinned: !p.isPinned } : p)),
      );
    }
  };

  const handleLogout = () => {
    showAlert("Đăng xuất", "Bạn có chắc chắn muốn đăng xuất và trở về màn hình đăng nhập không?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          try {
            await logout();
            router.replace("/login");
          } catch {
            router.replace("/login");
          }
        },
      },
    ]);
  };

  const handleInputFocus = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  const handleOpenLink = (url: string) => {
    try {
      void Linking.openURL(url);
    } catch {
      Alert.alert("Thông báo", `Mở liên kết: ${url}`);
    }
  };

  const handleSharePost = async (post: BlogPost) => {
    try {
      const title = post.title ? `📢 [${post.title}]\n\n` : "📢 [Bản tin LuxCare]\n\n";
      const author = post.authorName ? `\n\n👤 Tác giả: ${post.authorName}` : "";
      const channel = post.channelName ? `\n🏷️ Kênh: ${post.channelName}` : "";
      const atts = (post.attachments || [])
        .map((a) => (a.url ? `📎 ${a.name}: ${a.url}` : `📎 ${a.name}`))
        .join("\n");
      const attSection = atts ? `\n\n${atts}` : "";
      const message = `${title}${post.content}${attSection}${author}${channel}\n🏥 LuxCare Medical System`;

      await Share.share(
        {
          title: post.title || "Bản tin LuxCare",
          message,
        },
        {
          dialogTitle: "Chia sẻ bản tin LuxCare",
        }
      );
    } catch (err: any) {
      console.warn("Lỗi khi chia sẻ bài viết:", err?.message || err);
    }
  };

  const shareMediaOrFile = async (url: string, fileName?: string) => {
    if (!url || isSharingRef.current) return;
    isSharingRef.current = true;
    try {
      let shareUri = url;
      // If remote, download to cache directory so Sharing.shareAsync can open the system file share sheet
      if (url.startsWith("http://") || url.startsWith("https://")) {
        try {
          const ext = url.split("?")[0].split(".").pop() || "dat";
          const safeName = fileName
            ? fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
            : `shared_${Date.now()}.${ext}`;
          const localPath = `${FileSystem.cacheDirectory}${safeName}`;
          const res = await FileSystem.downloadAsync(url, localPath);
          if (res && res.status === 200) {
            shareUri = res.uri;
          }
        } catch (dlErr) {
          console.warn("Download cache failed, falling back to URL share:", dlErr);
        }
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare && shareUri.startsWith("file://")) {
        await Sharing.shareAsync(shareUri, {
          dialogTitle: fileName ? `Chia sẻ ${fileName}` : "Chia sẻ tệp",
        });
      } else {
        await Share.share(
          {
            title: fileName || "Chia sẻ tệp",
            message: fileName ? `${fileName}\n${url}` : url,
          },
          {
            dialogTitle: "Chia sẻ tệp sang ứng dụng khác",
          }
        );
      }
    } catch (err: any) {
      console.warn("Lỗi chia sẻ tệp:", err?.message || err);
    } finally {
      isSharingRef.current = false;
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
    <ImageBackground
      source={require("../../public/blog-bg.png")}
      style={styles.backgroundImageContainer}
      resizeMode="cover"
    >
      <SafeAreaView edges={["top", "bottom"]} style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        {/* Header Bar */}
        <View style={styles.header}>
          {/* Channel Selector Trigger */}
          <Pressable
            style={({ pressed }) => [styles.channelTitleBtn, pressed && { opacity: 0.8 }]}
            onPress={() => setChannelModalVisible(true)}
          >
            <Ionicons name={selectedChannel.icon as any} size={15} color="#000000" />
            <Text style={styles.channelTitleText} numberOfLines={1}>
              {selectedChannel.name}
            </Text>
          </Pressable>

          {/* Right Action Controls: Search icon & Logout button to return to login screen */}
          <View style={styles.headerRightActions}>
            <Pressable
              style={styles.headerIconBtn}
              onPress={() => setSearchBarVisible(!searchBarVisible)}
              hitSlop={6}
            >
              <Ionicons name="search-outline" size={20} color="#000000" />
            </Pressable>

            {/* Logout icon button */}
            <Pressable
              style={({ pressed }) => [styles.logoutHeaderBtn, pressed && { opacity: 0.7 }]}
              onPress={handleLogout}
              hitSlop={6}
            >
              <Ionicons name="log-out-outline" size={20} color="#000000" />
            </Pressable>
          </View>
        </View>

        {/* Search Bar Input (Toggleable) */}
        {searchBarVisible && (
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color="#000000" style={{ marginRight: 8 }} />
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
                <Ionicons name="close-circle" size={16} color="#000000" />
              </Pressable>
            ) : null}
          </View>
        )}

        {/* Top Pinned Announcement Banner */}
        {bannerVisible && (
          <Pressable
            style={styles.pinnedBanner}
            onPress={() => {
              if (pinnedPosts.length > 0) {
                setPinnedModalVisible(true);
              } else {
                showAlert(
                  "Thông báo tin ghim",
                  "Hiện chưa có bài viết nào được ghim. Biên tập viên có thể ấn giữ bài viết bất kỳ để ghim bài viết lên đầu trang.",
                );
              }
            }}
          >
            <View style={styles.pinnedLeft}>
              <PinIcon size={15} color="#92400e" style={styles.pinnedIcon} />
              <Text style={styles.pinnedText} numberOfLines={1}>
                <Text style={{ fontWeight: "800", color: "#92400e" }}>
                  Tin ghim {pinnedPosts.length > 0 ? `(${pinnedPosts.length}): ` : ": "}
                </Text>
                {pinnedPosts.length > 0
                  ? (pinnedPosts[0].title || pinnedPosts[0].content)
                  : "Chưa có tin ghim. BTV ấn giữ bài viết bất kỳ để ghim bài."}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color="#92400e" />
          </Pressable>
        )}

        {/* Timeline Feed ScrollView */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.feedScrollView}
          contentContainerStyle={styles.feedContentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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
              <Ionicons name="newspaper-outline" size={44} color="#000000" />
              <Text style={styles.emptyTitle}>Chưa có bài viết nào</Text>
              <Text style={styles.emptySub}>
                Hiện chưa có bản tin hoặc thông báo nào trong chuyên mục "{selectedChannel.name}".
              </Text>
            </View>
          ) : (
            /* Posts Feed List */
            filteredPosts.map((post) => {
              const isUrl = post.content.startsWith("http://") || post.content.startsWith("https://");

              return (
                <Pressable
                  key={post.id}
                  style={styles.postCard}
                  onLayout={(e) => {
                    postLayouts.current[post.id] = e.nativeEvent.layout.y;
                  }}
                  delayLongPress={280}
                  onLongPress={() => handleLongPressPost(post)}
                >
                  {/* Card Header */}
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
                        {post.isPinned && (
                          <View style={styles.pinnedBadgeRow}>
                            <PinIcon size={11} color="#92400e" />
                            <Text style={styles.pinnedBadgeText}>Tin ghim</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.postTime}>{post.createdAt}</Text>
                    </View>

                    {/* Editor Extra Controls: Pin & Delete */}
                    {isEditor && (
                      <View style={styles.editorPostActions}>
                        <Pressable
                          style={styles.editorActionBtn}
                          onPress={() => void handleTogglePin(post.id)}
                          hitSlop={6}
                        >
                          <Ionicons
                            name={post.isPinned ? "push" : "push-outline"}
                            size={16}
                            color="#000000"
                          />
                        </Pressable>
                        <Pressable
                          style={styles.editorActionBtn}
                          onPress={() => handleDeletePost(post.id)}
                          hitSlop={6}
                        >
                          <Ionicons name="trash-outline" size={16} color="#000000" />
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {/* Optional Title */}
                  {post.title && <Text style={styles.articleTitle}>{post.title}</Text>}

                  {/* Post Content with clickable links */}
                  {(() => {
                    const trimmed = (post.content || "").trim();
                    const isPureUrl =
                      (trimmed.startsWith("http://") || trimmed.startsWith("https://")) &&
                      !trimmed.includes(" ") &&
                      !trimmed.includes("\n");

                    if (isPureUrl) {
                      return (
                        <Pressable
                          style={styles.urlBox}
                          onPress={() => handleOpenLink(trimmed)}
                        >
                          <Ionicons name="link-outline" size={16} color="#000000" />
                          <Text style={styles.urlText} numberOfLines={2}>
                            {trimmed}
                          </Text>
                        </Pressable>
                      );
                    }

                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const parts = post.content.split(urlRegex);

                    return (
                      <Text style={styles.postContentText}>
                        {parts.map((part, index) => {
                          if (part.match(/^https?:\/\//i)) {
                            return (
                              <Text
                                key={index}
                                style={styles.inlineLinkText}
                                onPress={() => handleOpenLink(part)}
                              >
                                {part}
                              </Text>
                            );
                          }
                          return part;
                        })}
                      </Text>
                    );
                  })()}

                  {/* Inline Images with tap-to-zoom + share button */}
                  {post.attachments?.filter((att: BlogAttachment) => att.type === "image" && att.url).map((att: BlogAttachment) => {
                    const shareImage = () => {
                      void shareMediaOrFile(att.url, att.name || "hinh_anh.jpg");
                    };
                    return (
                      <Pressable key={att.id} style={styles.inlineImageWrap} onPress={() => setViewImageUrl(att.url || null)}>
                        <Image
                          source={{ uri: att.url }}
                          style={styles.inlineImage}
                          resizeMode="cover"
                        />
                        {/* Expand icon — top left */}
                        <View style={styles.imageExpandBadge}>
                          <Ionicons name="expand-outline" size={13} color="#ffffff" />
                        </View>
                        {/* Share overlay button — bottom right */}
                        <Pressable
                          style={styles.imageDownloadBtn}
                          hitSlop={6}
                          onPress={(e) => { e.stopPropagation?.(); void shareImage(); }}
                        >
                          <Ionicons name="share-social-outline" size={15} color="#ffffff" />
                        </Pressable>
                      </Pressable>
                    );
                  })}

                  {/* File Attachments (non-image) */}
                  {post.attachments?.filter((att: BlogAttachment) => att.type !== "image").map((att: BlogAttachment) => {
                    const shareOrOpenFile = () => {
                      void shareMediaOrFile(att.url || "", att.name);
                    };
                    return (
                      <View key={att.id} style={styles.webFileCard}>
                        <View style={styles.webFileIconWrap}>
                          <Ionicons name="document-text" size={20} color="#000000" />
                        </View>
                        <View style={styles.webFileMeta}>
                          <Text style={styles.webFileName} numberOfLines={1}>
                            {att.name}
                          </Text>
                          <Text style={styles.webFileSize}>{att.size || ""}</Text>
                        </View>
                        {/* Share / Open button */}
                        <Pressable
                          style={styles.webDownloadBtn}
                          onPress={() => void shareOrOpenFile()}
                        >
                          <Ionicons name="share-social-outline" size={14} color="#000000" />
                          <Text style={styles.webDownloadText}>Chia sẻ</Text>
                        </Pressable>
                      </View>
                    );
                  })}

                  {/* Footer Row: Tag + Actions (Like & Share) */}
                  <View style={styles.postCardFooter}>
                    <View style={styles.tagBadge}>
                      <Text style={styles.tagBadgeText}>#{post.channelName || "Thông báo"}</Text>
                    </View>

                    <View style={styles.footerActionsRight}>
                      <Pressable
                        style={styles.likeBtn}
                        onPress={() => void handleToggleReaction(post.id, "❤️")}
                      >
                        <Ionicons
                          name={post.reactions?.[0]?.userReacted ? "heart" : "heart-outline"}
                          size={16}
                          color={post.reactions?.[0]?.userReacted ? "#dc2626" : "#000000"}
                        />
                        <Text style={[styles.likeBtnText, post.reactions?.[0]?.userReacted && { color: "#dc2626" }]}>
                          Thích {post.reactions?.[0]?.count ? `(${post.reactions[0].count})` : ""}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={styles.sharePostBtn}
                        onPress={() => void handleSharePost(post)}
                      >
                        <Ionicons name="share-social-outline" size={16} color="#000000" />
                        <Text style={styles.sharePostBtnText}>Chia sẻ</Text>
                      </Pressable>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* BOTTOM COMPOSER OR READ-ONLY BANNER */}
        {isEditor ? (
          /* Editor Bottom Composer Bar (Clean Light Theme - 3 Buttons Only) */
          <View style={styles.lightComposerContainer}>
            {/* Top Toolbar Action Row */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.lightComposerToolbar}
            >
              {/* Toggle Title Input */}
              <Pressable
                style={[styles.lightToolBtn, showTitleInput && styles.lightToolBtnActive]}
                onPress={() => setShowTitleInput(!showTitleInput)}
              >
                <Ionicons
                  name={showTitleInput ? "checkmark-circle" : "add-circle-outline"}
                  size={15}
                  color="#000000"
                />
                <Text style={styles.lightToolBtnText}>
                  {showTitleInput ? "Đã mở tiêu đề" : "Thêm tiêu đề"}
                </Text>
              </Pressable>

              {/* Attach File */}
              <Pressable style={styles.lightToolBtn} onPress={handlePickDocument}>
                <Ionicons name="attach" size={16} color="#000000" />
                <Text style={styles.lightToolBtnText}>Đính kèm</Text>
              </Pressable>

              {/* Attach Image */}
              <Pressable style={styles.lightToolBtn} onPress={handlePickImage}>
                <Ionicons name="image-outline" size={16} color="#000000" />
                <Text style={styles.lightToolBtnText}>Hình ảnh</Text>
              </Pressable>
            </ScrollView>

            {/* Title Input (if toggled) */}
            {showTitleInput && (
              <View style={styles.lightTitleWrap}>
                <TextInput
                  value={newTitle}
                  onChangeText={setNewTitle}
                  onFocus={handleInputFocus}
                  placeholder="Nhập tiêu đề bài viết..."
                  placeholderTextColor="#94a3b8"
                  style={styles.lightTitleInput}
                />
              </View>
            )}

            {/* Attached Files List Preview */}
            {attachments.length > 0 && (
              <View style={styles.attachedPreviewRow}>
                {/* Image thumbnails */}
                {attachments.filter((att) => att.type === "image" && att.localUri).map((att) => (
                  <View key={att.id} style={styles.attachedImageThumb}>
                    <Image
                      source={{ uri: att.localUri }}
                      style={{ width: "100%", height: "100%", borderRadius: 8 }}
                      resizeMode="cover"
                    />
                    <Pressable
                      style={styles.attachedThumbRemove}
                      onPress={() => removeAttachment(att.id)}
                    >
                      <Ionicons name="close-circle" size={18} color="#ffffff" />
                    </Pressable>
                  </View>
                ))}
                {/* File pills */}
                {attachments.filter((att) => att.type !== "image").map((att) => (
                  <View key={att.id} style={styles.attachedPillLight}>
                    <Ionicons name="document-text" size={13} color="#000000" />
                    <Text style={styles.attachedPillTextLight} numberOfLines={1}>
                      {att.name}
                    </Text>
                    <Pressable onPress={() => removeAttachment(att.id)}>
                      <Ionicons name="close-circle" size={14} color="#000000" />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Main Input Text Area & Circular Green Send Button */}
            <View style={styles.lightInputRow}>
              <TextInput
                value={newContent}
                onChangeText={setNewContent}
                onFocus={handleInputFocus}
                placeholder="Soạn bài viết hoặc tin nhắn thông báo..."
                placeholderTextColor="#94a3b8"
                style={styles.lightMainInput}
                multiline
                numberOfLines={2}
              />

              <Pressable
                style={[
                  styles.lightSendBtn,
                  (!newContent.trim() || posting) && styles.lightSendBtnDisabled,
                ]}
                onPress={() => void handleCreatePost()}
                disabled={!newContent.trim() || posting}
              >
                {posting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="send" size={16} color="#ffffff" style={{ marginLeft: 2 }} />
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          /* Soft Sky Blue Read-Only Footer Banner for Non-Editors */
          <View style={styles.readOnlyBlueFooter}>
            <View style={styles.readOnlyLeftCol}>
              <View style={styles.readOnlyTitleRow}>
                <Ionicons name="lock-closed" size={14} color="#000000" />
                <Text style={styles.readOnlyTitle}>Chế độ chỉ xem (Read-only Channel)</Text>
              </View>
              <Text style={styles.readOnlySubText}>
                Chỉ tài khoản Ban biên tập / Tác giả đặc biệt mới có quyền gửi bài viết & tin nhắn trong kênh này.
              </Text>
            </View>

            <View style={styles.readOnlyLockTag}>
              <Ionicons name="lock-closed-outline" size={13} color="#000000" />
              <Text style={styles.readOnlyLockTagText}>Quyền gửi bị khóa</Text>
            </View>
          </View>
        )}

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
                  <Ionicons name="close" size={20} color="#000000" />
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
                          color="#000000"
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

        {/* Pinned Posts List Modal */}
        <Modal
          visible={pinnedModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPinnedModalVisible(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setPinnedModalVisible(false)}>
            <Pressable style={styles.pinnedModalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.pinnedModalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <PinIcon size={18} color="#92400e" />
                  <Text style={styles.pinnedModalTitle}>
                    Danh sách tin ghim ({pinnedPosts.length})
                  </Text>
                </View>
                <Pressable onPress={() => setPinnedModalVisible(false)} hitSlop={8}>
                  <Ionicons name="close" size={20} color="#000000" />
                </Pressable>
              </View>

              {pinnedPosts.length === 0 ? (
                <View style={styles.pinnedEmptyWrap}>
                  <Ionicons name="notifications-off-outline" size={36} color="#000000" />
                  <Text style={styles.pinnedEmptyText}>Chưa có bài viết nào được ghim.</Text>
                </View>
              ) : (
                <FlatList
                  data={pinnedPosts}
                  keyExtractor={(item) => item.id}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingVertical: 4 }}
                  renderItem={({ item }) => (
                    <Pressable
                      style={({ pressed }) => [styles.pinnedItemCard, pressed && { opacity: 0.8 }]}
                      onPress={() => jumpToPost(item.id)}
                    >
                      <View style={styles.pinnedItemHeader}>
                        <Text style={styles.pinnedItemAuthor}>{item.authorName}</Text>
                        <Text style={styles.pinnedItemTime}>{item.createdAt}</Text>
                      </View>

                      {item.title ? <Text style={styles.pinnedItemTitle}>{item.title}</Text> : null}
                      <Text style={styles.pinnedItemSnippet} numberOfLines={2}>
                        {item.content}
                      </Text>

                      <View style={styles.pinnedItemJumpRow}>
                        <Text style={styles.pinnedItemJumpText}>Bấm để nhảy đến bài viết</Text>
                        <Ionicons name="arrow-forward-circle" size={16} color="#000000" />
                      </View>
                    </Pressable>
                  )}
                />
              )}
            </Pressable>
          </Pressable>
        </Modal>

        {/* Custom Rounded Alert Modal */}
        <Modal
          visible={alertState.visible}
          transparent
          animationType="fade"
          onRequestClose={closeAlert}
        >
          <Pressable style={styles.alertOverlay} onPress={closeAlert}>
            <Pressable style={styles.alertCard} onPress={(e) => e.stopPropagation()}>
              {/* Header Row: Title + X close button */}
              <View style={styles.alertHeaderRow}>
                <Text style={styles.alertTitleText}>{alertState.title}</Text>
                <Pressable
                  onPress={closeAlert}
                  hitSlop={8}
                  style={({ pressed }) => [styles.alertCloseBtn, pressed && { opacity: 0.6 }]}
                >
                  <Ionicons name="close" size={20} color="#000000" />
                </Pressable>
              </View>

              {/* Message (only if present and not empty) */}
              {!!alertState.message && (
                <Text style={styles.alertMessageText}>{alertState.message}</Text>
              )}

              {/* Action List - vertical cards */}
              <View style={styles.alertActionList}>
                {alertState.buttons?.map((btn, idx) => {
                  const isCancel = btn.style === "cancel";
                  const isDestructive = btn.style === "destructive";

                  // Cancel button rendered as separate footer X row
                  if (isCancel) return null;

                  return (
                    <Pressable
                      key={idx}
                      style={({ pressed }) => [
                        styles.alertListItem,
                        isDestructive && styles.alertListItemDestructive,
                        pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] },
                      ]}
                      onPress={() => {
                        closeAlert();
                        if (btn.onPress) btn.onPress();
                      }}
                    >
                      <Text
                        style={[
                          styles.alertListItemText,
                          isDestructive && { color: "#dc2626" },
                        ]}
                      >
                        {btn.text}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color="#000000" />
                    </Pressable>
                  );
                })}
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Fullscreen Image Viewer Modal */}
        <Modal
          visible={!!viewImageUrl}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setViewImageUrl(null)}
        >
          <View style={styles.imageViewerOverlay}>
            {viewImageUrl && (
              <Image
                source={{ uri: viewImageUrl }}
                style={styles.imageViewerFull}
                resizeMode="contain"
              />
            )}
            {/* Close button */}
            <Pressable
              style={styles.imageViewerClose}
              onPress={() => setViewImageUrl(null)}
            >
              <Ionicons name="close" size={24} color="#ffffff" />
            </Pressable>
            {/* Share button */}
            <Pressable
              style={styles.imageViewerShare}
              onPress={() => {
                if (viewImageUrl) void shareMediaOrFile(viewImageUrl, "hinh_anh.jpg");
              }}
            >
              <Ionicons name="share-social-outline" size={22} color="#ffffff" />
            </Pressable>
          </View>
        </Modal>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  /* CUSTOM ROUNDED ALERT MODAL STYLES */
  alertOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  alertCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  alertHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  alertCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  alertTitleText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    flex: 1,
  },
  alertMessageText: {
    fontSize: 13,
    color: "#64748b",
    fontFamily: "Inter-Regular",
    lineHeight: 19,
    marginBottom: 14,
    marginTop: 4,
  },
  alertActionList: {
    flexDirection: "column",
    gap: 8,
    marginTop: 10,
  },
  alertListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  alertListItemDestructive: {
    borderColor: "#fca5a5",
    backgroundColor: "#fff5f5",
  },
  alertListItemText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    flex: 1,
  },
  /* keep old keys to avoid unused style warnings */
  alertIconCircle: { display: "none" } as any,
  alertActionsRow: { display: "none" } as any,
  alertActionBtn: { display: "none" } as any,
  alertActionBtnPrimary: { display: "none" } as any,
  alertActionBtnCancel: { display: "none" } as any,
  alertActionBtnDestructive: { display: "none" } as any,
  alertActionBtnText: { display: "none" } as any,
  alertActionBtnTextPrimary: { display: "none" } as any,
  alertActionBtnTextCancel: { display: "none" } as any,
  alertActionBtnTextDestructive: { display: "none" } as any,

  /* INLINE IMAGE STYLES */
  inlineImageWrap: {
    marginTop: 8,
    borderRadius: 12,
    overflow: "hidden",
  },
  inlineImage: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  imageDownloadBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  imageExpandBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  /* FULLSCREEN IMAGE VIEWER */
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageViewerFull: {
    width: "100%",
    height: "100%",
  },
  imageViewerClose: {
    position: "absolute",
    top: 50,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 22,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  imageViewerShare: {
    position: "absolute",
    bottom: 48,
    right: 24,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 22,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },

  /* COMPOSER IMAGE THUMBNAIL */
  attachedImageThumb: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    marginRight: 8,
    marginBottom: 4,
    position: "relative",
  },
  attachedThumbRemove: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 10,
  },
  attachedPreviewRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  attachedPillLight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: 200,
  },
  attachedPillTextLight: {
    fontSize: 12,
    color: "#1d4ed8",
    fontFamily: "Inter-Medium",
    flex: 1,
  },

  backgroundImageContainer: {
    flex: 1,
    width: "100%",
    height: "100%",
    backgroundColor: "#ecfdf5",
  },
  safeArea: {
    flex: 1,
    backgroundColor: "transparent",
  },
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "transparent",
    paddingHorizontal: 4,
    paddingVertical: 6,
    marginHorizontal: 12,
    marginTop: 4,
    borderRadius: 18,
    borderWidth: 0,
  },
  backBtn: {
    padding: 4,
  },
  channelTitleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  channelTitleText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtn: {
    padding: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  logoutHeaderBtn: {
    padding: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
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
    backgroundColor: "#fef3c7", // Vàng hổ phách mật ong sang trọng, ấm áp, khác biệt hoàn toàn với xanh/trắng/cam
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#fde68a",
    shadowColor: "#92400e",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  pinnedLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  pinnedIcon: {
    marginRight: 2,
  },
  pinnedText: {
    fontSize: 12,
    color: "#78350f",
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
    backgroundColor: "#ecfdf5", // Xanh lá mint nhạt chuẩn LuxCare, đục 100% không bị xuyên background giúp chữ đen nét và dễ đọc
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: "#059669", // Tô màu viền xanh ngọc bắt mắt
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
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
    backgroundColor: "#059669",
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
    color: "#0f172a", // Chữ đen
    fontFamily: "Inter-Bold",
  },
  editorRoleBadge: {
    backgroundColor: "#d1fae5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  editorRoleBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#065f46",
    fontFamily: "Inter-Bold",
  },
  postTime: {
    fontSize: 11,
    color: "#047857",
    fontFamily: "Inter-Regular",
    marginTop: 2,
  },
  editorPostActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  editorActionBtn: {
    padding: 4,
    backgroundColor: "#ffffff",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  articleTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    color: "#0f172a", // Chữ đen
    fontFamily: "Inter-Bold",
    marginBottom: 6,
    lineHeight: 20,
  },
  postContentText: {
    fontSize: 13,
    color: "#0f172a", // Chữ đen
    lineHeight: 20,
    fontFamily: "Inter-Regular",
    marginBottom: 10,
  },
  urlBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: 8,
    gap: 6,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  urlText: {
    flex: 1,
    fontSize: 12.5,
    color: "#047857",
    fontFamily: "Inter-Medium",
  },
  webFileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  webFileIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#d1fae5",
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
    backgroundColor: "#d1fae5",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  webDownloadText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#065f46",
    fontFamily: "Inter-Bold",
  },
  postCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#a7f3d0",
  },
  tagBadge: {
    backgroundColor: "#d1fae5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  tagBadgeText: {
    fontSize: 11,
    color: "#065f46",
    fontFamily: "Inter-Medium",
    fontWeight: "700",
  },
  footerActionsRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
    color: "#0f172a", // Chữ đen
    fontFamily: "Inter-Medium",
  },
  sharePostBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sharePostBtnText: {
    fontSize: 12,
    color: "#0f172a", // Chữ đen
    fontFamily: "Inter-Medium",
  },

  /* LIGHT BRIGHT WHITE EDITOR COMPOSER BAR */
  lightComposerContainer: {
    backgroundColor: "#ecfdf5",
    marginHorizontal: 10,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#059669", // Tô màu viền bắt mắt
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  lightComposerToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
  },
  lightToolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "transparent", // Không tô nền
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#059669", // Chỉ tô màu viền bắt mắt
  },
  lightToolBtnActive: {
    backgroundColor: "transparent",
    borderColor: "#047857",
  },
  lightToolBtnText: {
    fontSize: 12,
    color: "#0f172a", // Chữ đen, không tô màu
    fontFamily: "Inter-Medium",
  },
  lightTopicDivider: {
    width: 1,
    height: 18,
    backgroundColor: "#cbd5e1",
    marginHorizontal: 4,
  },
  lightTopicRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lightTopicLabel: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Inter-Medium",
  },
  lightTagPill: {
    backgroundColor: "transparent",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
  },
  lightTagPillActive: {
    backgroundColor: "transparent",
    borderColor: "#059669",
  },
  lightTagPillText: {
    fontSize: 11.5,
    color: "#0f172a",
    fontFamily: "Inter-Medium",
  },
  lightTagPillTextActive: {
    color: "#0f172a",
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  lightTitleWrap: {
    marginBottom: 8,
  },
  lightTitleInput: {
    backgroundColor: "transparent", // Không tô nền
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#059669", // Chỉ tô màu viền bắt mắt
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    color: "#0f172a", // Chữ đen
    fontFamily: "Inter-Medium",
  },
  lightInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent", // Không tô nền
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#059669", // Chỉ tô màu viền bắt mắt
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
  lightMainInput: {
    flex: 1,
    fontSize: 13,
    color: "#0f172a",
    fontFamily: "Inter-Regular",
    maxHeight: 80,
    paddingVertical: 6,
  },
  lightSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#008852",
    alignItems: "center",
    justifyContent: "center",
  },
  lightSendBtnDisabled: {
    backgroundColor: "#cbd5e1",
    opacity: 0.6,
  },

  /* READ-ONLY BANNER FOR REGULAR USERS */
  readOnlyBlueFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f0f9ff",
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bae6fd",
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

  /* MODAL OVERLAY & CHANNEL SELECTOR */
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
  /* PINNED POSTS MODAL STYLES */
  pinnedModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 16,
    maxHeight: 480,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  pinnedModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  pinnedModalTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  pinnedEmptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    gap: 8,
  },
  pinnedEmptyText: {
    fontSize: 13,
    color: "#64748b",
    fontFamily: "Inter-Medium",
  },
  pinnedItemCard: {
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  pinnedItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  pinnedItemAuthor: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#92400e",
    fontFamily: "Inter-Bold",
  },
  pinnedItemTime: {
    fontSize: 11,
    color: "#94a3b8",
    fontFamily: "Inter-Regular",
  },
  pinnedItemTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
    marginBottom: 2,
  },
  pinnedItemSnippet: {
    fontSize: 12.5,
    color: "#334155",
    fontFamily: "Inter-Regular",
    lineHeight: 18,
  },
  pinnedItemJumpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 8,
  },
  pinnedItemJumpText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#008852",
    fontFamily: "Inter-Bold",
  },
  pinnedBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fef3c7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  pinnedBadgeText: {
    fontSize: 10.5,
    fontWeight: "800",
    color: "#92400e",
    fontFamily: "Inter-Bold",
  },
  inlineLinkText: {
    color: "#0284c7",
    textDecorationLine: "underline",
    fontWeight: "600",
  },
});

