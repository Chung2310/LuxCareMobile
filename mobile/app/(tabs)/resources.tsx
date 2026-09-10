import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Modal,
  SafeAreaView,
  StatusBar,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Image,
  Linking,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Sharing from "expo-sharing";
import { useVideoPlayer, VideoView } from "expo-video";
import { File as FSFile, Paths } from "expo-file-system";
import { useSession } from "../../src/auth/SessionProvider";
import { resources } from "../../src/api/services";
import type { ResourceItem } from "../../../src/services/resourceService";

// ── In-App Resource Media & Document Viewer Modal ──────────────────────────────
function ResourceViewerModal({
  visible,
  item,
  onClose,
  onShare,
}: {
  visible: boolean;
  item: ResourceItem | null;
  onClose: () => void;
  onShare: (item: ResourceItem) => void;
}) {
  // ── Phân loại file ────────────────────────────────────────────────────────
  const fileUrl = item?.url || item?.uri || "";
  const isAudio = !!(item && (
    item.type === "audio" ||
    /\.(mp3|m4a|wav|aac)$/i.test(item.name)
  ));
  const isVideo = !!(item && (
    item.type === "video" ||
    /\.(mp4|mov|avi|mkv|webm)$/i.test(item.name)
  ));
  const isImage = !!(item && (
    item.type === "image" ||
    /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(item.name)
  ));
  const isLink = !!(item && (item.type === "link"));

  // ── Video player (expo-video) ─────────────────────────────────────────────
  const videoSource = isVideo ? (fileUrl || null) : null;
  const videoPlayer = useVideoPlayer(videoSource, (p) => {
    if (videoSource) {
      p.loop = false;
      p.play();
    }
  });

  // Dừng video khi modal đóng
  useEffect(() => {
    if (!visible) {
      videoPlayer.pause();
    }
  }, [visible]);

  // Reset player khi item thay đổi
  useEffect(() => {
    const src = item?.url || item?.uri || null;
    if (isVideo && src) {
      videoPlayer.replace(src);
      videoPlayer.play();
    } else {
      videoPlayer.pause();
    }
  }, [item?.id]);

  if (!item) return null;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const handleOpenInBrowser = async (url?: string) => {
    const target = url || fileUrl;
    if (!target) {
      Alert.alert("Không có liên kết", "Tài nguyên này chưa có URL để mở.");
      return;
    }
    try {
      const can = await Linking.canOpenURL(target).catch(() => false);
      if (can) {
        await Linking.openURL(target);
      } else {
        Alert.alert("Không thể mở", target);
      }
    } catch {
      Alert.alert("Lỗi", "Không thể mở liên kết này.");
    }
  };

  const handleOpenLink = () => handleOpenInBrowser(item.url || item.content || "");

  const handleShareFile = async () => {
    const localUri = item.uri;
    const remoteUrl = item.url;

    // URI local thật (file:// hoặc content://) → share trực tiếp
    if (localUri && (localUri.startsWith("file://") || localUri.startsWith("content://"))) {
      try {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(localUri);
          return;
        }
      } catch {
        // fallback bên dưới
      }
    }

    // URL server → download về cache rồi share
    const targetUrl = remoteUrl || (localUri?.startsWith("http") ? localUri : undefined);
    if (targetUrl) {
      try {
        const downloaded = await FSFile.downloadFileAsync(targetUrl, Paths.cache);
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloaded.uri);
          return;
        }
      } catch {
        // fallback: mở trong trình duyệt
      }
      await handleOpenInBrowser(targetUrl);
      return;
    }

    // Fallback cuối
    onShare(item);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={viewerStyles.container}>
        {/* Header */}
        <View style={viewerStyles.headerBar}>
          <TouchableOpacity onPress={onClose} style={viewerStyles.closeBtn}>
            <Ionicons name="chevron-down" size={24} color="#0f172a" />
          </TouchableOpacity>

          <View style={viewerStyles.headerTitleWrap}>
            <Text style={viewerStyles.headerTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={viewerStyles.headerSub}>
              {item.permission === "owner" ? "Tài nguyên của bạn" : `Được chia sẻ từ ${item.owner}`}
            </Text>
          </View>

          <TouchableOpacity onPress={handleShareFile} style={viewerStyles.shareHeaderBtn}>
            <Ionicons name="share-social-outline" size={22} color="#008852" />
          </TouchableOpacity>
        </View>

        {/* Content Viewer Body based on File Type */}
        <ScrollView contentContainerStyle={viewerStyles.scrollBody} showsVerticalScrollIndicator={false}>
          {/* 1. AUDIO PLAYER VIEW */}
          {isAudio ? (
            <View style={viewerStyles.audioCard}>
              <View style={viewerStyles.audioHeader}>
                <View style={viewerStyles.audioIconCircle}>
                  <Ionicons name="musical-notes" size={36} color="#008852" />
                </View>
                <Text style={viewerStyles.audioTitle}>{item.name}</Text>
                <Text style={viewerStyles.audioSub}>{item.size || "Audio"}</Text>
              </View>

              <View style={viewerStyles.docActionsRow}>
                {fileUrl ? (
                  <TouchableOpacity
                    style={viewerStyles.docPrimaryBtn}
                    onPress={() => handleOpenInBrowser(fileUrl)}
                  >
                    <Ionicons name="musical-note" size={18} color="#ffffff" />
                    <Text style={viewerStyles.docPrimaryBtnText}>Phát âm thanh</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[viewerStyles.docSecondaryBtn, !fileUrl && { flex: 1 }]}
                  onPress={handleShareFile}
                >
                  <Ionicons name="share-outline" size={18} color="#008852" />
                  <Text style={viewerStyles.docSecondaryBtnText}>Chia sẻ</Text>
                </TouchableOpacity>
              </View>

              {!fileUrl ? (
                <Text style={viewerStyles.noUrlHint}>
                  Tệp âm thanh này chưa có URL phát trực tuyến.
                </Text>
              ) : null}
            </View>
          ) : isVideo ? (
            /* 2. VIDEO PLAYER VIEW — dùng expo-video thật */
            <View style={viewerStyles.videoCard}>
              {fileUrl ? (
                <VideoView
                  player={videoPlayer}
                  style={viewerStyles.videoCanvas}
                  nativeControls
                  contentFit="contain"
                  allowsPictureInPicture={false}
                />
              ) : (
                <View style={[viewerStyles.videoCanvas, viewerStyles.videoPlaceholder]}>
                  <Ionicons name="videocam-outline" size={56} color="#008852" />
                  <Text style={viewerStyles.videoPlaceholderText}>Chưa có nguồn video</Text>
                </View>
              )}
              <View style={viewerStyles.videoMetaBox}>
                <Text style={viewerStyles.videoTitle}>{item.name}</Text>
                <Text style={viewerStyles.videoSub}>
                  {item.size || ""}{item.size ? " • " : ""}Cập nhật {item.updatedAt}
                </Text>
                {fileUrl ? (
                  <TouchableOpacity
                    style={viewerStyles.openExternalBtn}
                    onPress={() => handleOpenInBrowser(fileUrl)}
                  >
                    <Ionicons name="open-outline" size={14} color="#2563eb" />
                    <Text style={viewerStyles.openExternalText}> Mở </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : isImage ? (
            /* 3. IMAGE VIEWER */
            <View style={viewerStyles.imageCard}>
              <Image
                source={{ uri: item.uri || item.url || "https://picsum.photos/600/400" }}
                style={viewerStyles.fullImage}
                resizeMode="contain"
              />
            </View>
          ) : isLink ? (
            /* 4. LINK PREVIEW CARD */
            <View style={viewerStyles.linkCard}>
              <View style={viewerStyles.linkIconWrap}>
                <Ionicons name="link" size={40} color="#008852" />
              </View>
              <Text style={viewerStyles.linkTitle}>{item.name}</Text>
              <Text style={viewerStyles.linkUrlText}>{item.url || item.content}</Text>

              <TouchableOpacity style={viewerStyles.openWebBtn} onPress={handleOpenLink}>
                <Ionicons name="globe-outline" size={20} color="#ffffff" />
                <Text style={viewerStyles.openWebBtnText}>Mở ngay</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* 5. DOCUMENT / SPREADSHEET / PDF VIEWER CARD */
            <View style={viewerStyles.docCard}>
              <View
                style={[
                  viewerStyles.docIconWrap,
                  {
                    backgroundColor:
                      item.type === "spreadsheet"
                        ? "#ecfdf5"
                        : item.type === "pdf"
                        ? "#fef2f2"
                        : "#eff6ff",
                  },
                ]}
              >
                <Ionicons
                  name={
                    item.type === "spreadsheet"
                      ? "grid-outline"
                      : item.type === "pdf"
                      ? "document-text-outline"
                      : "document-outline"
                  }
                  size={48}
                  color={
                    item.type === "spreadsheet"
                      ? "#059669"
                      : item.type === "pdf"
                      ? "#dc2626"
                      : "#2563eb"
                  }
                />
              </View>

              <Text style={viewerStyles.docTitle}>{item.name}</Text>
              <Text style={viewerStyles.docSub}>
                {item.type === "spreadsheet" ? "Bảng tính Excel / CSV" : item.type === "pdf" ? "Tài liệu PDF" : "Văn bản tệp"} • {item.size || "1.5 MB"}
              </Text>

              {item.content ? (
                <View style={viewerStyles.docContentSnippet}>
                  <Text style={viewerStyles.snippetTitle}>Nội dung văn bản:</Text>
                  <Text style={viewerStyles.snippetText}>{item.content}</Text>
                </View>
              ) : null}

              <View style={viewerStyles.docActionsRow}>
                {fileUrl ? (
                  <TouchableOpacity
                    style={viewerStyles.docPrimaryBtn}
                    onPress={() => handleOpenInBrowser(fileUrl)}
                  >
                    <Ionicons name="globe-outline" size={18} color="#ffffff" />
                    <Text style={viewerStyles.docPrimaryBtnText}>Mở ngay</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={[viewerStyles.docSecondaryBtn, !fileUrl && { flex: 1, marginLeft: 0 }]}
                  onPress={handleShareFile}
                >
                  <Ionicons name="download-outline" size={18} color="#008852" />
                  <Text style={viewerStyles.docSecondaryBtnText}>Chia sẻ</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Details Table */}
          <View style={viewerStyles.detailsCard}>
            <Text style={viewerStyles.detailsCardTitle}>Thông tin chi tiết tài nguyên</Text>

            <View style={viewerStyles.detailRow}>
              <Text style={viewerStyles.detailLabel}>Tên tài nguyên:</Text>
              <Text style={viewerStyles.detailVal}>{item.name}</Text>
            </View>

            <View style={viewerStyles.detailRow}>
              <Text style={viewerStyles.detailLabel}>Loại định dạng:</Text>
              <Text style={viewerStyles.detailVal}>{item.type.toUpperCase()}</Text>
            </View>

            <View style={viewerStyles.detailRow}>
              <Text style={viewerStyles.detailLabel}>Quyền sở hữu:</Text>
              <Text style={viewerStyles.detailVal}>
                {item.permission === "owner" ? "Tài nguyên của bạn" : item.owner}
              </Text>
            </View>

            <View style={viewerStyles.detailRow}>
              <Text style={viewerStyles.detailLabel}>Kích thước tệp:</Text>
              <Text style={viewerStyles.detailVal}>{item.size || "1.2 MB"}</Text>
            </View>

            <View style={viewerStyles.detailRow}>
              <Text style={viewerStyles.detailLabel}>Lần cuối cập nhật:</Text>
              <Text style={viewerStyles.detailVal}>{item.updatedAt}</Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function ResourcesScreen() {
  const { user } = useSession();
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderHistory, setFolderHistory] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: "Kho lưu trữ của tôi" },
  ]);

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Viewer & Modals state
  const [viewingItem, setViewingItem] = useState<ResourceItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<ResourceItem | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [plusMenuVisible, setPlusMenuVisible] = useState(false);
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [trashModalVisible, setTrashModalVisible] = useState(false);

  // Active dialogs: "filePicker" | "folder" | "link" | "audio" | "note" | null
  const [activeDialog, setActiveDialog] = useState<"filePicker" | "folder" | "link" | "audio" | "note" | null>(null);

  // General Form fields
  const [formName, setFormName] = useState("");
  const [formUrlOrContent, setFormUrlOrContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Rich Note & Drawing State
  const [noteTitle, setNoteTitle] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [noteAttachedImage, setNoteAttachedImage] = useState<string | null>(null);
  const [noteMode, setNoteMode] = useState<"text" | "draw">("text");
  const [noteTextColor, setNoteTextColor] = useState("#0f172a");
  const [drawColor, setDrawColor] = useState("#008852");
  const [drawStrokeWidth, setDrawStrokeWidth] = useState(3);
  const [drawPaths, setDrawPaths] = useState<any[]>([]);

  // Voice Memo Recording State
  const [recordingTimer, setRecordingTimer] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  // Sharing form fields
  const [shareEmail, setShareEmail] = useState("");
  const [sharedList, setSharedList] = useState<string[]>(["Phòng Hành chính - Nhân sự", "Ban Giám đốc"]);

  // Fetch real data from API
  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await resources.list(user?.companyCode, search, user?.displayName);
      setItems(data);
    } catch (e: any) {
      setError(e.message || "Không thể tải danh sách tài nguyên từ máy chủ.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.companyCode, search, user?.displayName]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadData();
    }, [loadData])
  );

  const onRefresh = () => {
    setRefreshing(true);
    void loadData();
  };

  // Timer for Voice Memo
  useEffect(() => {
    let interval: any = null;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTimer((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  // Active items (not deleted)
  const activeItems = useMemo(() => {
    return items.filter((i) => !i.isDeleted);
  }, [items]);

  // Trashed items
  const trashedItems = useMemo(() => {
    return items.filter((i) => i.isDeleted);
  }, [items]);

  // Filter active items by search & current folder
  const filteredItems = useMemo(() => {
    let result = activeItems;
    if (currentFolderId) {
      result = result.filter((i) => i.parentId === currentFolderId);
    } else {
      result = result.filter((i) => !i.parentId);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.subtitle.toLowerCase().includes(q) ||
          i.owner.toLowerCase().includes(q)
      );
    }
    return result;
  }, [activeItems, search, currentFolderId]);

  // Navigation into a folder
  const handleOpenFolder = (folder: ResourceItem) => {
    setCurrentFolderId(folder.id);
    setFolderHistory((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  // Breadcrumb back navigation
  const handleNavigateBackFolder = (index: number) => {
    const target = folderHistory[index];
    setCurrentFolderId(target.id);
    setFolderHistory((prev) => prev.slice(0, index + 1));
  };

  // Action: Open in-app viewer or enter folder
  const handleItemPress = (item: ResourceItem) => {
    if (item.type === "folder") {
      handleOpenFolder(item);
    } else {
      setViewingItem(item);
    }
  };

  const handleToggleStar = (item: ResourceItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isStarred: !i.isStarred } : i))
    );
    setMenuVisible(false);
  };

  // Move item to Trash Bin
  const handleMoveToTrash = (item: ResourceItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isDeleted: true, deletedAt: "Vừa chuyển vào thùng rác" } : i))
    );
    setMenuVisible(false);
    Alert.alert("Thùng rác", `Đã chuyển tệp "${item.name}" vào Thùng rác.`);
  };

  // Restore item from Trash Bin
  const handleRestoreFromTrash = (item: ResourceItem) => {
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, isDeleted: false } : i))
    );
    Alert.alert("Khôi phục", `Đã khôi phục tệp "${item.name}" thành công.`);
  };

  // Delete item permanently
  const handleDeletePermanently = (item: ResourceItem) => {
    Alert.alert("Xóa vĩnh viễn", `Bạn có chắc chắn muốn xóa vĩnh viễn "${item.name}"? Hành động này không thể hoàn tác.`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa vĩnh viễn",
        style: "destructive",
        onPress: () => {
          setItems((prev) => prev.filter((i) => i.id !== item.id));
        },
      },
    ]);
  };

  // Empty all trash items
  const handleEmptyTrash = () => {
    if (trashedItems.length === 0) return;
    Alert.alert("Dọn sạch thùng rác", `Xóa vĩnh viễn tất cả ${trashedItems.length} tệp trong thùng rác?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Dọn sạch",
        style: "destructive",
        onPress: () => {
          setItems((prev) => prev.filter((i) => !i.isDeleted));
        },
      },
    ]);
  };

  // 1. Pick File from Device
  const handlePickFileFromDevice = async (pickerType: "document" | "media") => {
    setPlusMenuVisible(false);
    try {
      if (pickerType === "media") {
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          quality: 0.8,
        });

        if (!res.canceled && res.assets && res.assets.length > 0) {
          const asset = res.assets[0];
          const fileName = asset.fileName || `Tệp_media_${Date.now()}.${asset.type === "video" ? "mp4" : "png"}`;
          const isVideo = asset.type === "video" || fileName.endsWith(".mp4");
          const sizeKb = asset.fileSize ? `${(asset.fileSize / 1024).toFixed(0)} KB` : "2.4 MB";

          const newItem: ResourceItem = {
            id: Date.now().toString(),
            name: fileName,
            type: isVideo ? "video" : "image",
            subtitle: "Của bạn • Vừa xong",
            owner: user?.displayName || "Tôi",
            updatedAt: "Vừa xong",
            size: sizeKb,
            uri: asset.uri,
            parentId: currentFolderId,
            permission: "owner",
          };

          setItems((prev) => [newItem, ...prev]);
          Alert.alert("Thành công", `Đã tải tệp "${fileName}" lên thành công.`);
        }
      } else {
        const res = await DocumentPicker.getDocumentAsync({
          type: "*/*",
          copyToCacheDirectory: true,
        });

        if (!res.canceled && res.assets && res.assets.length > 0) {
          const doc = res.assets[0];
          const fileName = doc.name || `Tai_lieu_${Date.now()}`;
          const ext = fileName.split(".").pop()?.toLowerCase() || "";
          let fileType: ResourceItem["type"] = "document";
          if (["xls", "xlsx", "csv"].includes(ext)) fileType = "spreadsheet";
          else if (ext === "pdf") fileType = "pdf";
          else if (["mp4", "mov"].includes(ext)) fileType = "video";
          else if (["jpg", "png"].includes(ext)) fileType = "image";

          const sizeKb = doc.size ? `${(doc.size / 1024).toFixed(0)} KB` : "1.1 MB";

          const newItem: ResourceItem = {
            id: Date.now().toString(),
            name: fileName,
            type: fileType,
            subtitle: "Của bạn • Vừa xong",
            owner: user?.displayName || "Tôi",
            updatedAt: "Vừa xong",
            size: sizeKb,
            uri: doc.uri,
            parentId: currentFolderId,
            permission: "owner",
          };

          setItems((prev) => [newItem, ...prev]);
          Alert.alert("Thành công", `Đã tải tệp "${fileName}" lên thành công.`);
        }
      }
    } catch (e: any) {
      Alert.alert("Lỗi tải tệp", e.message || "Không thể chọn tệp từ thiết bị.");
    }
  };

  // 2. Create Folder
  const handleCreateFolder = () => {
    if (!formName.trim()) {
      Alert.alert("Thông báo", "Vui lòng nhập tên thư mục.");
      return;
    }
    const newFolder: ResourceItem = {
      id: Date.now().toString(),
      name: formName.trim(),
      type: "folder",
      subtitle: "Thư mục của bạn • Vừa xong",
      owner: user?.displayName || "Tôi",
      updatedAt: "Vừa xong",
      size: "Thư mục",
      parentId: currentFolderId,
      permission: "owner",
    };
    setItems((prev) => [newFolder, ...prev]);
    setFormName("");
    setActiveDialog(null);
    Alert.alert("Thành công", `Đã tạo thư mục "${newFolder.name}".`);
  };

  // 3. Add Web Link
  const handleAddLink = () => {
    if (!formName.trim() || !formUrlOrContent.trim()) {
      Alert.alert("Thông báo", "Vui lòng nhập tiêu đề và đường dẫn liên kết.");
      return;
    }
    let url = formUrlOrContent.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    const newLink: ResourceItem = {
      id: Date.now().toString(),
      name: formName.trim(),
      type: "link",
      subtitle: "Liên kết web • Vừa xong",
      owner: user?.displayName || "Tôi",
      updatedAt: "Vừa xong",
      size: "Web Link",
      url: url,
      content: url,
      parentId: currentFolderId,
      permission: "owner",
    };
    setItems((prev) => [newLink, ...prev]);
    setFormName("");
    setFormUrlOrContent("");
    setActiveDialog(null);
    Alert.alert("Thành công", `Đã lưu liên kết "${newLink.name}".`);
  };

  // 5. Save Voice Memo as MP3
  const handleSaveVoiceMemo = () => {
    if (!formName.trim()) {
      Alert.alert("Thông báo", "Vui lòng nhập tên bản ghi âm.");
      return;
    }
    const fileName = formName.trim().endsWith(".mp3") ? formName.trim() : `${formName.trim()}.mp3`;
    const duration = recordingTimer > 0 ? `${recordingTimer}s` : "15s";
    const newAudioItem: ResourceItem = {
      id: Date.now().toString(),
      name: fileName,
      type: "audio",
      subtitle: `Bản ghi âm MP3 (${duration}) • Vừa xong`,
      owner: user?.displayName || "Tôi",
      updatedAt: "Vừa xong",
      size: `${duration} • 350 KB`,
      parentId: currentFolderId,
      permission: "owner",
    };
    setItems((prev) => [newAudioItem, ...prev]);
    setFormName("");
    setIsRecording(false);
    setRecordingTimer(0);
    setActiveDialog(null);
    Alert.alert("Thành công", `Đã lưu bản ghi âm MP3 "${fileName}".`);
  };

  // Handle Share recipient
  const handleAddShareRecipient = () => {
    if (!shareEmail.trim()) return;
    setSharedList((prev) => [...prev, shareEmail.trim()]);
    setShareEmail("");
  };

  const getFileIcon = (type: ResourceItem["type"]) => {
    switch (type) {
      case "folder":
        return { icon: "folder", bg: "#ecfdf5", iconColor: "#008852" };
      case "spreadsheet":
        return { icon: "grid-outline", bg: "#ecfdf5", iconColor: "#059669" };
      case "video":
        return { icon: "film-outline", bg: "#fef2f2", iconColor: "#dc2626" };
      case "image":
        return { icon: "image-outline", bg: "#fff7ed", iconColor: "#ea580c" };
      case "pdf":
        return { icon: "document-text-outline", bg: "#fef2f2", iconColor: "#b91c1c" };
      case "link":
        return { icon: "link-outline", bg: "#f1f5f9", iconColor: "#475569" };
      case "audio":
        return { icon: "mic-outline", bg: "#ecfdf5", iconColor: "#059669" };
      case "document":
      default:
        return { icon: "document-outline", bg: "#eff6ff", iconColor: "#2563eb" };
    }
  };

  const renderItem = ({ item }: { item: ResourceItem }) => {
    const iconMeta = getFileIcon(item.type);
    const isMine = item.permission === "owner" || item.owner === user?.displayName;

    if (viewMode === "grid") {
      return (
        <TouchableOpacity style={styles.gridItemCard} activeOpacity={0.7} onPress={() => handleItemPress(item)}>
          <View style={[styles.gridIconWrap, { backgroundColor: iconMeta.bg }]}>
            <Ionicons name={iconMeta.icon as any} size={28} color={iconMeta.iconColor} />
          </View>
          <View style={styles.gridInfoWrap}>
            <Text style={styles.gridTitle} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.gridSubtitle} numberOfLines={1}>
              {item.type === "folder" ? "Thư mục" : isMine ? "Của bạn" : `Từ ${item.owner}`}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity style={styles.listItemRow} activeOpacity={0.7} onPress={() => handleItemPress(item)}>
        <View style={[styles.listIconBox, { backgroundColor: iconMeta.bg }]}>
          <Ionicons name={iconMeta.icon as any} size={20} color={iconMeta.iconColor} />
        </View>

        <View style={styles.listTextCol}>
          <View style={styles.titleRow}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.name}
            </Text>
            {item.isStarred ? <Ionicons name="star" size={14} color="#f59e0b" style={{ marginLeft: 4 }} /> : null}
            {item.isShared ? <Ionicons name="people-outline" size={14} color="#0284c7" style={{ marginLeft: 4 }} /> : null}
          </View>
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            {item.type === "folder"
              ? `📁 Thư mục • ${item.updatedAt}`
              : isMine
              ? `👥 Của bạn • ${item.updatedAt}`
              : `👥 Được chia sẻ bởi ${item.owner} • ${item.updatedAt}`}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.moreBtn}
          onPress={() => {
            setSelectedItem(item);
            setMenuVisible(true);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="ellipsis-vertical" size={18} color="#64748b" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Top Search Bar */}
      <View style={styles.searchHeaderContainer}>
        <View style={styles.searchBarBox}>
          <TouchableOpacity style={styles.menuIconBtn}>
            <Ionicons name="menu-outline" size={22} color="#64748b" />
          </TouchableOpacity>

          <TextInput
            style={styles.searchInput}
            placeholder="Tìm trong tài nguyên..."
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
          />

          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{user?.displayName?.charAt(0)?.toUpperCase() || "LX"}</Text>
          </View>
        </View>
      </View>

      {/* Folder Breadcrumbs */}
      <View style={styles.breadcrumbBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.breadcrumbContent}>
          {folderHistory.map((folder, idx) => (
            <React.Fragment key={folder.id || "root"}>
              {idx > 0 && <Ionicons name="chevron-forward" size={14} color="#94a3b8" style={{ marginHorizontal: 2 }} />}
              <TouchableOpacity
                onPress={() => handleNavigateBackFolder(idx)}
                style={[styles.breadcrumbChip, idx === folderHistory.length - 1 && styles.breadcrumbChipActive]}
              >
                <Text style={[styles.breadcrumbText, idx === folderHistory.length - 1 && styles.breadcrumbTextActive]}>
                  {folder.name}
                </Text>
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </ScrollView>
      </View>

      {/* Section Title & View Toggle & Trash Bin Bar */}
      <View style={styles.sectionControlRow}>
        <View>
          <Text style={styles.sectionControlTitle}>
            {currentFolderId ? folderHistory[folderHistory.length - 1].name : "Danh sách tài nguyên"}
          </Text>
          <Text style={styles.sectionControlSub}>
            Tài nguyên của bạn ({filteredItems.length})
          </Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {/* TRASH BIN BUTTON */}
          <TouchableOpacity
            style={styles.trashBinBtn}
            onPress={() => setTrashModalVisible(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={20} color="#dc2626" />
            {trashedItems.length > 0 ? (
              <View style={styles.trashBadge}>
                <Text style={styles.trashBadgeText}>{trashedItems.length}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <View style={styles.viewToggleContainer}>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === "list" && styles.toggleBtnActive]}
              onPress={() => setViewMode("list")}
            >
              <Ionicons name="list-outline" size={18} color={viewMode === "list" ? "#008852" : "#64748b"} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, viewMode === "grid" && styles.toggleBtnActive]}
              onPress={() => setViewMode("grid")}
            >
              <Ionicons name="grid-outline" size={18} color={viewMode === "grid" ? "#008852" : "#64748b"} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => void loadData()} style={styles.retryBtn}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Resource List / Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#008852" />
          <Text style={styles.loadingText}>Đang tải danh sách tài nguyên...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          key={viewMode}
          numColumns={viewMode === "grid" ? 2 : 1}
          renderItem={renderItem}
          contentContainerStyle={styles.listContentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#008852"]} tintColor="#008852" />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="folder-open-outline" size={48} color="#94a3b8" />
              <Text style={styles.emptyTitle}>Chưa có tài nguyên nào</Text>
              <Text style={styles.emptySub}>
                {search ? "Không tìm thấy tài nguyên phù hợp." : "Thư mục này chưa chứa tệp hoặc tài nguyên nào."}
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button (+) */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.mainFab} activeOpacity={0.85} onPress={() => setPlusMenuVisible(true)}>
          <Ionicons name="add" size={32} color="#ffffff" />
        </TouchableOpacity>
      </View>

      {/* IN-APP MEDIA & DOCUMENT VIEWER MODAL */}
      <ResourceViewerModal
        visible={!!viewingItem}
        item={viewingItem}
        onClose={() => setViewingItem(null)}
        onShare={(i) => {
          setViewingItem(null);
          setSelectedItem(i);
          setShareModalVisible(true);
        }}
      />

      {/* ── THÙNG RÁC (TRASH BIN) MODAL ────────────────────────────────────── */}
      <Modal visible={trashModalVisible} animationType="slide" onRequestClose={() => setTrashModalVisible(false)}>
        <SafeAreaView style={styles.trashContainer}>
          <View style={styles.trashHeaderBar}>
            <TouchableOpacity onPress={() => setTrashModalVisible(false)} style={{ padding: 4 }}>
              <Ionicons name="arrow-back" size={22} color="#0f172a" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.trashHeaderTitle}>Thùng rác hệ thống</Text>
              <Text style={styles.trashHeaderSub}>Tài nguyên bị xóa được lưu trữ tạm thời tại đây ({trashedItems.length})</Text>
            </View>
            {trashedItems.length > 0 ? (
              <TouchableOpacity onPress={handleEmptyTrash} style={styles.emptyTrashBtn}>
                <Ionicons name="trash" size={16} color="#ffffff" />
                <Text style={styles.emptyTrashBtnText}>Dọn sạch</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <FlatList
            data={trashedItems}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => {
              const iconMeta = getFileIcon(item.type);
              return (
                <View style={styles.trashedItemCard}>
                  <View style={[styles.listIconBox, { backgroundColor: "#fecaca" }]}>
                    <Ionicons name={iconMeta.icon as any} size={20} color="#dc2626" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.trashedTitle} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.trashedSub}>Đã xóa • {item.deletedAt || "Vừa xong"}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <TouchableOpacity
                      style={styles.restoreBtn}
                      onPress={() => handleRestoreFromTrash(item)}
                    >
                      <Ionicons name="refresh-outline" size={16} color="#008852" />
                      <Text style={styles.restoreBtnText}>Khôi phục</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deletePermBtn}
                      onPress={() => handleDeletePermanently(item)}
                    >
                      <Ionicons name="trash-outline" size={16} color="#dc2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Ionicons name="trash-bin-outline" size={54} color="#94a3b8" />
                <Text style={styles.emptyTitle}>Thùng rác trống</Text>
                <Text style={styles.emptySub}>Không có tệp hoặc tài nguyên nào trong thùng rác.</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>

      {/* PLUS (+) ACTION SHEET MODAL */}
      <Modal visible={plusMenuVisible} transparent animationType="fade" onRequestClose={() => setPlusMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPlusMenuVisible(false)}>
          <View style={styles.plusMenuCard}>
            <TouchableOpacity style={styles.plusMenuItem} onPress={() => handlePickFileFromDevice("document")}>
              <View style={styles.plusMenuIconWrap}>
                <Ionicons name="arrow-up-circle-outline" size={24} color="#008852" />
              </View>
              <Text style={styles.plusMenuText}>Tải tệp lên</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.plusMenuItem}
              onPress={() => {
                setPlusMenuVisible(false);
                setFormName("");
                setActiveDialog("folder");
              }}
            >
              <View style={styles.plusMenuIconWrap}>
                <Ionicons name="folder-outline" size={22} color="#008852" />
              </View>
              <Text style={styles.plusMenuText}>Thêm thư mục</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.plusMenuItem}
              onPress={() => {
                setPlusMenuVisible(false);
                setFormName("");
                setFormUrlOrContent("https://");
                setActiveDialog("link");
              }}
            >
              <View style={styles.plusMenuIconWrap}>
                <Ionicons name="link-outline" size={22} color="#64748b" />
              </View>
              <Text style={styles.plusMenuText}>Thêm liên kết</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.plusMenuItem}
              onPress={() => {
                setPlusMenuVisible(false);
                setFormName("Ghi âm " + new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }));
                setIsRecording(false);
                setRecordingTimer(0);
                setActiveDialog("audio");
              }}
            >
              <View style={styles.plusMenuIconWrap}>
                <Ionicons name="mic-outline" size={22} color="#059669" />
              </View>
              <Text style={styles.plusMenuText}>Thêm ghi âm</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* DIALOG 2: Create Folder */}
      <Modal visible={activeDialog === "folder"} transparent animationType="slide" onRequestClose={() => setActiveDialog(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.createModalCard}>
            <View style={styles.createModalHeader}>
              <Text style={styles.createModalTitle}>Thêm thư mục mới</Text>
              <TouchableOpacity onPress={() => setActiveDialog(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Tên thư mục *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nhập tên thư mục..."
              placeholderTextColor="#94a3b8"
              value={formName}
              onChangeText={setFormName}
            />

            <View style={styles.modalFooterBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveDialog(null)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleCreateFolder}>
                <Text style={styles.submitBtnText}>Tạo thư mục</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DIALOG 3: Add Web Link */}
      <Modal visible={activeDialog === "link"} transparent animationType="slide" onRequestClose={() => setActiveDialog(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.createModalCard}>
            <View style={styles.createModalHeader}>
              <Text style={styles.createModalTitle}>Thêm liên kết web</Text>
              <TouchableOpacity onPress={() => setActiveDialog(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Tiêu đề liên kết *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Nhập tên liên kết..."
              placeholderTextColor="#94a3b8"
              value={formName}
              onChangeText={setFormName}
            />

            <Text style={styles.inputLabel}>Đường dẫn URL *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="https://..."
              placeholderTextColor="#94a3b8"
              value={formUrlOrContent}
              onChangeText={setFormUrlOrContent}
            />

            <View style={styles.modalFooterBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveDialog(null)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleAddLink}>
                <Text style={styles.submitBtnText}>Lưu liên kết</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* DIALOG 4: Voice Recorder Modal */}
      <Modal visible={activeDialog === "audio"} transparent animationType="slide" onRequestClose={() => setActiveDialog(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.createModalCard}>
            <View style={styles.createModalHeader}>
              <Text style={styles.createModalTitle}>Thêm ghi âm mới (MP3)</Text>
              <TouchableOpacity onPress={() => setActiveDialog(null)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.audioRecorderWrap}>
              <TouchableOpacity
                style={[styles.recordCircleBtn, isRecording && styles.recordCircleBtnActive]}
                onPress={() => setIsRecording(!isRecording)}
              >
                <Ionicons name={isRecording ? "stop" : "mic"} size={36} color="#ffffff" />
              </TouchableOpacity>
              <Text style={styles.recordingTimerText}>
                {String(Math.floor(recordingTimer / 60)).padStart(2, "0")}:{String(recordingTimer % 60).padStart(2, "0")}
              </Text>
              <Text style={styles.recordingStatusText}>
                {isRecording ? "Đang ghi âm thoại... Nhấn để dừng" : "Bấm micro để bắt đầu thu âm"}
              </Text>
            </View>

            <Text style={styles.inputLabel}>Tên bản ghi âm MP3 *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Ghi âm..."
              placeholderTextColor="#94a3b8"
              value={formName}
              onChangeText={setFormName}
            />

            <View style={styles.modalFooterBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setActiveDialog(null)}>
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitBtn} onPress={handleSaveVoiceMemo}>
                <Text style={styles.submitBtnText}>Lưu file MP3</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Item Action Sheet Modal */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.actionSheetCard}>
            <View style={styles.sheetHeader}>
              <View style={[styles.sheetIcon, { backgroundColor: getFileIcon(selectedItem?.type || "document").bg }]}>
                <Ionicons
                  name={getFileIcon(selectedItem?.type || "document").icon as any}
                  size={20}
                  color={getFileIcon(selectedItem?.type || "document").iconColor}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {selectedItem?.name}
                </Text>
                <Text style={styles.sheetSub}>
                  {selectedItem?.permission === "owner" ? "Tài nguyên của bạn" : `Chia sẻ từ ${selectedItem?.owner}`}
                </Text>
              </View>
            </View>

            <View style={styles.sheetDivider} />

            <TouchableOpacity style={styles.sheetOptionRow} onPress={() => selectedItem && handleToggleStar(selectedItem)}>
              <Ionicons name={selectedItem?.isStarred ? "star" : "star-outline"} size={20} color="#f59e0b" />
              <Text style={styles.sheetOptionText}>{selectedItem?.isStarred ? "Bỏ gắn dấu sao" : "Gắn dấu sao"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOptionRow}
              onPress={() => {
                setMenuVisible(false);
                setShareModalVisible(true);
              }}
            >
              <Ionicons name="people-outline" size={20} color="#0284c7" />
              <Text style={styles.sheetOptionText}>Chia sẻ quyền truy cập</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sheetOptionRow}
              onPress={() => {
                const target = selectedItem;
                setMenuVisible(false);
                if (target) setViewingItem(target);
              }}
            >
              <Ionicons name="eye-outline" size={20} color="#16a34a" />
              <Text style={styles.sheetOptionText}>Xem / Nghe tệp trên app</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetOptionRow} onPress={() => selectedItem && handleMoveToTrash(selectedItem)}>
              <Ionicons name="trash-outline" size={20} color="#dc2626" />
              <Text style={[styles.sheetOptionText, { color: "#dc2626" }]}>Chuyển vào thùng rác</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* SHARE PERMISSION MODAL */}
      <Modal visible={shareModalVisible} transparent animationType="slide" onRequestClose={() => setShareModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.shareModalCard}>
            <View style={styles.shareModalHeader}>
              <View>
                <Text style={styles.shareModalTitle}>Chia sẻ "{selectedItem?.name}"</Text>
                <Text style={styles.shareModalSub}>Chỉ những người trong danh sách mới có quyền xem tài nguyên</Text>
              </View>
              <TouchableOpacity onPress={() => setShareModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Thêm người dùng hoặc phòng ban</Text>
            <View style={styles.shareInputRow}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Nhập tên hoặc email..."
                placeholderTextColor="#94a3b8"
                value={shareEmail}
                onChangeText={setShareEmail}
              />
              <TouchableOpacity style={styles.addShareBtn} onPress={handleAddShareRecipient}>
                <Text style={styles.addShareBtnText}>Thêm</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Danh sách được quyền truy cập ({sharedList.length}):</Text>
            <ScrollView style={{ maxHeight: 150 }}>
              {sharedList.map((recipient, idx) => (
                <View key={idx} style={styles.recipientRow}>
                  <Ionicons name="person-circle-outline" size={22} color="#008852" />
                  <Text style={styles.recipientName}>{recipient}</Text>
                  <TouchableOpacity onPress={() => setSharedList((prev) => prev.filter((_, i) => i !== idx))}>
                    <Ionicons name="close-circle-outline" size={18} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalFooterBtns}>
              <TouchableOpacity style={styles.submitBtn} onPress={() => setShareModalVisible(false)}>
                <Text style={styles.submitBtnText}>Xác nhận chia sẻ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── VIEWER STYLES ─────────────────────────────────────────────────────────────
const viewerStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  closeBtn: { padding: 4 },
  headerTitleWrap: { flex: 1, marginHorizontal: 12 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", fontFamily: "Inter-Bold" },
  headerSub: { fontSize: 12, color: "#64748b", fontFamily: "Inter-Regular" },
  shareHeaderBtn: { padding: 4 },
  scrollBody: { padding: 16, gap: 16, paddingBottom: 40 },

  /* Audio Card */
  audioCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  audioHeader: { alignItems: "center", gap: 6 },
  audioIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#ecfdf5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  audioTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a", textAlign: "center", fontFamily: "Inter-Bold" },
  audioSub: { fontSize: 13, color: "#64748b", fontFamily: "Inter-Regular" },
  waveBarWrap: { flexDirection: "row", alignItems: "center", gap: 4, height: 48, marginVertical: 8 },
  waveBarLine: { width: 4, borderRadius: 2 },
  trackBarWrap: { width: "100%", gap: 6 },
  trackBg: { width: "100%", height: 6, backgroundColor: "#e2e8f0", borderRadius: 3, overflow: "hidden" },
  trackFill: { height: "100%", backgroundColor: "#008852" },
  timeRow: { flexDirection: "row", justifyContent: "space-between" },
  timeText: { fontSize: 12, color: "#64748b", fontFamily: "Inter-Medium" },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 28, marginTop: 8 },
  playCircleBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#008852",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
  },

  /* Video Card */
  videoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  videoCanvas: {
    height: 220,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  videoPreviewImg: { width: "100%", height: "100%", opacity: 0.8 },
  videoPlaceholder: { alignItems: "center", justifyContent: "center" },
  videoPlayOverlayBtn: { position: "absolute" },
  videoBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  videoBadgeText: { color: "#ffffff", fontSize: 10, fontWeight: "700" },
  videoMetaBox: { padding: 16, gap: 4 },
  videoTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", fontFamily: "Inter-Bold" },
  videoSub: { fontSize: 12, color: "#64748b", fontFamily: "Inter-Regular" },

  /* Image Viewer */
  imageCard: { backgroundColor: "#ffffff", borderRadius: 16, overflow: "hidden", padding: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  fullImage: { width: "100%", height: 320, borderRadius: 12 },

  /* Link Card */
  linkCard: { backgroundColor: "#ffffff", borderRadius: 16, padding: 24, alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#e2e8f0" },
  linkIconWrap: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#ecfdf5", alignItems: "center", justifyContent: "center" },
  linkTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", textAlign: "center" },
  linkUrlText: { fontSize: 13, color: "#0284c7", textAlign: "center", textDecorationLine: "underline" },
  openWebBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#008852", paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, marginTop: 8 },
  openWebBtnText: { color: "#ffffff", fontSize: 14, fontWeight: "700" },

  /* Document Card */
  docCard: { backgroundColor: "#ffffff", borderRadius: 18, padding: 20, alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  docIconWrap: { width: 72, height: 72, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  docTitle: { fontSize: 16, fontWeight: "700", color: "#0f172a", textAlign: "center" },
  docSub: { fontSize: 12, color: "#64748b" },
  docContentSnippet: { width: "100%", padding: 12, backgroundColor: "#f8fafc", borderRadius: 10, borderWidth: 1, borderColor: "#f1f5f9", marginTop: 4 },
  snippetTitle: { fontSize: 12, fontWeight: "700", color: "#475569", marginBottom: 4 },
  snippetText: { fontSize: 13, color: "#1e293b", lineHeight: 18 },
  docActionsRow: { flexDirection: "row", gap: 10, marginTop: 10, width: "100%" },
  docPrimaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#008852", paddingVertical: 12, borderRadius: 12 },
  docPrimaryBtnText: { color: "#ffffff", fontSize: 13, fontWeight: "700" },
  docSecondaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0", paddingVertical: 12, borderRadius: 12 },
  docSecondaryBtnText: { color: "#008852", fontSize: 13, fontWeight: "700" },
  openExternalBtn: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  openExternalText: { fontSize: 12, color: "#2563eb", textDecorationLine: "underline", fontFamily: "Inter-Medium" },
  videoPlaceholderText: { fontSize: 13, color: "#64748b", marginTop: 8, fontFamily: "Inter-Regular" },
  noUrlHint: { fontSize: 12, color: "#94a3b8", textAlign: "center", marginTop: 8, fontStyle: "italic" },

  /* Details Card */
  detailsCard: { backgroundColor: "#ffffff", borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: "#e2e8f0" },
  detailsCardTitle: { fontSize: 14, fontWeight: "700", color: "#0f172a", marginBottom: 4 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#f8fafc" },
  detailLabel: { fontSize: 13, color: "#64748b" },
  detailVal: { fontSize: 13, color: "#0f172a", fontWeight: "600" },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },

  /* Search Header */
  searchHeaderContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBarBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 24,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  menuIconBtn: {
    paddingRight: 10,
  },
  searchInput: {
    flex: 1,
    color: "#0f172a",
    fontSize: 15,
    fontFamily: "Inter-Medium",
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#008852",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },

  /* Folder Breadcrumbs Bar */
  breadcrumbBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  breadcrumbContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  breadcrumbChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
  },
  breadcrumbChipActive: {
    backgroundColor: "#e6f4ea",
  },
  breadcrumbText: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Inter-Medium",
  },
  breadcrumbTextActive: {
    color: "#008852",
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },

  /* Section Control */
  sectionControlRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  sectionControlTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  sectionControlSub: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Inter-Regular",
    marginTop: 2,
  },
  trashBinBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  trashBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#dc2626",
    borderRadius: 10,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  trashBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "bold",
  },
  viewToggleContainer: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    padding: 3,
  },
  toggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleBtnActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },

  /* Trash Modal */
  trashContainer: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  trashHeaderBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  trashHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  trashHeaderSub: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Inter-Regular",
  },
  emptyTrashBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#dc2626",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  emptyTrashBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
  },
  trashedItemCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  trashedTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
  trashedSub: {
    fontSize: 12,
    color: "#dc2626",
    marginTop: 2,
  },
  restoreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ecfdf5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  restoreBtnText: {
    fontSize: 12,
    color: "#008852",
    fontWeight: "bold",
  },
  deletePermBtn: {
    padding: 6,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
  },

  /* Loading & Error */
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748b",
    fontFamily: "Inter-Regular",
  },
  errorBanner: {
    marginHorizontal: 16,
    padding: 12,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  errorText: {
    fontSize: 13,
    color: "#dc2626",
    fontFamily: "Inter-Medium",
    flex: 1,
  },
  retryBtn: {
    backgroundColor: "#dc2626",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  retryBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "Inter-Bold",
  },

  /* Resource List Items */
  listContentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 6,
  },
  listItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
  },
  listIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  listTextCol: {
    flex: 1,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  itemTitle: {
    fontSize: 15,
    color: "#0f172a",
    fontFamily: "Inter-Medium",
    flexShrink: 1,
  },
  itemSubtitle: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Inter-Regular",
    marginTop: 3,
  },
  moreBtn: {
    padding: 6,
  },

  /* Grid Layout */
  gridItemCard: {
    flex: 1,
    margin: 6,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  gridIconWrap: {
    height: 60,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  gridInfoWrap: {
    gap: 2,
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    fontFamily: "Inter-SemiBold",
  },
  gridSubtitle: {
    fontSize: 11,
    color: "#64748b",
    fontFamily: "Inter-Regular",
  },

  /* Empty State */
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#475569",
    fontFamily: "Inter-Bold",
  },
  emptySub: {
    fontSize: 13,
    color: "#94a3b8",
    fontFamily: "Inter-Regular",
    textAlign: "center",
  },

  /* FAB (+) */
  fabContainer: {
    position: "absolute",
    right: 20,
    bottom: 24,
  },
  mainFab: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#008852",
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#008852",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },

  /* Plus (+) Menu Card */
  plusMenuCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 22,
    gap: 16,
    width: "100%",
    maxWidth: 480,
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  plusMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  plusMenuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  plusMenuText: {
    fontSize: 15,
    color: "#0f172a",
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
  },

  /* General Dialog Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  createModalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    gap: 16,
    width: "100%",
    maxWidth: 480,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 12,
  },
  createModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  createModalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    fontFamily: "Inter-Bold",
    marginTop: 4,
  },
  modalInput: {
    backgroundColor: "#f8fafc",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: "#0f172a",
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    fontFamily: "Inter-Medium",
  },
  modalFooterBtns: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 14,
  },
  cancelBtn: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
  },
  cancelBtnText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  submitBtn: {
    backgroundColor: "#008852",
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: 14,
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },

  /* Audio Recorder UI */
  audioRecorderWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  recordCircleBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#008852",
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  recordCircleBtnActive: {
    backgroundColor: "#dc2626",
  },
  recordingTimerText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  recordingStatusText: {
    fontSize: 13,
    color: "#475569",
    fontFamily: "Inter-Medium",
  },

  /* Action Sheet Modal */
  actionSheetCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    gap: 14,
    width: "100%",
    maxWidth: 480,
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sheetIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  sheetSub: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Inter-Regular",
    marginTop: 2,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 4,
  },
  sheetOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  sheetOptionText: {
    fontSize: 14.5,
    color: "#0f172a",
    fontWeight: "600",
    fontFamily: "Inter-SemiBold",
  },

  /* Share Modal */
  shareModalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 28,
    padding: 24,
    gap: 16,
    width: "100%",
    maxWidth: 480,
    overflow: "hidden",
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  shareModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  shareModalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    fontFamily: "Inter-Bold",
  },
  shareModalSub: {
    fontSize: 12,
    color: "#64748b",
    fontFamily: "Inter-Regular",
    marginTop: 2,
  },
  shareInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addShareBtn: {
    backgroundColor: "#008852",
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 16,
  },
  addShareBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
    fontFamily: "Inter-Bold",
  },
  recipientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  recipientName: {
    flex: 1,
    fontSize: 13.5,
    color: "#0f172a",
    fontFamily: "Inter-Medium",
  },
});
