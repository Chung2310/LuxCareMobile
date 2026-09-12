import { downloadRemoteFile } from "../../src/files/downloadRemoteFile";
import { resolveFileFormat } from "../../src/files/fileFormat";
import { resolveFileUrl, shareApiFile } from "../../src/files/shareFile";
import { saveDownloadedMedia } from "../../src/features/blog/saveDownloadedMedia";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeModules,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  AppState,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  useAudioRecorder,
  useAudioPlayer,
  useAudioPlayerStatus,
  RecordingPresets,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import { File } from "expo-file-system";
import * as MediaLibrary from "expo-media-library/legacy";
import * as Sharing from "expo-sharing";
import { useVideoPlayer, VideoView } from "expo-video";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCommunication } from "../../src/features/notifications/CommunicationProvider";
import { chatNotificationsMuted } from "../../src/features/notifications/chatNotificationState";
import { useSession } from "../../src/auth/SessionProvider";
import { useChatUnread } from "../../src/context/ChatUnreadContext";
import { api, chat, kanbanMedia } from "../../src/api/services";
import { socketService } from "../../src/api/socketService";
import { userManagementApi } from "../../src/api/userManagementApi";
import type {
  ChatAttachment,
  ChatMessage,
  ChatRoom,
  ChatRoomMember,
} from "../../../src/services/chatService";
import type { UserProfile } from "../../../src/types/common";

// Thân thiện, dịu mắt, đồng bộ nhận diện thương hiệu LuxCare (Tone xanh ngọc mint màn hình chính)
const LUXCARE_PRIMARY = "#059669"; // Emerald xanh lá LuxCare
const LUXCARE_HEADER_BG = "#d1fae5"; // Xanh ngọc mint nhạt nền giống màn hình chính
const LUXCARE_HEADER_TEXT = "#065f46"; // Màu chữ/icon xanh ngọc đậm dễ nhìn, tương phản cao
const LUXCARE_MINT_BG = "#ecfdf5"; // Nền tin nhắn của tôi
const LUXCARE_MINT_BORDER = "#a7f3d0";
const ROOM_ACTIVITY_PREFIX = "__LUXCARE_ROOM_ACTIVITY__:";

function getRoomActivityText(content?: string): string | null {
  if (!content?.startsWith(ROOM_ACTIVITY_PREFIX)) return null;
  return content.slice(ROOM_ACTIVITY_PREFIX.length).trim() || null;
}

// Bảng biểu cảm Emoji & Sticker chuẩn Mobile phong phú theo danh mục
const EMOJI_CATEGORIES = [
  {
    id: "smileys",
    icon: "happy-outline",
    name: "Cảm xúc",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "🥲", "🥹",
      "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗",
      "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓",
      "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁",
      "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😮‍💨", "😤", "😠",
      "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥",
      "😓", "🤗", "🤔", "🫣", "🤭", "🫢", "🫡", "🤫", "🫠", "🤐"
    ],
  },
  {
    id: "love",
    icon: "heart-outline",
    name: "Tình cảm",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❤️‍🔥", "❤️‍🩹", "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝",
      "💟", "♥️", "💌", "💋", "👩‍❤️‍👨", "👨‍❤️‍👨", "👩‍❤️‍👩", "💑", "👩‍❤️‍💋‍👨", "💏"
    ],
  },
  {
    id: "hands",
    icon: "thumbs-up-outline",
    name: "Cử chỉ",
    emojis: [
      "👍", "👎", "👌", "🤌", "🤏", "✌️", "🤞", "🫰", "🤟", "🤘",
      "🤙", "👈", "👉", "👆", "👇", "☝️", "🫵", "👋", "🤚", "🖐️",
      "✋", "🖖", "🫱", "🫲", "🤝", "👏", "🙌", "👐", "🤲", "🙏",
      "✍️", "💪", "🦾", "🦿", "🦵", "🦶", "👂", "👃", "👀", "🧠"
    ],
  },
  {
    id: "celebration",
    icon: "sparkles-outline",
    name: "Sự kiện",
    emojis: [
      "🎉", "🎊", "🎈", "🎂", "🎁", "🏆", "🥇", "🥈", "🥉", "🏅",
      "🎖️", "⭐", "🌟", "✨", "💫", "🔥", "💥", "💯", "💢", "👑",
      "💎", "💐", "🌸", "🌹", "🍀", "🥂", "🍻", "☕", "🍵", "🎯"
    ],
  },
  {
    id: "lifestyle",
    icon: "briefcase-outline",
    name: "Đời sống",
    emojis: [
      "💼", "💻", "📱", "📅", "⏰", "📌", "📍", "🔔", "💡", "🔑",
      "🏥", "💊", "🩺", "💉", "🚗", "🚕", "🛵", "🏍️", "🚲", "✈️",
      "🚀", "🐶", "🐱", "🐰", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮"
    ],
  },
];

// Helper phân tích tin nhắn chỉ chứa Emoji để phóng to (Big Emoji) như Zalo/Telegram/iOS
const EMOJI_ONLY_REGEX = /^[\s\p{Extended_Pictographic}\uFE0F\u200D\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]+$/u;

function getEmojiOnlyMeta(text?: string): { isEmojiOnly: boolean; count: number } {
  if (!text) return { isEmojiOnly: false, count: 0 };
  const trimmed = text.trim();
  if (!trimmed) return { isEmojiOnly: false, count: 0 };

  // Nếu chứa chữ số, chữ cái hoặc ký tự thông thường -> chắc chắn là tin nhắn văn bản, không phóng to
  if (/[\p{L}\p{N}]/u.test(trimmed)) {
    return { isEmojiOnly: false, count: 0 };
  }

  try {
    if (!EMOJI_ONLY_REGEX.test(trimmed)) {
      return { isEmojiOnly: false, count: 0 };
    }
    const glyphs = Array.from(trimmed).filter((c) => {
      const ch = c.trim();
      return (
        ch.length > 0 &&
        ch !== "\uFE0F" &&
        ch !== "\u200D" &&
        !/^[\u{1F3FB}-\u{1F3FF}]$/u.test(ch)
      );
    });
    if (glyphs.length > 0 && glyphs.length <= 8) {
      return { isEmojiOnly: true, count: glyphs.length };
    }
  } catch {
    // Fallback if regex fails on old engine
  }
  return { isEmojiOnly: false, count: 0 };
}

// Trích xuất tên tệp hiển thị rõ ràng, đẹp mắt (kể cả khi gửi file từ URL hoặc đính kèm)
function getCleanFileName(att?: ChatAttachment | null): string {
  if (!att) return "Tệp tài liệu";
  if (att.name && att.name.trim() && !att.name.startsWith("data:") && att.name !== "Tệp đính kèm") {
    return att.name.trim();
  }
  if (att.url) {
    try {
      const cleanUrl = att.url.split("?")[0].split("#")[0];
      const parts = cleanUrl.split("/");
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart.length > 0 && !lastPart.startsWith("data:")) {
        return decodeURIComponent(lastPart);
      }
    } catch {}
  }
  return att.name || "Tệp tài liệu";
}

// Định dạng kích thước tệp tin (KB, MB)
function formatFileSize(size?: number): string {
  if (!size || size <= 0) return "Tệp đính kèm";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

// Trích xuất toàn bộ tệp đính kèm, ảnh, file ghi âm, excel có thể tải về từ tin nhắn
function extractDownloadableAttachments(msg?: ChatMessage | null): ChatAttachment[] {
  if (!msg) return [];
  const list: ChatAttachment[] = msg.attachments && Array.isArray(msg.attachments) ? [...msg.attachments] : [];
  const content = (msg.content || "").trim();
  if (content && !msg.isDeleted) {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      const isHttpOrFile =
        trimmed.startsWith("http://") ||
        trimmed.startsWith("https://") ||
        trimmed.startsWith("file://") ||
        trimmed.startsWith("data:");
      if (isHttpOrFile && !trimmed.includes(" ")) {
        if (!list.some((a) => a.url === trimmed)) {
          let name = "Tệp đính kèm";
          let type = "application/octet-stream";
          if (
            trimmed.match(/\.(jpeg|jpg|gif|png|webp|bmp|svg)($|\?[^\s]*)/i) ||
            trimmed.includes("/image/upload/") ||
            trimmed.startsWith("data:image/")
          ) {
            name = "Hinh_anh.jpg";
            type = "image/jpeg";
          } else if (
            trimmed.match(/\.(mp4|mov|avi|mkv|webm|m4v|3gp)($|\?[^\s]*)/i) ||
            trimmed.startsWith("data:video/") ||
            (trimmed.includes("cloudinary.com") &&
              trimmed.includes("/video/upload/") &&
              !trimmed.includes("Audio_") &&
              !trimmed.includes("Ghi_am") &&
              !trimmed.match(/\.(mp3|m4a|wav|aac|ogg|opus|flac)($|\?[^\s]*)/i))
          ) {
            name = "Video.mp4";
            type = "video/mp4";
          } else if (
            trimmed.match(/\.(mp3|m4a|wav|aac|ogg|opus|flac)($|\?[^\s]*)/i) ||
            trimmed.startsWith("data:audio/") ||
            trimmed.includes("Audio_") ||
            trimmed.includes("Ghi_am")
          ) {
            name = "Ghi_am.m4a";
            type = "audio/mpeg";
          } else if (trimmed.match(/\.(xlsx|xls)($|\?[^\s]*)/i)) {
            name = "Tai_lieu.xlsx";
            type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          } else if (trimmed.match(/\.(pdf)($|\?[^\s]*)/i)) {
            name = "Tai_lieu.pdf";
            type = "application/pdf";
          } else if (trimmed.match(/\.(docx|doc)($|\?[^\s]*)/i)) {
            name = "Tai_lieu.docx";
            type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
          } else {
            const urlParts = trimmed.split("?")[0].split("/");
            const lastPart = urlParts[urlParts.length - 1];
            if (lastPart && !lastPart.startsWith("data:")) {
              name = decodeURIComponent(lastPart);
            }
          }
          list.push({ url: trimmed, name, type });
        }
      }
    }
  }
  return list;
}

// Handler thông báo hệ thống toàn cục (dùng được cho cả các hàm tiện ích ngoài component)
let globalCustomAlert: ((title: string, message?: string) => void) | null = null;

// Helper chuẩn bị dữ liệu media (tự động upload lên Cloudinary để lưu trữ vĩnh viễn qua chat.attachment API)
async function prepareAttachment(
  uri: string,
  fileName: string,
  mimeType: string,
  fileSize?: number,
  base64Provided?: string | null,
): Promise<ChatAttachment> {
  try {
    // Cách 0: Thử upload trực tiếp qua FormData (Native streaming siêu nhanh, không tốn RAM đọc Base64)
    try {
      const formData = new FormData();
      formData.append("file", {
        uri,
        name: fileName,
        type: mimeType || "image/jpeg",
      } as any);
      formData.append("sourceType", "chat.attachment");
      formData.append("fileName", fileName);
      formData.append("mimeType", mimeType);

      const formResponse = await api.transport.fetch("/api/v1/media/upload", {
        method: "POST",
        body: formData,
      });

      if (formResponse.ok) {
        const formRes = await formResponse.json();
        if (formRes?.url) {
          return {
            url: formRes.url,
            name: fileName,
            type: mimeType,
            size: fileSize || formRes.size,
            uploadToken: formRes.uploadToken,
          };
        }
      }
    } catch {
      // Fallback silently to base64 upload
    }

    let base64Data = "";
    if (base64Provided) {
      base64Data = base64Provided.replace(/\s/g, "");
    } else {
      // Cách 1: Thử FileSystem.readAsStringAsync (đọc nhanh từ cache hoặc file://)
      try {
        const b64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" as any });
        if (b64 && b64.length > 0) {
          base64Data = b64.replace(/\s/g, "");
        }
      } catch (fsErr) {
        console.warn("FileSystem.readAsStringAsync thất bại:", fsErr);
      }

      // Cách 2: Thử đọc bằng Expo File API mới (JSI C++ native, hỗ trợ file PDF/Binary lớn)
      if (!base64Data) {
        try {
          const fileObj = new File(uri);
          const b64 = await fileObj.base64();
          if (b64 && b64.length > 0) {
            base64Data = b64.replace(/\s/g, "");
          }
        } catch (fErr) {
          console.warn("File(uri).base64() thất bại:", fErr);
        }
      }

      // Cách 3: Thử Web fetch + blob + FileReader
      if (!base64Data) {
        try {
          const response = await fetch(uri);
          const blob = await response.blob();
          const readerResult = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === "string") resolve(reader.result);
              else reject(new Error("Không đọc được Data URL"));
            };
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(blob);
          });
          if (readerResult) {
            const commaIdx = readerResult.indexOf(",");
            base64Data = commaIdx >= 0 ? readerResult.substring(commaIdx + 1).replace(/\s/g, "") : readerResult;
          }
        } catch (fetchErr) {
          console.warn("fetch blob thất bại:", fetchErr);
        }
      }

      // Cách 4: Sao chép tệp sang FileSystem.cacheDirectory với tên an toàn rồi đọc
      if (!base64Data) {
        try {
          const safeName = `temp_${Date.now()}_` + fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
          const tempDest = `${FileSystem.cacheDirectory || ""}${safeName}`;
          await FileSystem.copyAsync({ from: uri, to: tempDest });
          const b64 = await FileSystem.readAsStringAsync(tempDest, { encoding: "base64" as any });
          if (b64) base64Data = b64.replace(/\s/g, "");
          void FileSystem.deleteAsync(tempDest, { idempotent: true }).catch(() => {});
        } catch (copyErr) {
          console.warn("Sao chép tệp tạm để đọc thất bại:", copyErr);
        }
      }
    }

    if (base64Data) {
      const dataUri = `data:${mimeType};base64,${base64Data}`;
      const calculatedSize = fileSize || Math.round((base64Data.length * 3) / 4);

      // Tải lên server Cloudinary qua Relay API chuẩn của Chat (sourceType: "chat.attachment")
      try {
        const uploadResponse = await api.transport.fetch("/api/v1/media/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file: dataUri,
            sourceType: "chat.attachment",
            fileName,
            mimeType,
            size: calculatedSize,
          }),
        });
        if (uploadResponse.ok) {
          const uploadRes = await uploadResponse.json();
          if (uploadRes?.url) {
            return {
              url: uploadRes.url,
              name: fileName,
              type: mimeType,
              size: calculatedSize,
              uploadToken: uploadRes.uploadToken,
            };
          }
        } else {
          const errBody = await uploadResponse.json().catch(() => ({}));
          console.warn("Upload chat.attachment thất bại:", uploadResponse.status, errBody);
          if (globalCustomAlert) {
            globalCustomAlert("Lỗi tải lên", errBody?.message || `Máy chủ từ chối tải tệp (Mã lỗi ${uploadResponse.status}).`);
          }
        }
      } catch (uploadErr: any) {
        console.warn("Lỗi kết nối upload Cloudinary:", uploadErr);
        if (globalCustomAlert) {
          globalCustomAlert("Lỗi mạng", uploadErr?.message || "Không thể kết nối máy chủ để tải tệp lên.");
        }
      }
    } else {
      if (globalCustomAlert) {
        globalCustomAlert("Lỗi tệp", "Không thể đọc nội dung tệp tin này từ thiết bị. Vui lòng thử chọn tệp từ thư mục khác (như Tải về/Bộ nhớ máy).");
      }
    }
  } catch (err) {
    console.warn("Lỗi prepareAttachment:", err);
  }

  // Fallback nếu hoàn toàn không đọc được file
  return {
    url: uri,
    name: fileName,
    type: mimeType,
    size: fileSize || 0,
  };
}

// Helper phân loại chính xác các loại tệp tin media đính kèm
function isVideoAttachment(att?: ChatAttachment | null): boolean {
  if (!att) return false;
  if (att.type?.startsWith("video/")) return true;
  const url = (att.url || "").trim().toLowerCase();
  const name = (att.name || "").trim().toLowerCase();
  if (/\.(mp4|mov|avi|mkv|webm|m4v|3gp)($|\?[^\s]*)/i.test(url) || /\.(mp4|mov|avi|mkv|webm|m4v|3gp)$/i.test(name)) {
    return true;
  }
  if (url.startsWith("data:video/")) return true;
  if (url.includes("cloudinary.com") && url.includes("/video/upload/")) {
    const isAudio =
      url.includes("audio_") ||
      name.includes("audio_") ||
      name.includes("ghi_am") ||
      /\.(mp3|m4a|wav|aac|ogg|opus|flac)($|\?[^\s]*)/i.test(url) ||
      /\.(mp3|m4a|wav|aac|ogg|opus|flac)$/i.test(name);
    return !isAudio;
  }
  return false;
}

function isAudioAttachment(att?: ChatAttachment | null): boolean {
  if (!att) return false;
  if (isVideoAttachment(att)) return false;
  if (att.type?.startsWith("audio/")) return true;
  const url = (att.url || "").trim().toLowerCase();
  const name = (att.name || "").trim().toLowerCase();
  if (/\.(mp3|m4a|wav|aac|ogg|opus|flac)($|\?[^\s]*)/i.test(url) || /\.(mp3|m4a|wav|aac|ogg|opus|flac)$/i.test(name)) {
    return true;
  }
  if (url.startsWith("data:audio/")) return true;
  if (url.includes("cloudinary.com") && (url.includes("audio_") || name.includes("audio_") || name.includes("ghi_am"))) {
    return true;
  }
  return false;
}

function isImageAttachment(att?: ChatAttachment | null): boolean {
  if (!att) return false;
  if (att.type?.startsWith("image/")) return true;
  const url = (att.url || "").trim().toLowerCase();
  const name = (att.name || "").trim().toLowerCase();
  if (/\.(jpeg|jpg|gif|png|webp|bmp|svg)($|\?[^\s]*)/i.test(url) || /\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i.test(name)) {
    return true;
  }
  if (url.startsWith("data:image/") || url.includes("/image/upload/")) return true;
  return false;
}

// Khung hiển thị Video trong tin nhắn chat (có hình thu nhỏ & nút Play)
function ChatVideoBubble({
  att,
  isMe,
  isSending,
  onPress,
}: {
  att: ChatAttachment;
  isMe: boolean;
  isSending?: boolean;
  onPress: () => void;
}) {
  const isCloudinary = att.url?.includes("cloudinary.com");
  const thumbUrl = isCloudinary
    ? att.url.replace(/\.(mp4|mov|avi|mkv|webm|m4v|3gp)($|\?[^\s]*)/i, ".jpg")
    : null;

  return (
    <TouchableOpacity
      style={styles.videoBubbleCard}
      onPress={onPress}
      activeOpacity={0.88}
    >
      {thumbUrl ? (
        <Image
          source={{ uri: thumbUrl }}
          style={styles.videoBubbleThumb}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.videoBubblePlaceholder}>
          <Ionicons name="videocam" size={38} color="#ffffff" />
        </View>
      )}

      {/* Lớp phủ tối mỏng giúp nổi bật nút Play */}
      <View style={styles.videoBubbleOverlay} />

      {/* Nút Play trung tâm hoặc vòng xoay đang gửi - Luôn căn chính giữa 100% */}
      {isSending ? (
        <View style={styles.videoBubbleSpinnerCenter}>
          <View style={styles.attSpinnerBadge}>
            <ActivityIndicator size="small" color="#ffffff" />
          </View>
        </View>
      ) : (
        <View style={styles.videoBubblePlayBtn} pointerEvents="none">
          <Ionicons name="play" size={28} color="#ffffff" style={{ marginLeft: 3 }} />
        </View>
      )}

      {/* Thanh thông tin dưới video */}
      <View style={styles.videoBubbleFooter}>
        <View style={styles.videoBubbleBadge}>
          <Ionicons name="videocam" size={11} color="#ffffff" />
          <Text style={styles.videoBubbleBadgeText}>VIDEO</Text>
        </View>
        <Text style={styles.videoBubbleName} numberOfLines={1}>
          {getCleanFileName(att)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// Trình phát Video toàn màn hình tích hợp expo-video (đầy đủ nút điều khiển và nút tải về)
function FullscreenVideoPlayer({
  videoUri,
  fileName,
  onClose,
  onDownload,
  toastElement,
}: {
  videoUri: string | null;
  fileName: string;
  onClose: () => void;
  onDownload: () => Promise<void> | void;
  toastElement?: React.ReactNode;
}) {
  const [downloading, setDownloading] = useState(false);
  const player = useVideoPlayer(videoUri || null, (p: any) => {
    if (videoUri) {
      p.loop = false;
      p.play();
    }
  });

  const handlePressDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      await onDownload();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={styles.videoModalOverlay}>
      <SafeAreaView style={styles.videoModalSafeArea}>
        {/* Thanh công cụ phía trên */}
        <View style={styles.videoModalTopBar}>
          <TouchableOpacity
            style={styles.videoModalIconBtn}
            onPress={onClose}
            activeOpacity={0.75}
          >
            <Ionicons name="close" size={26} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.videoModalHeaderTitle} numberOfLines={1}>
            {fileName}
          </Text>
          <TouchableOpacity
            style={styles.videoModalIconBtn}
            onPress={handlePressDownload}
            activeOpacity={0.75}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons name="download-outline" size={22} color="#ffffff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Khung video expo-video chuẩn */}
        <View style={styles.videoModalContent}>
          {videoUri ? (
            <VideoView
              player={player}
              style={styles.videoModalVideoView}
              nativeControls
              contentFit="contain"
              allowsPictureInPicture={false}
            />
          ) : (
            <View style={styles.videoModalErrorWrap}>
              <Ionicons name="alert-circle-outline" size={48} color="#94a3b8" />
              <Text style={styles.videoModalErrorText}>Không tìm thấy đường dẫn video</Text>
            </View>
          )}
        </View>

        {/* Thông báo nổi toast ngay trên màn hình video */}
        {toastElement}
      </SafeAreaView>
    </View>
  );
}

function VoiceNoteBubble({ att, isMe }: { att: ChatAttachment; isMe: boolean }) {
  const player = useAudioPlayer(att.url || "");
  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing;

  const togglePlay = () => {
    try {
      if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
    } catch (e) {
      console.warn("Không thể phát tệp âm thanh:", e);
    }
  };

  const formatSec = (seconds?: number) => {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <View style={styles.voiceNoteWrap}>
      <TouchableOpacity
        style={[styles.voicePlayBtn, isMe ? styles.voicePlayBtnMe : styles.voicePlayBtnOther]}
        onPress={togglePlay}
        activeOpacity={0.8}
      >
        <Ionicons name={isPlaying ? "pause" : "play"} size={18} color={isMe ? "#ffffff" : LUXCARE_PRIMARY} />
      </TouchableOpacity>
      <View style={styles.voiceProgressWrap}>
        <View style={styles.voiceWaveRow}>
          {[8, 14, 20, 12, 18, 24, 16, 10, 22, 14, 8].map((h, idx) => (
            <View
              key={idx}
              style={[
                styles.voiceWaveBar,
                { height: h },
                isPlaying && { backgroundColor: isMe ? "#059669" : LUXCARE_PRIMARY },
              ]}
            />
          ))}
        </View>
        <Text style={styles.voiceDurationText}>
          {isPlaying
            ? formatSec(status.currentTime) || "Đang phát..."
            : status.duration
            ? formatSec(status.duration)
            : att.name || "Tin nhắn thoại"}
        </Text>
      </View>
    </View>
  );
}

// Bảng biểu cảm phản ứng nhanh giống Zalo với hiệu ứng animation xuất hiện tuần tự và phóng to
const ZALO_REACTIONS = ["❤️", "👍", "😆", "😮", "😭", "😡"];

function AnimatedReactionItem({
  emoji,
  index,
  modalVisible,
  onReact,
}: {
  emoji: string;
  index: number;
  modalVisible: boolean;
  onReact: (emoji: string) => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const [isPressed, setIsPressed] = useState(false);
  const touchScale = useRef(new Animated.Value(1)).current;
  const touchTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (modalVisible) {
      scaleAnim.setValue(0);
      const timer = setTimeout(() => {
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 140,
          useNativeDriver: true,
        }).start();
      }, index * 40);
      return () => clearTimeout(timer);
    } else {
      scaleAnim.setValue(0);
      touchScale.setValue(1);
      touchTranslateY.setValue(0);
      setIsPressed(false);
    }
  }, [modalVisible, index]);

  const handlePressIn = () => {
    setIsPressed(true);
    Animated.parallel([
      Animated.spring(touchScale, {
        toValue: 2.1,
        friction: 4,
        tension: 160,
        useNativeDriver: true,
      }),
      Animated.spring(touchTranslateY, {
        toValue: -20,
        friction: 4,
        tension: 160,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    Animated.parallel([
      Animated.spring(touchScale, {
        toValue: 1,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.spring(touchTranslateY, {
        toValue: 0,
        friction: 5,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsPressed(false);
      onReact(emoji);
    });
  };

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        zIndex: isPressed ? 999 : 1,
      }}
    >
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.reactionPillItem}
      >
        <Animated.View
          style={{
            transform: [
              { scale: touchScale },
              { translateY: touchTranslateY },
            ],
          }}
        >
          <Text style={styles.reactionPillEmoji}>{emoji}</Text>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

// Bảng màu avatar người dùng phong phú, hiện đại
const AVATAR_COLORS = [
  "#059669", "#0284c7", "#7c3aed", "#db2777", "#d97706",
  "#4f46e5", "#0891b2", "#16a34a", "#e11d48", "#9333ea"
];

function getAvatarBgColor(name?: string): string {
  if (!name) return "#059669";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function isValidHttpUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  if (
    !trimmed ||
    trimmed === "null" ||
    trimmed === "undefined" ||
    trimmed === "default" ||
    trimmed === "none" ||
    trimmed === "[object object]" ||
    trimmed.length < 5
  ) {
    return false;
  }
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("file://")
  );
}

function extractInitials(name?: string): string {
  if (!name || typeof name !== "string") return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (parts.length === 1) {
    return parts[0][0].toUpperCase();
  }
  return "";
}

const AI_AVATAR = require("../../public/lux-pfp.png");
const CLOUD_AVATAR = require("../../public/cloud.png");

/**
 * Avatar người dùng cá nhân (dùng cho danh sách chọn, thành viên phòng chat, người gửi tin nhắn)
 */
function UserAvatar({
  photoURL,
  name,
  size = 40,
  fontSize = 15,
  style,
}: {
  photoURL?: string | null;
  name?: string;
  size?: number;
  fontSize?: number;
  style?: any;
}) {
  const [loadError, setLoadError] = useState(false);
  const rawUrl = isValidHttpUrl(photoURL) ? photoURL!.trim() : null;
  const validUrl = rawUrl && rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl;

  useEffect(() => {
    setLoadError(false);
  }, [photoURL]);

  if (validUrl && !loadError) {
    return (
      <Image
        source={{ uri: validUrl }}
        style={[
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: "#f1f5f9",
          },
          style,
        ]}
        onError={() => setLoadError(true)}
      />
    );
  }

  const initials = extractInitials(name);
  const bgColor = getAvatarBgColor(name);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      {initials ? (
        <Text style={{ color: "#ffffff", fontSize, fontWeight: "700" }}>{initials}</Text>
      ) : (
        <Ionicons name="person" size={Math.round(size * 0.48)} color="#ffffff" />
      )}
    </View>
  );
}

/**
 * Avatar phòng chat (hỗ trợ Trợ lý AI, Nhóm trò chuyện, Trò chuyện 1-1, tự động fallback nếu không có avatar hoặc ảnh lỗi)
 */
function RoomAvatar({
  room,
  avatarUrl,
  roomName,
  isBot,
  isCloud,
  size = 50,
  fontSize = 18,
}: {
  room?: ChatRoom | null;
  avatarUrl?: string | null;
  roomName?: string;
  isBot?: boolean;
  isCloud?: boolean;
  size?: number;
  fontSize?: number;
}) {
  const [loadError, setLoadError] = useState(false);
  const validUrl = isValidHttpUrl(avatarUrl) ? avatarUrl!.trim() : null;

  useEffect(() => {
    setLoadError(false);
  }, [avatarUrl]);

  // 1. Trợ lý AI
  if (isBot) {
    return (
      <Image
        source={AI_AVATAR}
        style={[styles.avatarImg, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  // 2. Cloud của tôi
  if (isCloud) {
    return (
      <Image
        source={CLOUD_AVATAR}
        style={[styles.avatarImg, { width: size, height: size, borderRadius: size / 2 }]}
      />
    );
  }

  // 3. Nhóm trò chuyện
  if (room?.isGroup) {
    if (validUrl && !loadError) {
      return (
        <Image
          source={{ uri: validUrl }}
          style={[styles.avatarImg, { width: size, height: size, borderRadius: size / 2 }]}
          onError={() => setLoadError(true)}
        />
      );
    }
    return (
      <View
        style={[
          styles.avatarPlaceholder,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: "#0d9488" },
        ]}
      >
        <Ionicons name="people" size={Math.round(size * 0.44)} color="#ffffff" />
      </View>
    );
  }

  // 4. Trò chuyện 1-1: Có ảnh đại diện hợp lệ và tải thành công
  if (validUrl && !loadError) {
    return (
      <Image
        source={{ uri: validUrl }}
        style={[styles.avatarImg, { width: size, height: size, borderRadius: size / 2 }]}
        onError={() => setLoadError(true)}
      />
    );
  }

  // 5. Avatar mặc định khi không có ảnh (hoặc ảnh lỗi 404): Vòng tròn màu với chữ viết tắt hoặc icon người
  const initials = extractInitials(roomName);
  const bgColor = getAvatarBgColor(roomName);

  return (
    <View
      style={[
        styles.avatarPlaceholder,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
          alignItems: "center",
          justifyContent: "center",
        },
      ]}
    >
      {initials ? (
        <Text style={[styles.avatarInitial, { fontSize }]}>{initials}</Text>
      ) : (
        <Ionicons name="person" size={Math.round(size * 0.48)} color="#ffffff" />
      )}
    </View>
  );
}



export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { markRoomRead, refreshUnread } = useChatUnread();
  const currentUserId = (user as any)?._id || user?.uid || "";
  const router = useRouter();
  const [focused, setFocused] = useState(true);
  const focusedRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      setFocused(true);
      return () => {
        focusedRef.current = false;
        setFocused(false);
        messageVersion.current++;
      };
    }, [])
  );
  const activeIdRef = useRef<string | null>(null);
  const messageVersion = useRef(0);
  const roomsVersion = useRef(0);
  const { chatRooms, refreshChat, chatRevision, setActiveChatRoom } = useCommunication();
  const { roomId: requestedRoom } = useLocalSearchParams<{ roomId?: string }>();


  // Chat Rooms State
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"priority" | "other">("priority");
  const [searchQuery, setSearchQuery] = useState("");

  // Active Chat Room State
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  activeIdRef.current = activeRoom?._id || null;
  useEffect(() => {
    setActiveChatRoom(focused ? activeRoom?._id || null : null);
    return () => setActiveChatRoom(null);
  }, [focused, activeRoom?._id, setActiveChatRoom]);
  useEffect(() => {
    if (!requestedRoom || !focused) return;
    const room = rooms.find((item) => item._id === requestedRoom);
    if (room) {
      setActiveRoom(room);
      router.setParams({ roomId: undefined });
    }
  }, [requestedRoom, rooms, focused, router]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState("smileys");
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null);
  const [previewVideoUri, setPreviewVideoUri] = useState<string | null>(null);
  const [previewVideoName, setPreviewVideoName] = useState<string>("Video");

  // Audio Recorder từ expo-audio (thu âm microphone thực tế)
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordTimerRef = useRef<any>(null);

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
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [roomActionBusy, setRoomActionBusy] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [selectedAddMemberIds, setSelectedAddMemberIds] = useState<string[]>([]);
  const [groupNameDraft, setGroupNameDraft] = useState("");

  // Selected Message Actions Modal
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [messageActionModalVisible, setMessageActionModalVisible] = useState(false);
  const [reactionFullPickerVisible, setReactionFullPickerVisible] = useState(false);
  const [activeReactionCategory, setActiveReactionCategory] = useState("smileys");
  const [replyingMessage, setReplyingMessage] = useState<ChatMessage | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Forward / Share modal state
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);
  const [selectedForwardRoomIds, setSelectedForwardRoomIds] = useState<string[]>([]);
  const [forwardSearchQuery, setForwardSearchQuery] = useState("");
  const [forwardNote, setForwardNote] = useState("");
  const [isForwarding, setIsForwarding] = useState(false);

  // Search in conversation state
  const [showSearchInChat, setShowSearchInChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [showPinnedDropdown, setShowPinnedDropdown] = useState(false);

  // Floating rounded Toast feedback state
  const [toastText, setToastText] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimerRef = useRef<any>(null);

  // Rounded Custom Alert Modal State (Bo góc toàn diện cho tất cả thông báo trong module Chat)
  const [customAlert, setCustomAlert] = useState<{
    visible: boolean;
    title: string;
    message?: string;
    buttons: { text: string; style?: "default" | "cancel" | "destructive" | "secondary"; onPress?: () => void }[];
  }>({
    visible: false,
    title: "",
    message: "",
    buttons: [],
  });

  const showCustomAlert = (
    title: string,
    message?: string,
    buttons?: { text: string; style?: "default" | "cancel" | "destructive" | "secondary"; onPress?: () => void }[]
  ) => {
    setCustomAlert({
      visible: true,
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : [{ text: "Đồng ý", style: "default" }],
    });
  };

  const hideCustomAlert = () => {
    setCustomAlert((prev) => ({ ...prev, visible: false }));
  };

  const getCurrentUserDisplayName = () => user?.displayName || (user as any)?.fullName || user?.email || "Bạn";

  const postRoomActivity = async (text: string) => {
    if (!activeRoom?._id || !text.trim()) return;
    try {
      await chat.sendMessage(activeRoom._id, `${ROOM_ACTIVITY_PREFIX}${text.trim()}`);
    } catch (err: any) {
      console.warn("Không thể gửi hoạt động nhóm vào cuộc trò chuyện:", err?.message);
    }
  };

  useEffect(() => {
    globalCustomAlert = (title, message) => {
      showCustomAlert(title, message);
    };
    return () => {
      globalCustomAlert = null;
    };
  }, []);

  const flatListRef = useRef<FlatList>(null);
  const pollingRef = useRef<any>(null);
  const isAtBottomRef = useRef(true);
  const isNavigatingToRepliedRef = useRef(false);
  const navigatingTimerRef = useRef<any>(null);
  const initialScrollDoneRef = useRef(false);

  // Theo dõi chiều cao bàn phím để nâng thanh chat lên ngay trên bàn phím (chuẩn như Zalo)
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      if (isAtBottomRef.current && !isNavigatingToRepliedRef.current) {
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 80);
      }
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Helper lấy string ID của người gửi (hỗ trợ cả ObjectId object, populated object và string)
  const getSenderIdString = useCallback((senderId: any): string => {
    if (!senderId) return "";
    if (typeof senderId === "string") return senderId;
    if (senderId._id) return String(senderId._id);
    if (senderId.uid) return String(senderId.uid);
    if (typeof senderId.toString === "function") return senderId.toString();
    return String(senderId);
  }, []);

  // Helper nhận diện phòng Trợ lý AI
  const isChatbotRoom = useCallback((room?: ChatRoom | null) => {
    if (!room) return false;
    const name = (room.name || "").trim().toLowerCase();
    return !!room.isChatbot || name === "trợ lý ai" || name === "trợ lí ai";
  }, []);

  const isCloudRoom = useCallback((room?: ChatRoom | null) => {
    const name = (room?.name || "").trim().toLowerCase();
    return name === "cloud" || name === "cloud của tôi" || name.includes("cloud của tôi");
  }, []);

  // Helper kiểm tra phòng có được ghim lên đầu hay không
  const isRoomPinned = useCallback(
    (room?: ChatRoom | null) => {
      if (!room) return false;
      if (isChatbotRoom(room) || isCloudRoom(room)) return true;
      if (room.isPinned !== undefined) return !!room.isPinned;
      const member = room.members?.find((m) => {
        const uId = typeof m.userId === "object" ? m.userId?._id || m.userId?.uid : m.userId;
        return uId === currentUserId;
      });
      return !!member?.isPinned;
    },
    [currentUserId, isChatbotRoom, isCloudRoom]
  );

  // Lấy ảnh đại diện của phòng chat (nhóm dùng avatar nhóm, 1-1 lấy ảnh profile của người đối diện)
  const getRoomAvatarUrl = useCallback(
    (room?: ChatRoom | null): string | null => {
      if (!room) return null;
      if (isValidHttpUrl(room.avatarURL)) {
        return room.avatarURL!.trim();
      }
      if (!room.isGroup) {
        const otherMember = room.members?.find((m) => {
          const uId = typeof m.userId === "object" ? m.userId?._id || m.userId?.uid : m.userId;
          return uId !== currentUserId;
        });
        if (typeof otherMember?.userId === "object" && isValidHttpUrl(otherMember.userId?.photoURL)) {
          return otherMember.userId.photoURL!.trim();
        }
      }
      return null;
    },
    [currentUserId]
  );

  // Lấy ảnh đại diện người gửi của tin nhắn (từ senderPhoto, senderId.photoURL, hoặc members/phòng chat)
  const getMessageSenderPhoto = useCallback(
    (item: ChatMessage): string | null => {
      // 1. Ảnh trực tiếp trên tin nhắn
      if (isValidHttpUrl(item.senderPhoto)) {
        return item.senderPhoto!.trim();
      }

      // 2. Đối tượng senderId nếu được backend populate
      const sender = typeof item.senderId === "object" ? (item.senderId as any) : null;
      const directPhoto = sender?.photoURL || sender?.avatarURL || sender?.avatarUrl || sender?.profilePhoto;
      if (isValidHttpUrl(directPhoto)) {
        return directPhoto.trim();
      }

      const senderIdStr = String(sender?._id || sender?.uid || item.senderId || "").trim();
      const senderName = (item.senderName || "").trim().toLowerCase();

      // 3. Trong cuộc trò chuyện 1-1: Mọi tin nhắn của đối phương (!isMe) có cùng avatar với phòng chat (như thanh Header)
      if (activeRoom && !activeRoom.isGroup) {
        const roomPhoto = getRoomAvatarUrl(activeRoom);
        if (isValidHttpUrl(roomPhoto)) {
          return roomPhoto!.trim();
        }
        if (isValidHttpUrl(activeRoom.avatarURL)) {
          return activeRoom.avatarURL!.trim();
        }
      }

      // 4. Tra cứu từ activeRoom.members
      if (activeRoom?.members) {
        const member = activeRoom.members.find((m) => {
          const memberUser = typeof m.userId === "object" ? (m.userId as any) : null;
          const memberId = String(memberUser?._id || memberUser?.uid || m.userId || "").trim();
          return (
            (senderIdStr && memberId === senderIdStr) ||
            (!!senderName && [memberUser?.displayName, memberUser?.email].some((value) =>
              String(value || "").trim().toLowerCase() === senderName,
            ))
          );
        });
        const memberUser = typeof member?.userId === "object" ? (member.userId as any) : null;
        const memberPhoto = memberUser?.photoURL || memberUser?.avatarURL || memberUser?.avatarUrl || memberUser?.profilePhoto;
        if (isValidHttpUrl(memberPhoto)) {
          return memberPhoto.trim();
        }

        if (!activeRoom.isGroup) {
          const otherMember = activeRoom.members.find((m) => {
            const memberUser = typeof m.userId === "object" ? (m.userId as any) : null;
            const memberId = String(memberUser?._id || memberUser?.uid || m.userId || "").trim();
            return memberId && memberId !== currentUserId;
          });
          const otherUser = typeof otherMember?.userId === "object" ? (otherMember.userId as any) : null;
          const otherPhoto = otherUser?.photoURL || otherUser?.avatarURL || otherUser?.avatarUrl || otherUser?.profilePhoto;
          if (isValidHttpUrl(otherPhoto)) return otherPhoto.trim();
        }
      }

      // 5. Tra cứu từ danh sách toàn bộ nhân viên (usersList)
      if (usersList && usersList.length > 0) {
        const foundUser = usersList.find((u) => {
          const uid = String(u.uid || (u as any)._id || "").trim();
          return (
            (senderIdStr && uid === senderIdStr) ||
            (!!senderName && [u.displayName, u.email].some((val) =>
              String(val || "").trim().toLowerCase() === senderName,
            ))
          );
        });
        if (foundUser && isValidHttpUrl(foundUser.photoURL)) {
          return foundUser.photoURL!.trim();
        }
      }

      // 6. Tra cứu từ danh sách rooms đã tải
      if (rooms && rooms.length > 0) {
        for (const r of rooms) {
          if (!r.isGroup && r.members) {
            const targetM = r.members.find((m) => {
              const mu = typeof m.userId === "object" ? (m.userId as any) : null;
              const mid = String(mu?._id || mu?.uid || m.userId || "").trim();
              return (
                (senderIdStr && mid === senderIdStr) ||
                (!!senderName && [mu?.displayName, mu?.email].some((val) =>
                  String(val || "").trim().toLowerCase() === senderName,
                ))
              );
            });
            if (targetM) {
              const mu = typeof targetM.userId === "object" ? (targetM.userId as any) : null;
              const photo = mu?.photoURL || mu?.avatarURL || mu?.avatarUrl || mu?.profilePhoto || r.avatarURL;
              if (isValidHttpUrl(photo)) return photo.trim();
            }
          }
        }
      }

      return null;
    },
    [activeRoom, currentUserId, getRoomAvatarUrl, usersList, rooms]
  );

  // 1. Fetch Rooms from API
  const loadRooms = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingRooms(true);
      try {
        const data = await chat.getRooms();
        const enriched = data.map((room) => {
          const isBot = isChatbotRoom(room);
          const computedAvatar = getRoomAvatarUrl(room);
          return {
            ...room,
            isChatbot: isBot,
            isPinned: isBot || isCloudRoom(room) ? true : isRoomPinned(room),
            avatarURL: computedAvatar || undefined,
          };
        });
        setRooms(enriched);
      } catch (err: any) {
        if (err?.message?.includes("canceled") || err?.name === "AbortError") return;
        console.warn("Lỗi tải danh sách phòng chat:", err?.message);
      } finally {
        setLoadingRooms(false);
        setRefreshing(false);
      }
    },
    [isChatbotRoom, isCloudRoom, isRoomPinned, getRoomAvatarUrl]
  );

  useEffect(() => {
    void userManagementApi
      .getUsers()
      .then((list) => {
        if (Array.isArray(list)) {
          setUsersList(list.filter((u) => u.uid !== currentUserId));
        }
      })
      .catch(() => {});
  }, [currentUserId]);

  // Share the provider snapshot while retaining main's avatar/pinned-room enrichment.
  useEffect(() => { if (focused) refreshChat(); }, [focused, refreshChat]);
  useEffect(() => {
    if (!chatRooms) {
      setRooms([]);
      setActiveRoom(null);
      return;
    }
    const enriched = chatRooms.map(room => ({
      ...room,
      isChatbot: isChatbotRoom(room),
      isPinned: isChatbotRoom(room) || isCloudRoom(room) ? true : isRoomPinned(room),
      avatarURL: getRoomAvatarUrl(room) || undefined,
    }));
    setRooms(enriched);
    setActiveRoom(current => current ? enriched.find(room => room._id === current._id) || null : null);
    setLoadingRooms(false);
  }, [chatRooms, isChatbotRoom, isCloudRoom, isRoomPinned, getRoomAvatarUrl]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void loadRooms(true);
  }, [loadRooms]);

  // 2. Load Messages for Active Room
  const loadMessages = useCallback(async (roomId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const data = await chat.getMessages(roomId, 60);
      // Sắp xếp theo thứ tự thời gian tăng dần (cũ ở trên, mới nhất ở dưới cùng giống Zalo)
      const sorted = [...data].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      // Giữ lại các tin nhắn đang gửi (optimistic status: sending) chưa được lưu trên server, tránh bị polling xóa mất
      setMessages((prev) => {
        const pending = prev.filter((m) => m.status === "sending");
        if (pending.length === 0) return sorted;
        const serverIds = new Set(sorted.map((m) => m._id));
        const stillPending = pending.filter((m) => !serverIds.has(m._id));
        return [...sorted, ...stillPending];
      });
      void chat.markAsRead(roomId);
      markRoomRead(roomId);
    } catch (err: any) {
      if (err?.message?.includes("canceled") || err?.name === "AbortError") return;
      console.warn("Lỗi tải tin nhắn:", err?.message);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  const activeRoomRef = useRef<ChatRoom | null>(null);
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  const currentUserIdRef = useRef<string>(currentUserId);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  // Đảm bảo kết nối Socket nếu chưa kết nối
  useEffect(() => {
    const token = api.getAccessToken();
    if (token && !socketService.isConnected) {
      socketService.connect(token);
    }
  }, []);

  // Lắng nghe sự kiện WebSocket thời gian thực (real-time):
  // 1. Khi có tin nhắn mới (internal_new_message) -> cập nhật ngay tin nhắn mới nhất, số tin chưa đọc, thứ tự phòng
  // 2. Khi phòng chat được cập nhật (internal_room_updated)
  // 3. Khi tin nhắn bị thu hồi (internal_message_deleted)
  // 4. Khi tin nhắn được đọc (internal_messages_read)
  // 5. Khi tin nhắn được chỉnh sửa (internal_message_edited)
  useEffect(() => {
    const handleNewMessage = (payload: { roomId: string; message: ChatMessage; roomUpdate?: any }) => {
      if (!payload || !payload.roomId) return;
      const { roomId, message, roomUpdate } = payload;

      // 1. Cập nhật phòng active nếu người dùng đang ở trong phòng này
      if (activeRoomRef.current?._id === roomId) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;

          // Nếu tin nhắn là của chính mình gửi:
          const msgSenderId = getSenderIdString(message.senderId);
          const isFromMe = msgSenderId === currentUserIdRef.current;
          if (isFromMe) {
            // Tìm tin nhắn tạm đang gửi (temp_)
            // Khớp nội dung tin nhắn hoặc lấy tin tạm đầu tiên
            const tempIndex = prev.findIndex(
              (m) =>
                typeof m._id === "string" &&
                (m._id.startsWith("temp_") || m.status === "sending") &&
                (m.content === message.content || (!m.content && !message.content))
            );
            const fallbackTempIndex =
              tempIndex !== -1
                ? tempIndex
                : prev.findIndex(
                    (m) => typeof m._id === "string" && (m._id.startsWith("temp_") || m.status === "sending")
                  );

            if (fallbackTempIndex !== -1) {
              // Thay thế trực tiếp tin tạm bằng tin nhắn thực tế từ socket
              const updated = [...prev];
              updated[fallbackTempIndex] = message;
              return updated;
            }
          }

          return [...prev, message];
        });
        void chat.markAsRead(roomId);
        markRoomRead(roomId);
      }

      // 2. Cập nhật ngay lập tức danh sách phòng (rooms) ở màn hình ngoài:
      // Tin nhắn mới nhất, thời gian, số tin chưa đọc, và thứ tự phòng
      setRooms((prev) => {
        const index = prev.findIndex((r) => r._id === roomId);
        if (index === -1) {
          // Nếu là phòng mới chưa có trong list, fetch lại list
          void loadRooms(true);
          return prev;
        }

        const room = prev[index];
        const msgSenderId = getSenderIdString(message.senderId);
        const isFromMe = msgSenderId === currentUserIdRef.current;
        const isActive = activeRoomRef.current?._id === roomId;
        const newUnread = isActive || isFromMe ? 0 : (room.unreadCount || 0) + 1;

        const isBot = isChatbotRoom(room);
        const isCloud = isCloudRoom(room);
        const updatedRoom: ChatRoom = {
          ...room,
          ...(roomUpdate ? { name: roomUpdate.name } : {}),
          isChatbot: isBot,
          isPinned: isBot || isCloud ? true : (roomUpdate?.isPinned !== undefined ? roomUpdate.isPinned : room.isPinned),
          lastMessage: message,
          updatedAt: message.createdAt || new Date().toISOString(),
          unreadCount: newUnread,
        };

        const updatedList = [...prev];
        updatedList[index] = updatedRoom;
        return updatedList;
      });

      // Tải ngầm lại danh sách phòng để đồng bộ 100% với server
      void loadRooms(true);
    };

    const handleRoomUpdated = (updatedRoom: any) => {
      if (!updatedRoom || !updatedRoom._id) return;
      void loadRooms(true);
    };

    const handleMessageDeleted = (payload: { roomId: string; messageId: string }) => {
      if (!payload) return;
      if (activeRoomRef.current?._id === payload.roomId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._id === payload.messageId ? { ...m, isDeleted: true, content: "Tin nhắn đã được thu hồi" } : m
          )
        );
      }
      void loadRooms(true);
    };

    const handleMessagesRead = (payload: { roomId: string; userId: string }) => {
      if (!payload?.roomId) return;
      if (payload.userId === currentUserIdRef.current) {
        setRooms((prev) =>
          prev.map((r) => (r._id === payload.roomId ? { ...r, unreadCount: 0 } : r))
        );
      }
      void loadRooms(true);
      if (payload.roomId === activeRoomRef.current?._id && typeof payload.userId === "string") {
        setMessages((current) =>
          current.map((message) =>
            message.readBy?.includes(payload.userId)
              ? message
              : { ...message, readBy: [...(message.readBy || []), payload.userId] }
          )
        );
      }
    };

    const handleMessageEdited = (payload: { roomId: string; messageId: string; message: ChatMessage }) => {
      if (!payload?.roomId) return;
      setRooms((prev) =>
        prev.map((r) => {
          if (r._id === payload.roomId && r.lastMessage?._id === payload.messageId) {
            return { ...r, lastMessage: payload.message };
          }
          return r;
        })
      );
      if (activeRoomRef.current?._id === payload.roomId) {
        setMessages((prev) =>
          prev.map((m) => (m._id === payload.messageId ? { ...m, ...payload.message } : m))
        );
      }
    };

    socketService.on("internal_new_message", handleNewMessage);
    socketService.on("internal_room_updated", handleRoomUpdated);
    socketService.on("internal_message_deleted", handleMessageDeleted);
    socketService.on("internal_messages_read", handleMessagesRead);
    socketService.on("internal_message_edited", handleMessageEdited);

    return () => {
      socketService.off("internal_new_message", handleNewMessage);
      socketService.off("internal_room_updated", handleRoomUpdated);
      socketService.off("internal_message_deleted", handleMessageDeleted);
      socketService.off("internal_messages_read", handleMessagesRead);
      socketService.off("internal_message_edited", handleMessageEdited);
    };
  }, [loadRooms, isChatbotRoom, isCloudRoom, getSenderIdString]);

  const getActiveRoomMember = useCallback(
    (room: ChatRoom | null) =>
      room?.members?.find((member) => {
        const memberId = typeof member.userId === "object" ? member.userId?._id || member.userId?.uid : member.userId;
        return memberId === currentUserId;
      }),
    [currentUserId],
  );

  const canManageActiveGroup = useMemo(() => {
    const member = getActiveRoomMember(activeRoom);
    return Boolean(member?.role === "admin" || (activeRoom && activeRoom.creatorId === currentUserId));
  }, [activeRoom, currentUserId, getActiveRoomMember]);

  const handleUpdateActiveRoom = async (updateData: { name?: string; avatarURL?: string; onlyAdminsCanMessage?: boolean }) => {
    if (!activeRoom?._id || !activeRoom.isGroup) return;
    setRoomActionBusy(true);
    try {
      const updatedRoom = await chat.updateRoom(activeRoom._id, updateData);
      setActiveRoom(updatedRoom);
      setRooms((prev) => prev.map((room) => (room._id === updatedRoom._id ? updatedRoom : room)));
      const actor = getCurrentUserDisplayName();
      if (updateData.name !== undefined) await postRoomActivity(`${actor} đã đổi tên nhóm thành "${updateData.name}".`);
      if (updateData.avatarURL !== undefined) await postRoomActivity(`${actor} đã đổi ảnh đại diện nhóm.`);
      if (updateData.onlyAdminsCanMessage !== undefined) {
        await postRoomActivity(
          updateData.onlyAdminsCanMessage
            ? `${actor} đã bật quyền chỉ Trưởng/Phó phòng được nhắn tin.`
            : `${actor} đã tắt quyền chỉ Trưởng/Phó phòng được nhắn tin.`,
        );
      }
      showCustomAlert("Thành công", "Đã cập nhật thông tin nhóm.");
    } catch (err: any) {
      showCustomAlert("Lỗi", err?.message || "Không thể cập nhật nhóm chat.");
    } finally {
      setRoomActionBusy(false);
    }
  };

  const handlePickGroupAvatar = async () => {
    if (!activeRoom?.isGroup || !canManageActiveGroup) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const uploaded = await prepareAttachment(
        asset.uri,
        asset.fileName || `group_avatar_${Date.now()}.jpg`,
        asset.mimeType || "image/jpeg",
        asset.fileSize,
      );
      await handleUpdateActiveRoom({ avatarURL: uploaded.url });
    } catch (err: any) {
      showCustomAlert("Lỗi", err?.message || "Không thể đổi ảnh đại diện nhóm.");
    }
  };

  const handleAddSelectedMembers = async () => {
    if (!activeRoom?._id || selectedAddMemberIds.length === 0) return;
    setRoomActionBusy(true);
    try {
      const updatedRoom = await chat.addMembers(activeRoom._id, selectedAddMemberIds);
      setActiveRoom(updatedRoom);
      setRooms((prev) => prev.map((room) => (room._id === updatedRoom._id ? updatedRoom : room)));
      setSelectedAddMemberIds([]);
      setShowAddMembers(false);
      const addedNames = usersList
        .filter((candidate) => selectedAddMemberIds.includes(candidate.uid))
        .map((candidate) => candidate.displayName || candidate.email)
        .join(", ");
      await postRoomActivity(`${getCurrentUserDisplayName()} đã thêm ${addedNames || "thành viên mới"} vào nhóm.`);
      showCustomAlert("Thành công", "Đã thêm thành viên vào nhóm.");
    } catch (err: any) {
      showCustomAlert("Lỗi", err?.message || "Không thể thêm thành viên.");
    } finally {
      setRoomActionBusy(false);
    }
  };

  const handleRemoveGroupMember = (member: ChatRoomMember) => {
    if (!activeRoom?._id || !canManageActiveGroup) return;
    const memberUser = typeof member.userId === "object" ? member.userId : null;
    const memberId = memberUser?._id || memberUser?.uid;
    if (!memberId || memberId === currentUserId) return;
    const memberName = memberUser?.displayName || memberUser?.email || "thành viên";

    showCustomAlert("Xóa thành viên", `Bạn có chắc chắn muốn xóa ${memberName} khỏi nhóm không?`, [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          setRoomActionBusy(true);
          try {
            const updatedRoom = await chat.removeMember(activeRoom._id, memberId);
            setActiveRoom(updatedRoom);
            setRooms((prev) => prev.map((room) => (room._id === updatedRoom._id ? updatedRoom : room)));
            await postRoomActivity(`${getCurrentUserDisplayName()} đã xóa ${memberName} khỏi nhóm.`);
            showCustomAlert("Thành công", `Đã xóa ${memberName} khỏi nhóm.`);
          } catch (err: any) {
            showCustomAlert("Lỗi", err?.message || "Không thể xóa thành viên.");
          } finally {
            setRoomActionBusy(false);
          }
        },
      },
    ]);
  };

  const handleDissolveActiveGroup = () => {
    if (!activeRoom?._id || !canManageActiveGroup) return;
    showCustomAlert("Giải tán nhóm", "Bạn có chắc chắn muốn giải tán nhóm này không?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Giải tán",
        style: "destructive",
        onPress: async () => {
          setRoomActionBusy(true);
          try {
            await postRoomActivity(`${getCurrentUserDisplayName()} đã giải tán nhóm.`);
            await chat.deleteRoom(activeRoom._id);
            setRoomInfoModalVisible(false);
            setActiveRoom(null);
            void loadRooms(true);
            showCustomAlert("Thành công", "Đã giải tán nhóm.");
          } catch (err: any) {
            showCustomAlert("Lỗi", err?.message || "Không thể giải tán nhóm.");
          } finally {
            setRoomActionBusy(false);
          }
        },
      },
    ]);
  };

  // Polling for real-time messages when a room is active (fallback when socket disconnected)
  useEffect(() => {
    if (focused && activeRoom?._id) {
      const roomId = activeRoom._id;
      const refreshTimer = setTimeout(() => void loadMessages(roomId, initialScrollDoneRef.current), initialScrollDoneRef.current ? 150 : 0);
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => {
        if (!socketService.isConnected && AppState.currentState === "active") void loadMessages(activeRoom._id, true);
      }, 15000);
      return () => {
        clearTimeout(refreshTimer);
        messageVersion.current++;
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    } else {
      if (pollingRef.current) clearInterval(pollingRef.current);
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [focused, activeRoom?._id, loadMessages, chatRevision]);

  // Polling danh sách phòng chat khi đang đứng ở màn hình danh sách (activeRoom === null)
  // để luôn cập nhật tin nhắn mới nhất và số tin chưa đọc (real-time 3.5s fallback)
  const roomListPollingRef = useRef<any>(null);
  useEffect(() => {
    if (!activeRoom) {
      if (roomListPollingRef.current) clearInterval(roomListPollingRef.current);
      roomListPollingRef.current = setInterval(() => {
        void loadRooms(true);
      }, 3500);
    } else {
      if (roomListPollingRef.current) clearInterval(roomListPollingRef.current);
    }
    return () => {
      if (roomListPollingRef.current) clearInterval(roomListPollingRef.current);
    };
  }, [activeRoom, loadRooms]);

  // Khi người dùng chuyển tab sang "Trò chuyện", tự động làm mới ngay danh sách và bảo đảm socket kết nối
  useFocusEffect(
    useCallback(() => {
      const token = api.getAccessToken();
      if (token && !socketService.isConnected) {
        socketService.connect(token);
      }
      void loadRooms(true);
    }, [loadRooms])
  );

  // Cuộn ngay xuống tin nhắn mới nhất khi vừa vào phòng và tải xong tin nhắn
  useEffect(() => {
    if (!loadingMessages && messages.length > 0 && !initialScrollDoneRef.current) {
      const t1 = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 50);
      const t2 = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 160);
      const t3 = setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
        initialScrollDoneRef.current = true;
        isAtBottomRef.current = true;
      }, 380);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [loadingMessages, messages.length, activeRoom?._id]);

  // 3. Open Conversation
  const handleOpenRoom = (room: ChatRoom) => {
    markRoomRead(room._id);
    setActiveRoom(room);
    setMessages([]); // Làm sạch tin nhắn phòng cũ, tránh bị trùng lặp hiển thị
    setChatSearchQuery("");
    setShowSearchInChat(false);
    isAtBottomRef.current = true;
    isNavigatingToRepliedRef.current = false;
    initialScrollDoneRef.current = false;
  };

  const handleSaveGroupName = async () => {
    const nextName = groupNameDraft.trim();
    if (!nextName || nextName === activeRoom?.name) return;
    await handleUpdateActiveRoom({ name: nextName });
    setGroupNameDraft("");
  };

  const handleOpenRoomInfo = async () => {
    if (!activeRoom) return;
    setGroupNameDraft(activeRoom.name || "");
    setRoomInfoModalVisible(true);
    if (usersList.length === 0) {
      try {
        const list = await userManagementApi.getUsers();
        setUsersList(list.filter((item) => item.uid !== currentUserId));
      } catch (err: any) {
        console.warn("Lỗi tải danh sách thành viên:", err?.message);
      }
    }
  };

  const handleCloseRoom = () => {
    setActiveRoom(null);
    setMessages([]); // Làm sạch tin nhắn khi thoát phòng
    setShowEmojiPicker(false);
    isNavigatingToRepliedRef.current = false;
    initialScrollDoneRef.current = false;
    isAtBottomRef.current = true;
    if (navigatingTimerRef.current) clearTimeout(navigatingTimerRef.current);
    void loadRooms(true);
    void refreshUnread();
  };

  // Xử lý nút Back vật lý trên Android để thoát phòng chat mượt mà
  useEffect(() => {
    const onBackPress = () => {
      if (forwardModalVisible) {
        setForwardModalVisible(false);
        return true;
      }
      if (showPinnedDropdown) {
        setShowPinnedDropdown(false);
        return true;
      }
      if (previewVideoUri) {
        setPreviewVideoUri(null);
        return true;
      }
      if (previewImageUri) {
        setPreviewImageUri(null);
        return true;
      }
      if (reactionFullPickerVisible) {
        setReactionFullPickerVisible(false);
        return true;
      }
      if (roomInfoModalVisible) {
        setRoomInfoModalVisible(false);
        return true;
      }
      if (messageActionModalVisible) {
        setMessageActionModalVisible(false);
        return true;
      }
      if (replyingMessage) {
        setReplyingMessage(null);
        return true;
      }
      if (showEmojiPicker) {
        setShowEmojiPicker(false);
        return true;
      }
      if (activeRoom) {
        handleCloseRoom();
        return true;
      }
      return false;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => sub.remove();
  }, [forwardModalVisible, showPinnedDropdown, previewImageUri, reactionFullPickerVisible, roomInfoModalVisible, messageActionModalVisible, replyingMessage, showEmojiPicker, activeRoom]);

  // 3b. Toggle Room Selection for Forwarding
  const handleToggleForwardRoom = (roomId: string) => {
    setSelectedForwardRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId]
    );
  };

  // 3c. Execute Forwarding Message to Selected Rooms
  const handleExecuteForward = async () => {
    if (!forwardingMessage || selectedForwardRoomIds.length === 0 || isForwarding) return;
    setIsForwarding(true);
    try {
      const textToSend = forwardingMessage.content || "";
      const rawAttachments = forwardingMessage.attachments || [];
      // Loại bỏ uploadToken khỏi attachments khi chuyển tiếp:
      // Tệp đã được lưu trữ vĩnh viễn trên hệ thống. Nếu gửi kèm uploadToken cũ của người
      // tải lên ban đầu, backend sẽ kiểm tra quyền sở hữu token và báo lỗi:
      // "Upload không thuộc người tải lên hiện tại."
      const attachments = rawAttachments.map(({ uploadToken, ...rest }) => ({
        url: rest.url,
        name: rest.name || "Tệp đính kèm",
        type: rest.type || "application/octet-stream",
        size: rest.size,
      }));
      const note = forwardNote.trim();

      for (const targetRoomId of selectedForwardRoomIds) {
        // Gửi tin nhắn được chuyển tiếp
        if (textToSend || (attachments && attachments.length > 0)) {
          await chat.sendMessage(targetRoomId, textToSend, attachments);
        }
        // Gửi kèm tin nhắn ghi chú nếu có
        if (note) {
          await chat.sendMessage(targetRoomId, note);
        }
      }

      showCustomAlert(
        "Thành công",
        `Đã chuyển tiếp tin nhắn đến ${selectedForwardRoomIds.length} cuộc trò chuyện.`
      );
      setForwardModalVisible(false);
      setForwardingMessage(null);
      setSelectedForwardRoomIds([]);
      setForwardNote("");
      setForwardSearchQuery("");
      void loadRooms(true);
    } catch (err: any) {
      showCustomAlert("Lỗi", err?.message || "Không thể chuyển tiếp tin nhắn.");
    } finally {
      setIsForwarding(false);
    }
  };

  // 4. Send Message
  const handleSendMessage = async (attachments?: ChatAttachment[]) => {
    if (!activeRoom?._id) return;
    const rawInput = inputText.trim();
    if (!rawInput && (!attachments || attachments.length === 0)) return;

    // Tự động trích xuất các đường link ảnh / audio / file nếu người dùng dán (paste) trực tiếp
    let finalAttachments: ChatAttachment[] = attachments ? [...attachments] : [];
    let textToSend = rawInput;

    if (rawInput && (!attachments || attachments.length === 0)) {
      const lines = rawInput.split(/\r?\n/);
      const textLines: string[] = [];
      const extractedAtts: ChatAttachment[] = [];

      for (const line of lines) {
        const trimmed = line.trim();
        const isHttpOrFile =
          trimmed.startsWith("http://") ||
          trimmed.startsWith("https://") ||
          trimmed.startsWith("file://") ||
          trimmed.startsWith("data:");
        if (isHttpOrFile && !trimmed.includes(" ")) {
          const isImg = isImageAttachment({ url: trimmed });
          const isVid = isVideoAttachment({ url: trimmed });
          const isAud = !isVid && isAudioAttachment({ url: trimmed });

          if (isImg) {
            extractedAtts.push({ url: trimmed, type: "image/jpeg", name: "Hình ảnh" });
            continue;
          } else if (isVid) {
            extractedAtts.push({ url: trimmed, type: "video/mp4", name: "Video.mp4" });
            continue;
          } else if (isAud) {
            extractedAtts.push({ url: trimmed, type: "audio/mpeg", name: "Ghi âm" });
            continue;
          }
        }
        textLines.push(line);
      }

      if (extractedAtts.length > 0) {
        finalAttachments = extractedAtts;
        textToSend = textLines.join("\n").trim();
      }
    }

    const replyId = replyingMessage?._id;
    const currentRoomId = activeRoom._id;
    const tempId = `temp_txt_${Date.now()}`;

    // Optimistic UI: Hiển thị ngay lập tức trong khung chat không cần chờ mạng (chuẩn Zalo)
    const optimisticMessage: any = {
      _id: tempId,
      roomId: currentRoomId,
      senderId: currentUserId,
      senderName: user?.displayName || (user as any)?.fullName || "Tôi",
      content: textToSend,
      attachments: finalAttachments.length > 0 ? finalAttachments : undefined,
      replyTo: replyingMessage || undefined,
      createdAt: new Date().toISOString(),
      status: "sending",
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInputText("");
    setReplyingMessage(null);
    isAtBottomRef.current = true;
    isNavigatingToRepliedRef.current = false;
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 60);

    setSending(true);
    try {
      const sentMsg = await chat.sendMessage(
        currentRoomId,
        textToSend,
        finalAttachments.length > 0 ? finalAttachments : undefined,
        replyId
      );
      setMessages((prev) => {
        if (prev.some((m) => m._id === sentMsg._id)) {
          return prev.filter((m) => m._id !== tempId);
        }
        return prev.map((m) => (m._id === tempId ? sentMsg : m));
      });
      void loadRooms(true);
    } catch (err: any) {
      setMessages((prev) => prev.map((m) => (m._id === tempId ? { ...m, status: "failed" } : m)));
      showToast("Không thể gửi tin nhắn");
    } finally {
      setSending(false);
    }
  };

  // 5. Send Image Attachment (Hiện ảnh tức thì trong chat & Tải ngầm như Zalo)
  const handlePickImage = async () => {
    try {
      // Đặt quality: 1.0 để Android dùng RawImageExporter (không giải mã/nén bitmap hàng loạt gây đơ 2-3s)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        allowsMultipleSelection: true,
        selectionLimit: 30,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (!activeRoom?._id) return;
        const currentRoomId = activeRoom._id;
        const tempId = `temp_img_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        // 1. TẠO NGAY TIN NHẮN TẠM (OPTIMISTIC) HIỂN THỊ TRỰC TIẾP TRÊN MÀN HÌNH CHAT (0ms)
        const localAttachments: ChatAttachment[] = result.assets.map((asset, i) => {
          const isVid =
            asset.type === "video" ||
            asset.mimeType?.startsWith("video/") ||
            asset.fileName?.match(/\.(mp4|mov|avi|mkv|webm)$/i);
          return {
            url: asset.uri,
            type: isVid ? (asset.mimeType || "video/mp4") : (asset.mimeType || "image/jpeg"),
            name: asset.fileName || (isVid ? `VID_${Date.now()}_${i + 1}.mp4` : `IMG_${Date.now()}_${i + 1}.jpg`),
            size: asset.fileSize,
          };
        });

        const optimisticMessage: any = {
          _id: tempId,
          roomId: currentRoomId,
          senderId: currentUserId,
          senderName: user?.displayName || (user as any)?.fullName || "Tôi",
          content: "",
          attachments: localAttachments,
          createdAt: new Date().toISOString(),
          status: "sending",
        };

        setMessages((prev) => [...prev, optimisticMessage]);
        isAtBottomRef.current = true;
        flatListRef.current?.scrollToEnd({ animated: true });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 60);

        // 2. CHỜ 250ms ĐỂ REACT NATIVE VẼ XONG ẢNH & XOAY SPINNER LÊN MÀN HÌNH RỒI MỚI UPLOAD NGẦM
        setTimeout(() => {
          void (async () => {
            try {
              const uploadTasks = result.assets.map(async (asset, i) => {
                if (!asset.uri) return null;
                const isVid =
                  asset.type === "video" ||
                  asset.mimeType?.startsWith("video/") ||
                  asset.fileName?.match(/\.(mp4|mov|avi|mkv|webm)$/i);
                const fileName = asset.fileName || (isVid ? `VID_${Date.now()}_${i + 1}.mp4` : `IMG_${Date.now()}_${i + 1}.jpg`);
                const mimeType = isVid ? (asset.mimeType || "video/mp4") : (asset.mimeType || "image/jpeg");
                try {
                  const att = await prepareAttachment(asset.uri, fileName, mimeType, asset.fileSize, asset.base64);
                  if (att.url && !att.url.startsWith("file://")) {
                    return att;
                  }
                } catch (err) {
                  console.warn("Lỗi upload media:", err);
                }
                return null;
              });

              const uploadResults = await Promise.all(uploadTasks);
              const uploadedList = uploadResults.filter(Boolean) as ChatAttachment[];

              if (uploadedList.length > 0) {
                const sentMsg = await chat.sendMessage(currentRoomId, "", uploadedList);
                setMessages((prev) => {
                  if (prev.some((m) => m._id === sentMsg._id)) {
                    return prev.filter((m) => m._id !== tempId);
                  }
                  return prev.map((m) => (m._id === tempId ? sentMsg : m));
                });
                void loadRooms(true);
              } else {
                setMessages((prev) =>
                  prev.map((m) => (m._id === tempId ? { ...m, status: "failed" } : m))
                );
              }
            } catch (err) {
              console.warn("Lỗi gửi ảnh ngầm:", err);
              setMessages((prev) =>
                prev.map((m) => (m._id === tempId ? { ...m, status: "failed" } : m))
              );
            }
          })();
        }, 250);
      }
    } catch (err) {
      console.warn("Lỗi chọn ảnh:", err);
    }
  };

  // 5b. Chụp ảnh trực tiếp từ Camera và gửi (Hiện tức thì & Upload ngầm)
  const handleTakePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showCustomAlert("Quyền truy cập", "Vui lòng cấp quyền máy ảnh để chụp và gửi ảnh trực tiếp.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets[0]?.uri && activeRoom?._id) {
        const asset = result.assets[0];
        const currentRoomId = activeRoom._id;
        const tempId = `temp_photo_${Date.now()}`;
        const fileName = asset.fileName || `PHOTO_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || "image/jpeg";

        const optimisticMessage: any = {
          _id: tempId,
          roomId: currentRoomId,
          senderId: currentUserId,
          senderName: user?.displayName || (user as any)?.fullName || "Tôi",
          content: "",
          attachments: [{ url: asset.uri, name: fileName, type: mimeType, size: asset.fileSize }],
          createdAt: new Date().toISOString(),
          status: "sending",
        };

        setMessages((prev) => [...prev, optimisticMessage]);
        isAtBottomRef.current = true;
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 50);

        (async () => {
          try {
            const att = await prepareAttachment(asset.uri, fileName, mimeType, asset.fileSize, asset.base64);
            if (att.url && !att.url.startsWith("file://")) {
              const sentMsg = await chat.sendMessage(currentRoomId, "", [att]);
              setMessages((prev) => {
                if (prev.some((m) => m._id === sentMsg._id)) {
                  return prev.filter((m) => m._id !== tempId);
                }
                return prev.map((m) => (m._id === tempId ? sentMsg : m));
              });
              void loadRooms(true);
            } else {
              setMessages((prev) => prev.map((m) => (m._id === tempId ? { ...m, status: "failed" } : m)));
            }
          } catch (err) {
            setMessages((prev) => prev.map((m) => (m._id === tempId ? { ...m, status: "failed" } : m)));
          }
        })();
      }
    } catch {}
  };

  // 5c. Bắt đầu thu âm giọng nói thực tế từ Microphone
  const handleStartRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        showCustomAlert("Quyền truy cập", "Vui lòng cấp quyền Microphone để ghi âm giọng nói.");
        return;
      }

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setIsRecording(true);
      setRecordingSeconds(0);

      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.warn("Lỗi bắt đầu ghi âm:", err);
      showCustomAlert("Lỗi", "Không thể bắt đầu ghi âm.");
    }
  };

  const handleCancelRecording = async () => {
    try {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      await audioRecorder.stop();
    } catch {}
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const handleSendVoiceNote = async () => {
    try {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      await audioRecorder.stop();
      const recordedUri = audioRecorder.uri;
      const duration = recordingSeconds;
      setIsRecording(false);
      setRecordingSeconds(0);

      if (recordedUri) {
        const fileName = `Voice_${Date.now().toString().slice(-4)}.m4a`;
        const mimeType = "audio/m4a";
        const estimatedSize = Math.max(1, duration) * 16384;
        const att = await prepareAttachment(recordedUri, fileName, mimeType, estimatedSize);
        void handleSendMessage([att]);
      }
    } catch (err: any) {
      console.warn("Lỗi gửi ghi âm:", err);
      setIsRecording(false);
      showCustomAlert("Lỗi", "Không thể gửi tin nhắn thoại.");
    }
  };

  // 5d. Chọn và gửi tệp âm thanh / ghi âm có sẵn
  const handlePickAudio = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*", "audio/mpeg", "audio/mp3", "audio/m4a", "audio/wav", "audio/aac"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const file = result.assets[0];
        let fileName = file.name;
        if (!fileName || !fileName.trim()) {
          const uriParts = file.uri.split("/");
          fileName = decodeURIComponent(uriParts[uriParts.length - 1]) || `Audio_${Date.now()}.mp3`;
        }
        const mimeType = file.mimeType || "audio/mpeg";
        const att = await prepareAttachment(file.uri, fileName, mimeType, file.size);
        void handleSendMessage([att]);
      }
    } catch {}
  };

  // 6. Send File Attachment (Hiện tài liệu tức thì trong chat & Tải ngầm như Zalo)
  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        if (!activeRoom?._id) return;
        const currentRoomId = activeRoom._id;
        const tempId = `temp_doc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

        // 1. TẠO NGAY TIN NHẮN TẠM HIỆN LÊN KHUNG CHAT (0ms)
        const localAttachments: ChatAttachment[] = result.assets.map((file, i) => {
          let fileName = file.name;
          if (!fileName || !fileName.trim()) {
            const uriParts = file.uri.split("/");
            fileName = decodeURIComponent(uriParts[uriParts.length - 1]) || `File_${Date.now()}_${i + 1}`;
          }
          return {
            url: file.uri,
            type: file.mimeType || "application/octet-stream",
            name: fileName,
            size: file.size,
          };
        });

        const optimisticMessage: any = {
          _id: tempId,
          roomId: currentRoomId,
          senderId: currentUserId,
          senderName: user?.displayName || (user as any)?.fullName || "Tôi",
          content: "",
          attachments: localAttachments,
          createdAt: new Date().toISOString(),
          status: "sending",
        };

        setMessages((prev) => [...prev, optimisticMessage]);
        isAtBottomRef.current = true;
        flatListRef.current?.scrollToEnd({ animated: true });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 60);

        // 2. CHỜ 250ms ĐỂ REACT NATIVE VẼ TÀI LIỆU LÊN MÀN HÌNH RỒI MỚI UPLOAD NGẦM
        setTimeout(() => {
          void (async () => {
            try {
              const uploadTasks = result.assets.map(async (file, i) => {
                if (!file.uri) return null;
                let fileName = file.name;
                if (!fileName || !fileName.trim()) {
                  const uriParts = file.uri.split("/");
                  fileName = decodeURIComponent(uriParts[uriParts.length - 1]) || `File_${Date.now()}_${i + 1}`;
                }
                const mimeType = file.mimeType || "application/octet-stream";
                try {
                  const att = await prepareAttachment(file.uri, fileName, mimeType, file.size);
                  if (att.url && !att.url.startsWith("file://")) {
                    return att;
                  }
                } catch (err) {
                  console.warn("Lỗi upload tài liệu:", err);
                }
                return null;
              });

              const uploadResults = await Promise.all(uploadTasks);
              const uploadedList = uploadResults.filter(Boolean) as ChatAttachment[];

              if (uploadedList.length > 0) {
                const sentMsg = await chat.sendMessage(currentRoomId, "", uploadedList);
                setMessages((prev) => {
                  if (prev.some((m) => m._id === sentMsg._id)) {
                    return prev.filter((m) => m._id !== tempId);
                  }
                  return prev.map((m) => (m._id === tempId ? sentMsg : m));
                });
                void loadRooms(true);
              } else {
                setMessages((prev) =>
                  prev.map((m) => (m._id === tempId ? { ...m, status: "failed" } : m))
                );
              }
            } catch (err: any) {
              setMessages((prev) =>
                prev.map((m) => (m._id === tempId ? { ...m, status: "failed" } : m))
              );
            }
          })();
        }, 250);
      }
    } catch (err: any) {
      console.warn("Lỗi chọn nhiều tài liệu:", err);
      showCustomAlert("Lỗi", "Không thể chọn tệp tin từ thiết bị.");
    }
  };

  // 6b. Tải về và lưu tệp tin / ghi âm / ảnh / excel về máy
  const handleDownloadAttachment = async (att: ChatAttachment) => {
    try {
      const url = att.url?.trim();
      if (!url) throw new Error("Không tìm thấy đường dẫn tệp.");
      const originalName = getCleanFileName(att);
      const name = ["Tệp tài liệu", "Tệp đính kèm"].includes(originalName) ? undefined : originalName;
      if (Platform.OS === "web" && (/^https?:/i.test(url) || url.startsWith("/"))) {
        await shareApiFile(resolveFileUrl(url), name || "tai-lieu");
        return;
      }
      let format = resolveFileFormat({ name, url, mimeType: /^data:([^;,]+)/.exec(url)?.[1] || att.type });
      let localUri: string;
      if (/^https?:/i.test(url) || url.startsWith("/")) {
        showToast("Đang tải tệp xuống...");
        const downloaded = await downloadRemoteFile(resolveFileUrl(url), name, att.type);
        localUri = downloaded.uri;
        format = downloaded;
      } else {
        const directory = FileSystem.cacheDirectory;
        if (!directory) throw new Error("Bộ nhớ tạm chưa sẵn sàng.");
        localUri = directory + Date.now() + "-" + format.name;
        if (url.startsWith("data:")) {
          if (!/^data:[^,]*;base64,/i.test(url)) throw new Error("Dữ liệu tệp không phải Base64.");
          await FileSystem.writeAsStringAsync(localUri, url.slice(url.indexOf(",") + 1), { encoding: "base64" });
        } else if (/^(file|content):/.test(url)) {
          await FileSystem.copyAsync({ from: url, to: localUri });
        } else throw new Error("Liên kết tải tệp không hợp lệ.");
      }
      if (format.mimeType.startsWith("image/") || format.mimeType.startsWith("video/")) {
        const saved = await saveDownloadedMedia(localUri, format.mimeType.startsWith("video/") ? "video" : "image").catch(() => "unavailable");
        if (saved === "saved") { showToast("Đã lưu vào thư viện"); return; }
      }
      if (!(await Sharing.isAvailableAsync())) throw new Error("Thiết bị chưa hỗ trợ lưu hoặc chia sẻ tệp.");
      await Sharing.shareAsync(localUri, { mimeType: format.mimeType, dialogTitle: "Lưu " + format.name });
    } catch (err: any) {
      showCustomAlert("Lỗi tải tệp", err?.message || "Không thể tải tệp. Vui lòng thử lại.");
    }
  };
  // 6c. Tải toàn bộ tệp từ tin nhắn đang chọn
  const handleDownloadMessageFiles = async (msg: ChatMessage) => {
    setMessageActionModalVisible(false);
    const files = extractDownloadableAttachments(msg);
    if (files.length === 0) {
      showToast("Tin nhắn không có tệp để tải về");
      return;
    }
    if (files.length === 1) {
      void handleDownloadAttachment(files[0]);
    } else {
      showCustomAlert(
        "Tải về tệp đính kèm",
        `Tin nhắn có ${files.length} tệp tin. Bạn muốn tải tệp nào?`,
        [
          ...files.map((f, idx) => ({
            text: `Tải #${idx + 1}: ${getCleanFileName(f)}`,
            onPress: () => void handleDownloadAttachment(f),
          })),
          { text: "Đóng", style: "cancel" as const },
        ]
      );
    }
  };

  // 7. Toggle Pin Room
  const handleTogglePin = async (roomId: string) => {
    try {
      await chat.togglePinRoom(roomId);
      void loadRooms(true);
    } catch (err: any) {
      showCustomAlert("Lỗi", err?.message || "Không thể thay đổi ghim.");
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
      showCustomAlert("Lỗi", err?.message || "Không thể thu hồi tin nhắn.");
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
      showCustomAlert("Lỗi", err?.message || "Không thể thả cảm xúc.");
    }
  };

  // 10. Pin / Unpin Message in Room
  const handlePinMessage = async (msg: ChatMessage) => {
    if (!activeRoom?._id) return;
    try {
      const updatedRoom = await chat.pinMessage(activeRoom._id, msg._id);
      setActiveRoom(updatedRoom);
      setMessageActionModalVisible(false);
      showCustomAlert("Thành công", "Đã ghim tin nhắn lên đầu cuộc trò chuyện.");
    } catch (err: any) {
      showCustomAlert("Lỗi", err?.message || "Không thể ghim tin nhắn.");
    }
  };

  const handleUnpinMessage = async (msgId: string) => {
    if (!activeRoom?._id) return;
    try {
      const updatedRoom = await chat.unpinMessage(activeRoom._id, msgId);
      setActiveRoom(updatedRoom);
      showCustomAlert("Thành công", "Đã bỏ ghim tin nhắn.");
    } catch (err: any) {
      showCustomAlert("Lỗi", err?.message || "Không thể bỏ ghim tin nhắn.");
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
      showCustomAlert("Thông báo", "Vui lòng chọn ít nhất một người để bắt đầu cuộc trò chuyện.");
      return;
    }

    const isGroup = selectedUserIds.length > 1;
    if (isGroup && !groupName.trim()) {
      showCustomAlert("Thông báo", "Vui lòng nhập tên nhóm chat.");
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
      showCustomAlert("Lỗi tạo phòng", err?.message || "Không thể tạo cuộc trò chuyện mới.");
    } finally {
      setCreatingRoom(false);
    }
  };

  // 13. Helpers for Room Display
  const getRoomDisplayName = (room: ChatRoom) => {
    if (isChatbotRoom(room)) return "Trợ lý AI";
    if (isCloudRoom(room)) return "Cloud của tôi";
    if (room.name) return room.name;
    if (!room.isGroup) {
      const otherMember = room.members?.find((m) => {
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

  const renderForwardRoomItem = (room: ChatRoom) => {
    const isSelected = selectedForwardRoomIds.includes(room._id);
    const roomName = getRoomDisplayName(room);

    return (
      <TouchableOpacity
        key={room._id}
        style={styles.forwardRoomItem}
        onPress={() => handleToggleForwardRoom(room._id)}
        activeOpacity={0.7}
      >
        <View style={styles.forwardRoomAvatar}>
          <RoomAvatar
            room={room}
            avatarUrl={getRoomAvatarUrl(room)}
            roomName={roomName}
            isBot={isChatbotRoom(room)}
            isCloud={isCloudRoom(room)}
            size={44}
            fontSize={16}
          />
        </View>

        <Text style={styles.forwardRoomName} numberOfLines={1}>
          {roomName}
        </Text>

        <View style={styles.forwardCheckboxWrap}>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={24} color="#0284c7" />
          ) : (
            <View style={styles.forwardUncheckedCircle} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderForwardModal = () => (
    <Modal
      visible={forwardModalVisible}
      animationType="slide"
      onRequestClose={() => setForwardModalVisible(false)}
    >
      <SafeAreaView style={styles.modalSafeArea}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* 1. Header: Back + Title "Chia sẻ" + "Đã chọn: X" */}
          <View style={styles.forwardHeader}>
            <TouchableOpacity
              onPress={() => setForwardModalVisible(false)}
              style={styles.forwardBackBtn}
              hitSlop={10}
            >
              <Ionicons name="arrow-back" size={24} color="#0f172a" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.forwardHeaderTitle}>Chia sẻ</Text>
              <Text style={styles.forwardHeaderSubtitle}>
                Đã chọn: {selectedForwardRoomIds.length}
              </Text>
            </View>
          </View>

          {/* 2. Search Bar */}
          <View style={styles.forwardSearchWrap}>
            <Ionicons name="search-outline" size={18} color="#94a3b8" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.forwardSearchInput}
              placeholder="Tìm kiếm"
              placeholderTextColor="#94a3b8"
              value={forwardSearchQuery}
              onChangeText={setForwardSearchQuery}
            />
            {forwardSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setForwardSearchQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </View>

          {/* 3. Conversations List */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {(() => {
              const q = forwardSearchQuery.toLowerCase().trim();
              const matchedRooms = q
                ? rooms.filter((r) => getRoomDisplayName(r).toLowerCase().includes(q))
                : rooms;

              if (matchedRooms.length === 0) {
                return (
                  <View style={styles.forwardEmptyWrap}>
                    <Text style={styles.forwardEmptyText}>Không tìm thấy cuộc trò chuyện phù hợp</Text>
                  </View>
                );
              }

              if (q) {
                return (
                  <View style={{ marginTop: 8 }}>
                    {matchedRooms.map((room) => renderForwardRoomItem(room))}
                  </View>
                );
              }

              const recentRooms = matchedRooms.slice(0, 5);
              const groupRooms = matchedRooms.filter((r) => r.isGroup);
              const directRooms = matchedRooms.filter((r) => !r.isGroup);

              return (
                <>
                  {/* Gần đây */}
                  {recentRooms.length > 0 && (
                    <View style={styles.forwardSection}>
                      <Text style={styles.forwardSectionTitle}>Gần đây</Text>
                      {recentRooms.map((room) => renderForwardRoomItem(room))}
                    </View>
                  )}

                  {/* Nhóm trò chuyện */}
                  {groupRooms.length > 0 && (
                    <View style={styles.forwardSection}>
                      <Text style={styles.forwardSectionTitle}>Nhóm trò chuyện</Text>
                      {groupRooms.map((room) => renderForwardRoomItem(room))}
                    </View>
                  )}

                  {/* Trò chuyện trực tiếp */}
                  {directRooms.length > 0 && (
                    <View style={styles.forwardSection}>
                      <Text style={styles.forwardSectionTitle}>Trò chuyện trực tiếp</Text>
                      {directRooms.map((room) => renderForwardRoomItem(room))}
                    </View>
                  )}
                </>
              );
            })()}
          </ScrollView>

          {/* 4. Bottom Forward Bar: Preview message + Note input + Send button */}
          {forwardingMessage && (
            <View
              style={[
                styles.forwardFooterContainer,
                { paddingBottom: Math.max(insets.bottom, 10) },
              ]}
            >
              {/* Preview Box of message being forwarded */}
              <View style={styles.forwardPreviewCard}>
                {(() => {
                  const firstAtt = forwardingMessage.attachments?.[0];
                  if (firstAtt) {
                    const isImg =
                      firstAtt.type?.startsWith("image/") ||
                      firstAtt.url?.match(/\.(jpeg|jpg|gif|png|webp)($|\?)/i);
                    const isAud =
                      firstAtt.type?.startsWith("audio/") ||
                      firstAtt.url?.match(/\.(mp3|m4a|wav|aac|ogg)($|\?)/i);

                    if (isImg) {
                      return (
                        <Image
                          source={{ uri: firstAtt.url }}
                          style={styles.forwardPreviewThumb}
                          resizeMode="cover"
                        />
                      );
                    }
                    if (isAud) {
                      return (
                        <View style={styles.forwardPreviewIconWrap}>
                          <Ionicons name="mic" size={20} color="#0284c7" />
                        </View>
                      );
                    }
                    return (
                      <View style={styles.forwardPreviewIconWrap}>
                        <Ionicons name="document-text" size={20} color="#0284c7" />
                      </View>
                    );
                  }
                  return (
                    <View style={styles.forwardPreviewIconWrap}>
                      <Ionicons name="chatbubble-ellipses" size={20} color="#0284c7" />
                    </View>
                  );
                })()}

                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.forwardPreviewText} numberOfLines={2}>
                    {forwardingMessage.content ||
                      (forwardingMessage.attachments?.[0]?.name
                        ? forwardingMessage.attachments[0].name
                        : forwardingMessage.attachments?.length
                        ? "Hình ảnh"
                        : "Tin nhắn")}
                  </Text>
                </View>
              </View>

              {/* Input Note & Send Action */}
              <View style={styles.forwardInputRow}>
                <TextInput
                  style={styles.forwardNoteInput}
                  placeholder="Nhập tin nhắn"
                  placeholderTextColor="#94a3b8"
                  value={forwardNote}
                  onChangeText={setForwardNote}
                />

                <TouchableOpacity
                  style={[
                    styles.forwardSendBtn,
                    (selectedForwardRoomIds.length === 0 || isForwarding) && styles.forwardSendBtnDisabled,
                  ]}
                  onPress={() => void handleExecuteForward()}
                  disabled={selectedForwardRoomIds.length === 0 || isForwarding}
                  activeOpacity={0.8}
                >
                  {isForwarding ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Ionicons name="send" size={18} color="#ffffff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );

  // Hiển thị Toast thông báo bo tròn đẹp mắt
  const showToast = (text: string) => {
    if (Platform.OS === "android") {
      try {
        ToastAndroid.show(text, ToastAndroid.SHORT);
      } catch {}
    }
    setToastText(text);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    Animated.timing(toastOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    toastTimerRef.current = setTimeout(() => {
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setToastText(null);
      });
    }, 2500);
  };

  const renderToast = () => {
    if (!toastText) return null;
    return (
      <Animated.View
        style={[styles.floatingToastWrap, { opacity: toastOpacity }]}
        pointerEvents="none"
      >
        <View style={styles.floatingToastPill}>
          <Ionicons name="checkmark-circle" size={19} color="#34d399" />
          <Text style={styles.floatingToastText}>{toastText}</Text>
        </View>
      </Animated.View>
    );
  };

  // Popup thông báo / Hộp thoại cảnh báo bo góc tròn (Chuẩn UX Mobile cao cấp, nền trắng thuần, nút đóng X)
  const renderCustomAlert = () => {
    if (!customAlert.visible) return null;

    // Lọc bỏ nút "Đóng" nếu đã có icon đóng ở góc trên bên phải popup
    const effectiveButtons = customAlert.buttons.filter(
      (b) => b.style !== "cancel" && b.text.trim().toLowerCase() !== "đóng"
    );
    const isTwoButtons = effectiveButtons.length === 2;

    return (
      <Modal
        visible={customAlert.visible}
        transparent
        animationType="fade"
        onRequestClose={hideCustomAlert}
      >
        <Pressable style={styles.customAlertOverlay} onPress={hideCustomAlert}>
          <Pressable style={styles.customAlertCard} onPress={(e) => e.stopPropagation()}>
            {/* Nút đóng icon X góc trên bên phải */}
            <TouchableOpacity
              style={styles.customAlertCloseBtn}
              onPress={hideCustomAlert}
              hitSlop={12}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#64748b" />
            </TouchableOpacity>

            <Text style={styles.customAlertTitle}>{customAlert.title}</Text>
            {!!customAlert.message && (
              <Text style={styles.customAlertMessage}>{customAlert.message}</Text>
            )}

            {effectiveButtons.length > 0 && (
              <View
                style={[
                  styles.customAlertBtnContainer,
                  isTwoButtons ? styles.customAlertBtnRow : styles.customAlertBtnCol,
                ]}
              >
                {effectiveButtons.map((btn, idx) => {
                  const isDestructive = btn.style === "destructive";
                  const isSecondary = btn.style === "secondary";
                  const isPrimary = !isDestructive && !isSecondary;

                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.customAlertBtn,
                        isTwoButtons && { flex: 1 },
                        isDestructive && styles.customAlertBtnDestructive,
                        isSecondary && styles.customAlertBtnSecondary,
                        isPrimary && styles.customAlertBtnPrimary,
                      ]}
                      onPress={() => {
                        hideCustomAlert();
                        if (btn.onPress) btn.onPress();
                      }}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.customAlertBtnText,
                          isDestructive && styles.customAlertBtnTextDestructive,
                          isSecondary && styles.customAlertBtnTextSecondary,
                          isPrimary && styles.customAlertBtnTextPrimary,
                        ]}
                        numberOfLines={2}
                      >
                        {btn.text}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    );
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
      list = list.filter((r) => isChatbotRoom(r) || isCloudRoom(r) || r.isGroup);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((r) => {
        const name = getRoomDisplayName(r).toLowerCase();
        const lastMsg = (r.lastMessage?.content || "").toLowerCase();
        return name.includes(q) || lastMsg.includes(q);
      });
    }
    return list.sort((a, b) => {
      // 1. Trợ lý AI luôn luôn đứng đầu
      const aIsBot = isChatbotRoom(a) ? 1 : 0;
      const bIsBot = isChatbotRoom(b) ? 1 : 0;
      if (aIsBot !== bIsBot) return bIsBot - aIsBot;

      // 2. Cloud của tôi luôn đứng ngay sau Trợ lý AI
      const aIsCloud = isCloudRoom(a) ? 1 : 0;
      const bIsCloud = isCloudRoom(b) ? 1 : 0;
      if (aIsCloud !== bIsCloud) return bIsCloud - aIsCloud;

      // 3. Các cuộc trò chuyện được ghim tiếp theo
      const aPinned = (a.isPinned || isRoomPinned(a)) ? 1 : 0;
      const bPinned = (b.isPinned || isRoomPinned(b)) ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;

      // 4. Cuối cùng sắp xếp theo thời gian cập nhật mới nhất
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });
  }, [rooms, activeTab, searchQuery, isChatbotRoom, isCloudRoom, isRoomPinned]);

  // Messages filtered by in-chat search & deduplicated by _id
  const displayedMessages = useMemo(() => {
    const seen = new Set<string>();
    const deduped: ChatMessage[] = [];
    for (const m of messages) {
      if (m._id && seen.has(m._id)) continue;
      if (m._id) seen.add(m._id);
      deduped.push(m);
    }
    if (!chatSearchQuery.trim()) return deduped;
    const q = chatSearchQuery.toLowerCase().trim();
    return deduped.filter((m) => (m.content || "").toLowerCase().includes(q));
  }, [messages, chatSearchQuery]);

  // Pinned messages list in active room
  const pinnedMessages = useMemo(() => {
    if (!activeRoom?.pinnedMessageIds || activeRoom.pinnedMessageIds.length === 0) return [];
    return activeRoom.pinnedMessageIds
      .map((pin: any) => {
        if (typeof pin === "object" && pin?._id) return pin as ChatMessage;
        return messages.find((m) => m._id === pin) || null;
      })
      .filter(Boolean) as ChatMessage[];
  }, [activeRoom, messages]);

  const pinnedMessage = pinnedMessages.length > 0 ? pinnedMessages[pinnedMessages.length - 1] : null;

  // Cuộn mượt mà đến vị trí tin nhắn gốc được trích dẫn (chuẩn Zalo)
  const handleScrollToRepliedMessage = (targetMsgId: string) => {
    if (!targetMsgId) return;
    const targetIndex = displayedMessages.findIndex((m) => m._id === targetMsgId);
    if (targetIndex !== -1 && flatListRef.current) {
      isAtBottomRef.current = false;
      isNavigatingToRepliedRef.current = true;

      // Khóa auto-scroll trong 6 giây hoặc khi người dùng chủ động cuộn lại xuống đáy
      if (navigatingTimerRef.current) clearTimeout(navigatingTimerRef.current);
      navigatingTimerRef.current = setTimeout(() => {
        isNavigatingToRepliedRef.current = false;
      }, 6000);

      try {
        flatListRef.current.scrollToIndex({
          index: targetIndex,
          animated: true,
          viewPosition: 0.5,
        });
      } catch {
        flatListRef.current.scrollToOffset({
          offset: Math.max(0, targetIndex * 70),
          animated: true,
        });
      }

      // Nhấp nháy highlight tin nhắn mục tiêu
      setHighlightedMessageId(targetMsgId);
      setTimeout(() => {
        setHighlightedMessageId((curr) => (curr === targetMsgId ? null : curr));
      }, 2000);
    } else {
      showCustomAlert("Thông báo", "Tin nhắn gốc không nằm trong các tin nhắn được tải gần đây.");
    }
  };

  // Safe area padding cho header và bottom input bar
  const listHeaderTopPadding = (insets.top || (Platform.OS === "android" ? 28 : 16)) + 8;
  const roomHeaderTopPadding = (insets.top || (Platform.OS === "android" ? 28 : 16)) + 6;
  const bottomInsetPadding = Math.max(insets.bottom, Platform.OS === "android" ? 28 : 10);

  // ==========================================
  // RENDER CHAT ROOM SCREEN (DIRECT VIEW, NO MODAL OVERLAY)
  // Giúp Android và iOS hiển thị thanh nhập liệu ngay trên bàn phím chuẩn 100% như Zalo / Messenger
  // ==========================================
  if (activeRoom) {
    return (
      <View
        style={[
          styles.chatRoomSafeArea,
          {
            paddingBottom: Platform.OS === "android" && keyboardHeight > 0 ? keyboardHeight : 0,
          },
        ]}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        >
          {/* Chat Room Header (Cân đối chuẩn với thanh trạng thái) */}
          <View style={[styles.chatRoomHeader, { paddingTop: roomHeaderTopPadding }]}>
            <TouchableOpacity onPress={handleCloseRoom} style={styles.chatBackBtn}>
              <Ionicons name="arrow-back" size={24} color={LUXCARE_HEADER_TEXT} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chatTitleContainer}
              onPress={() => void handleOpenRoomInfo()}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View style={styles.chatHeaderAvatarWrap}>
                  <RoomAvatar
                    room={activeRoom}
                    avatarUrl={getRoomAvatarUrl(activeRoom)}
                    roomName={getRoomDisplayName(activeRoom)}
                    isBot={isChatbotRoom(activeRoom)}
                    isCloud={isCloudRoom(activeRoom)}
                    size={38}
                    fontSize={14}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatHeaderTitle} numberOfLines={1}>
                    {getRoomDisplayName(activeRoom)}
                  </Text>
                  <Text style={styles.chatHeaderSubtitle}>
                    {activeRoom.isGroup
                      ? `${activeRoom.members?.length || 0} thành viên`
                      : "Bấm để xem thông tin"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Search icon */}
            <TouchableOpacity
              style={styles.chatHeaderIconBtn}
              onPress={() => setShowSearchInChat((prev) => !prev)}
            >
              <Ionicons name="search-outline" size={22} color={LUXCARE_HEADER_TEXT} />
            </TouchableOpacity>

            {/* Menu icon */}
            <TouchableOpacity
              style={styles.chatHeaderIconBtn}
              onPress={() => void handleOpenRoomInfo()}
            >
              <Ionicons name="list" size={22} color={LUXCARE_HEADER_TEXT} />
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

          {/* Pinned Message Banner & Expandable Dropdown List (Chuẩn Zalo) */}
          {pinnedMessages.length > 0 && (
            <View style={styles.pinnedBannerWrapper}>
              <TouchableOpacity
                style={styles.pinnedBanner}
                onPress={() => setShowPinnedDropdown((prev) => !prev)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="chatbox-ellipses-outline"
                  size={18}
                  color={LUXCARE_PRIMARY}
                  style={{ marginRight: 8 }}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.pinnedTitle} numberOfLines={1}>
                    {pinnedMessages[pinnedMessages.length - 1]?.content ||
                      (pinnedMessages[pinnedMessages.length - 1]?.attachments?.length
                        ? "[Hình ảnh/Đính kèm]"
                        : "Tin nhắn ghim")}
                  </Text>
                  <Text style={styles.pinnedSubtitle}>
                    Tin nhắn của {pinnedMessages[pinnedMessages.length - 1]?.senderName || "Đồng nghiệp"}
                  </Text>
                </View>

                <View style={styles.pinnedBadge}>
                  {pinnedMessages.length > 1 && (
                    <Text style={styles.pinnedBadgeText}>+{pinnedMessages.length}</Text>
                  )}
                  <Ionicons
                    name={showPinnedDropdown ? "chevron-up" : "chevron-down"}
                    size={14}
                    color="#059669"
                  />
                </View>
              </TouchableOpacity>

              {/* BẢNG DANH SÁCH GHIM THẢ XUỐNG (CHUẨN ZALO) */}
              {showPinnedDropdown && (
                <View style={styles.pinnedDropdownCard}>
                  <View style={styles.pinnedDropdownHeader}>
                    <Text style={styles.pinnedDropdownTitle}>Danh sách ghim</Text>
                    <Text style={styles.pinnedDropdownSubtitle}>
                      {pinnedMessages.length} tin nhắn đã ghim
                    </Text>
                  </View>

                  <ScrollView
                    style={{ maxHeight: 220 }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {pinnedMessages.map((pin, idx) => (
                      <TouchableOpacity
                        key={pin._id || idx}
                        style={styles.pinnedDropdownItem}
                        onPress={() => {
                          setShowPinnedDropdown(false);
                          handleScrollToRepliedMessage(pin._id);
                        }}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="chatbubble-outline"
                          size={18}
                          color="#0284c7"
                          style={{ marginRight: 10, marginTop: 2 }}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.pinnedItemContent} numberOfLines={2}>
                            {idx + 1}. {pin.content || (pin.attachments?.length ? "[Hình ảnh/Đính kèm]" : "Tin nhắn")}
                          </Text>
                          <Text style={styles.pinnedItemSender}>
                            Tin nhắn của {pin.senderName || "Đồng nghiệp"}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Thanh điều khiển cuối bảng ghim */}
                  <View style={styles.pinnedDropdownFooter}>
                    <TouchableOpacity
                      style={styles.pinnedDropdownActionBtn}
                      onPress={() => {
                        showCustomAlert(
                          "Quản lý tin nhắn ghim",
                          "Chọn tin nhắn bạn muốn bỏ ghim:",
                          [
                            ...pinnedMessages.map((p, idx) => ({
                              text: `Bỏ ghim #${idx + 1}: ${(p.content || "[Đính kèm]").slice(0, 24)}...`,
                              style: "destructive" as const,
                              onPress: () => void handleUnpinMessage(p._id),
                            })),
                            { text: "Đóng", style: "cancel" as const },
                          ]
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="pencil-outline" size={15} color="#475569" style={{ marginRight: 4 }} />
                      <Text style={styles.pinnedDropdownActionText}>Chỉnh sửa / Bỏ ghim</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.pinnedDropdownActionBtn}
                      onPress={() => setShowPinnedDropdown(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.pinnedDropdownActionText}>Thu gọn</Text>
                      <Ionicons name="chevron-up" size={15} color="#475569" style={{ marginLeft: 3 }} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Messages Body */}
          {loadingMessages && messages.length === 0 ? (
            <View style={styles.centered}>
              <ActivityIndicator size="small" color={LUXCARE_PRIMARY} />
              <Text style={styles.loadingText}>Đang tải tin nhắn...</Text>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={displayedMessages}
              keyExtractor={(item, index) => (item._id ? `${item._id}-${index}` : `msg-${index}`)}
              contentContainerStyle={styles.messagesList}
              initialNumToRender={50}
              maxToRenderPerBatch={25}
              windowSize={15}
              removeClippedSubviews={Platform.OS === "android"}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              onScroll={(event) => {
                const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
                const paddingToBottom = 120;
                const isBottom =
                  layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
                // Chỉ cập nhật isAtBottomRef sau khi đã cuộn khởi tạo xong xuống đáy,
                // tránh việc FlatList vừa render ở offset 0 khiến isAtBottomRef bị gán false sai lầm
                if (initialScrollDoneRef.current) {
                  isAtBottomRef.current = isBottom;
                }
                if (isBottom) {
                  isNavigatingToRepliedRef.current = false;
                }
              }}
              scrollEventThrottle={32}
              onScrollToIndexFailed={(info) => {
                flatListRef.current?.scrollToOffset({
                  offset: Math.max(0, info.index * 60),
                  animated: true,
                });
              }}
              onContentSizeChange={() => {
                if (!initialScrollDoneRef.current) {
                  flatListRef.current?.scrollToEnd({ animated: false });
                } else if (isAtBottomRef.current && !isNavigatingToRepliedRef.current && !highlightedMessageId) {
                  flatListRef.current?.scrollToEnd({ animated: true });
                }
              }}
              onLayout={() => {
                if (!initialScrollDoneRef.current && displayedMessages.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }
              }}
              renderItem={({ item }) => {
                const senderIdStr = getSenderIdString(item.senderId);
                const isMe =
                  senderIdStr === currentUserId ||
                  item.senderId === "me" ||
                  item.senderId === currentUserId ||
                  (typeof item._id === "string" && item._id.startsWith("temp_")) ||
                  item.status === "sending";

                const isDeleted = !!item.isDeleted;
                const rawContent = item.content || "";
                const roomActivityText = !isDeleted ? getRoomActivityText(rawContent) : null;

                if (roomActivityText) {
                  return (
                    <View style={styles.systemMessageRow}>
                      <Ionicons name="information-circle-outline" size={15} color="#94a3b8" />
                      <Text style={styles.systemMessageText}>{roomActivityText}</Text>
                    </View>
                  );
                }

                // Tự động phân tách và hiển thị các đường link media (ảnh/audio/ghi âm) trong nội dung
                const effectiveAttachments: ChatAttachment[] = item.attachments ? [...item.attachments] : [];
                let cleanContent = rawContent;

                if (rawContent && !isDeleted) {
                  const lines = rawContent.split(/\r?\n/);
                  const nonMediaLines: string[] = [];

                  for (const rawLine of lines) {
                    const trimmed = rawLine.trim();
                    const isHttpOrFile =
                      trimmed.startsWith("http://") ||
                      trimmed.startsWith("https://") ||
                      trimmed.startsWith("file://") ||
                      trimmed.startsWith("data:");

                    if (isHttpOrFile && !trimmed.includes(" ")) {
                      const isImg = isImageAttachment({ url: trimmed });
                      const isVid = isVideoAttachment({ url: trimmed });
                      const isAud = !isVid && isAudioAttachment({ url: trimmed });

                      if (isImg) {
                        if (!effectiveAttachments.some((a) => a.url === trimmed)) {
                          effectiveAttachments.push({ url: trimmed, type: "image/jpeg", name: "Hình ảnh" });
                        }
                        continue;
                      } else if (isVid) {
                        if (!effectiveAttachments.some((a) => a.url === trimmed)) {
                          effectiveAttachments.push({ url: trimmed, type: "video/mp4", name: "Video.mp4" });
                        }
                        continue;
                      } else if (isAud) {
                        if (!effectiveAttachments.some((a) => a.url === trimmed)) {
                          effectiveAttachments.push({ url: trimmed, type: "audio/mpeg", name: "Ghi âm" });
                        }
                        continue;
                      }
                    }
                    nonMediaLines.push(rawLine);
                  }
                  cleanContent = nonMediaLines.join("\n").trim();
                }

                const emojiMeta =
                  !isDeleted && (!effectiveAttachments || effectiveAttachments.length === 0)
                    ? getEmojiOnlyMeta(cleanContent)
                    : { isEmojiOnly: false, count: 0 };

                // Thông tin tin nhắn được trả lời (nếu có)
                const repliedMsg = item.replyTo
                  ? typeof item.replyTo === "object" && item.replyTo?._id
                    ? (item.replyTo as ChatMessage)
                    : typeof item.replyTo === "string"
                    ? messages.find((m) => m._id === item.replyTo) || null
                    : null
                  : null;

                return (
                  <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
                    {!isMe && (
                      <View style={styles.msgSenderAvatar}>
                        {!activeRoom.isGroup ? (
                          <RoomAvatar
                            room={activeRoom}
                            avatarUrl={getRoomAvatarUrl(activeRoom)}
                            roomName={getRoomDisplayName(activeRoom)}
                            isBot={isChatbotRoom(activeRoom)}
                            isCloud={isCloudRoom(activeRoom)}
                            size={28}
                            fontSize={11}
                          />
                        ) : (
                          <UserAvatar
                            photoURL={getMessageSenderPhoto(item)}
                            name={item.senderName || "U"}
                            size={28}
                            fontSize={11}
                          />
                        )}
                      </View>
                    )}

                    <View style={{ maxWidth: "78%" }}>
                      {!isMe && activeRoom.isGroup && (
                        <Text style={styles.msgSenderName}>{item.senderName || "Đồng nghiệp"}</Text>
                      )}

                      <TouchableOpacity
                        style={[
                          styles.msgBubble,
                          isMe ? styles.msgBubbleMe : styles.msgBubbleOther,
                          isDeleted && styles.msgBubbleDeleted,
                          emojiMeta.isEmojiOnly && styles.msgBubbleEmojiOnly,
                          item._id === highlightedMessageId && styles.msgBubbleHighlighted,
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
                            {/* Khung hiển thị trích dẫn trả lời nếu có - Bấm để nhảy đến tin nhắn gốc */}
                            {repliedMsg && (
                              <TouchableOpacity
                                style={styles.bubbleReplyWrap}
                                onPress={() => handleScrollToRepliedMessage(repliedMsg._id)}
                                activeOpacity={0.7}
                              >
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.bubbleReplySender} numberOfLines={1}>
                                    {repliedMsg.senderName || "Đồng nghiệp"}
                                  </Text>
                                  <Text style={styles.bubbleReplyText} numberOfLines={1}>
                                    {repliedMsg.content || (repliedMsg.attachments?.length ? "[Hình ảnh/Tệp tin]" : "")}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            )}

                            {effectiveAttachments && effectiveAttachments.length > 0 && (
                              <View style={styles.msgAttachmentsWrap}>
                                {effectiveAttachments.map((att: ChatAttachment, idx: number) => {
                                  const isImg = isImageAttachment(att);
                                  const isVid = isVideoAttachment(att);
                                  const isAud = !isVid && isAudioAttachment(att);

                                  if (isImg) {
                                    return (
                                      <TouchableOpacity
                                        key={`img-${idx}-${att.url}`}
                                        style={styles.attItem}
                                        onPress={() => setPreviewImageUri(att.url)}
                                        activeOpacity={0.9}
                                      >
                                        <Image
                                          source={{ uri: att.url }}
                                          style={styles.attImage}
                                          resizeMode="cover"
                                        />
                                        {item.status === "sending" && (
                                          <View style={styles.attSpinnerCenterWrap}>
                                            <View style={styles.attSpinnerBadge}>
                                              <ActivityIndicator size="small" color="#ffffff" />
                                            </View>
                                          </View>
                                        )}
                                      </TouchableOpacity>
                                    );
                                  }

                                  if (isVid) {
                                    return (
                                      <ChatVideoBubble
                                        key={`vid-${idx}-${att.url}`}
                                        att={att}
                                        isMe={isMe}
                                        isSending={item.status === "sending"}
                                        onPress={() => {
                                          setPreviewVideoName(getCleanFileName(att) || "Video");
                                          setPreviewVideoUri(att.url);
                                        }}
                                      />
                                    );
                                  }

                                  if (isAud) {
                                    return (
                                      <View key={`aud-${idx}-${att.url}`} style={styles.voiceNoteWrap}>
                                        <VoiceNoteBubble att={att} isMe={isMe} />
                                      </View>
                                    );
                                  }

                                  return (
                                    <TouchableOpacity
                                      key={`file-${idx}-${att.url}`}
                                      style={styles.attFileCard}
                                      onPress={() => {
                                        if (item.status !== "sending") {
                                          void handleDownloadAttachment(att);
                                        }
                                      }}
                                      activeOpacity={0.75}
                                    >
                                      <View style={styles.attFileIconWrap}>
                                        <Ionicons name="document-text" size={24} color={LUXCARE_PRIMARY} />
                                      </View>
                                      <View style={styles.attFileInfo}>
                                        <Text style={styles.attFileName} numberOfLines={1} ellipsizeMode="middle">
                                          {getCleanFileName(att)}
                                        </Text>
                                        <Text style={styles.attFileSize}>
                                          {item.status === "sending" ? "Đang gửi..." : formatFileSize(att.size)}
                                        </Text>
                                      </View>
                                      <View style={styles.attFileDownloadWrap}>
                                        {item.status === "sending" ? (
                                          <ActivityIndicator size="small" color={LUXCARE_PRIMARY} />
                                        ) : (
                                          <Ionicons name="arrow-down-outline" size={17} color="#475569" />
                                        )}
                                      </View>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            )}

                            {cleanContent ? (
                              emojiMeta.isEmojiOnly ? (
                                <Text
                                  style={[
                                    styles.msgTextBigEmoji,
                                    {
                                      fontSize:
                                        emojiMeta.count === 1
                                          ? 42
                                          : emojiMeta.count === 2
                                          ? 36
                                          : emojiMeta.count <= 4
                                          ? 30
                                          : 26,
                                      lineHeight:
                                        emojiMeta.count === 1
                                          ? 52
                                          : emojiMeta.count === 2
                                          ? 46
                                          : emojiMeta.count <= 4
                                          ? 40
                                          : 34,
                                    },
                                  ]}
                                >
                                  {cleanContent}
                                </Text>
                              ) : (
                                <Text style={[styles.msgText, isMe ? styles.msgTextMe : styles.msgTextOther]}>
                                  {cleanContent}
                                </Text>
                              )
                            ) : null}
                          </>
                        )}

                        {item.reactions && item.reactions.length > 0 && (
                          <View style={styles.reactionBadge}>
                            <Text style={styles.reactionBadgeText}>
                              {Array.from(new Set(item.reactions.map((r: any) => r.emoji))).join(" ")}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>

                      <View style={[styles.msgMetaRow, isMe && { justifyContent: "flex-end" }]}>
                        <Text style={styles.msgTimeText}>{formatMessageTime(item.createdAt)}</Text>
                        {isMe && (
                          <Text
                            style={[
                              styles.msgStatusText,
                              item.status === "sending" && { color: "#d97706" },
                              item.status === "failed" && { color: "#ef4444" },
                            ]}
                          >
                            {item.status === "sending"
                              ? "Đang gửi..."
                              : item.status === "failed"
                              ? "Lỗi gửi"
                              : item.readBy && item.readBy.length > 1
                              ? "✓✓ Đã xem"
                              : "✓ Đã gửi"}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              }}
            />
          )}

          {/* 3.5. Thanh xem trước tin nhắn đang trả lời (Chuẩn UI Zalo) */}
          {replyingMessage && (
            <View style={styles.replyPreviewBar}>
              <View style={styles.replyAccentLine} />
              <TouchableOpacity
                style={styles.replyInfoWrap}
                onPress={() => handleScrollToRepliedMessage(replyingMessage._id)}
                activeOpacity={0.7}
              >
                <Text style={styles.replySenderTitle} numberOfLines={1}>
                  {replyingMessage.senderName || "Đồng nghiệp"}
                </Text>
                <Text style={styles.replyContentSubtitle} numberOfLines={1}>
                  {replyingMessage.content || (replyingMessage.attachments?.length ? "[Hình ảnh/Tệp tin]" : "Tin nhắn")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.replyCloseBtn}
                onPress={() => setReplyingMessage(null)}
                hitSlop={10}
              >
                <Ionicons name="close" size={20} color="#64748b" />
              </TouchableOpacity>
            </View>
          )}

          {/* 4. Bottom Input Bar */}
          <View
            style={[
              styles.inputBarContainer,
              {
                paddingBottom: showEmojiPicker
                  ? 6
                  : Platform.OS === "ios"
                  ? Math.max(insets.bottom, 6)
                  : keyboardHeight > 0
                  ? 6
                  : (insets.bottom > 0 ? insets.bottom : 8),
              },
            ]}
          >
            {isRecording ? (
              <View style={styles.recordingBar}>
                <View style={styles.recordingIndicatorRow}>
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingTimerText}>
                    {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, "0")}
                  </Text>
                </View>

                <View style={styles.recordingActionsRow}>
                  <TouchableOpacity style={styles.recordingCancelBtn} onPress={handleCancelRecording} activeOpacity={0.7}>
                    <Ionicons name="trash-outline" size={16} color="#dc2626" />
                    <Text style={styles.recordingCancelText}>Hủy</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.recordingSendBtn} onPress={handleSendVoiceNote} activeOpacity={0.8}>
                    <Ionicons name="send" size={16} color="#ffffff" />
                    <Text style={styles.recordingSendText}>Gửi</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.inputIconBtn}
                  onPress={() => {
                    if (showEmojiPicker) {
                      setShowEmojiPicker(false);
                    } else {
                      Keyboard.dismiss();
                      setShowEmojiPicker(true);
                    }
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={showEmojiPicker ? "keypad-outline" : "happy-outline"}
                    size={24}
                    color={showEmojiPicker ? LUXCARE_PRIMARY : "#64748b"}
                  />
                </TouchableOpacity>

                <TextInput
                  style={[styles.chatTextInput, { maxHeight: 90 }]}
                  placeholder="Tin nhắn"
                  placeholderTextColor="#94a3b8"
                  value={inputText}
                  onChangeText={setInputText}
                  onFocus={() => {
                    setShowEmojiPicker(false);
                    setTimeout(() => {
                      flatListRef.current?.scrollToEnd({ animated: true });
                    }, 100);
                  }}
                  multiline
                />

                {inputText.trim().length === 0 ? (
                  <View style={styles.inputActionGroup}>
                    <TouchableOpacity style={styles.inputIconBtn} onPress={handleStartRecording} activeOpacity={0.7}>
                      <Ionicons name="mic-outline" size={24} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.inputIconBtn} onPress={handleTakePhoto} activeOpacity={0.7}>
                      <Ionicons name="camera-outline" size={24} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.inputIconBtn} onPress={handlePickImage} activeOpacity={0.7}>
                      <Ionicons name="image-outline" size={24} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.inputIconBtn} onPress={handlePickDocument} activeOpacity={0.7}>
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
              </>
            )}
          </View>

          {/* Khay bàn phím Emoji & Sticker phong phú chuẩn Mobile */}
          {showEmojiPicker && (
            <View style={[styles.emojiPickerContainer, { paddingBottom: bottomInsetPadding }]}>
              {/* Category Switcher Tabs */}
              <View style={styles.emojiCategoryRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiCategoryScroll}>
                  {EMOJI_CATEGORIES.map((cat) => {
                    const isActive = activeEmojiCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.emojiCategoryTab, isActive && styles.emojiCategoryTabActive]}
                        onPress={() => setActiveEmojiCategory(cat.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={cat.icon as any}
                          size={16}
                          color={isActive ? LUXCARE_PRIMARY : "#64748b"}
                        />
                        <Text style={[styles.emojiCategoryName, isActive && styles.emojiCategoryNameActive]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Emoji Grid Scroll */}
              <ScrollView
                style={styles.emojiGridScroll}
                contentContainerStyle={styles.emojiGridContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
              >
                <View style={styles.emojiGrid}>
                  {(EMOJI_CATEGORIES.find((c) => c.id === activeEmojiCategory)?.emojis || []).map((emoji, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.emojiBtn}
                      onPress={() => setInputText((prev) => prev + emoji)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.emojiChar}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              {/* Bottom Bar: Backspace & Quick Send */}
              <View style={styles.emojiPickerFooter}>
                <TouchableOpacity
                  style={styles.emojiBackspaceBtn}
                  onPress={() => setInputText((prev) => Array.from(prev).slice(0, -1).join(""))}
                  activeOpacity={0.7}
                >
                  <Ionicons name="backspace-outline" size={20} color="#475569" />
                  <Text style={styles.emojiBackspaceText}>Xóa</Text>
                </TouchableOpacity>

                {inputText.trim().length > 0 && (
                  <TouchableOpacity
                    style={styles.emojiQuickSendBtn}
                    onPress={() => void handleSendMessage()}
                    disabled={sending}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="send" size={14} color="#ffffff" style={{ marginRight: 4 }} />
                    <Text style={styles.emojiQuickSendText}>Gửi ({inputText.trim().length})</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </KeyboardAvoidingView>

        {/* MODAL: THAO TÁC TIN NHẮN (LONG PRESS) - CHUẨN ZALO VỚI REACTION BAR NỔI VÀ MENU LƯỚI */}
        <Modal
          visible={messageActionModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMessageActionModalVisible(false)}
        >
          <Pressable style={styles.actionModalOverlay} onPress={() => setMessageActionModalVisible(false)}>
            <View style={styles.actionModalCenterWrap}>
              {/* 1. FLOATING REACTION CAPSULE BAR (Thanh cảm xúc nổi chuẩn Zalo) */}
              <View style={styles.reactionCapsuleBar}>
                {ZALO_REACTIONS.map((emoji, idx) => (
                  <AnimatedReactionItem
                    key={emoji}
                    emoji={emoji}
                    index={idx}
                    modalVisible={messageActionModalVisible}
                    onReact={(em) => {
                      if (selectedMessage) void handleReactMessage(selectedMessage, em);
                    }}
                  />
                ))}

                {/* Nút dấu (+) để mở rộng kho emoji đầy đủ ĐỂ THẢ CẢM XÚC TIN NHẮN */}
                <TouchableOpacity
                  style={styles.reactionPlusBtn}
                  onPress={() => {
                    setMessageActionModalVisible(false);
                    setReactionFullPickerVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              {/* 2. ACTION GRID SHEET (Bảng chức năng dạng lưới 4 cột) */}
              {selectedMessage && (() => {
                const hasVideoAtt = selectedMessage.attachments?.some((a) => isVideoAttachment(a));
                const hasAudioAtt = selectedMessage.attachments?.some((a) => isAudioAttachment(a));
                const contentTrimmed = (selectedMessage.content || "").trim();
                const isPureAudioContent =
                  (contentTrimmed.startsWith("http://") || contentTrimmed.startsWith("https://")) &&
                  !contentTrimmed.includes(" ") &&
                  isAudioAttachment({ url: contentTrimmed });

                const isVoiceMessage = Boolean(hasAudioAtt || isPureAudioContent) && !hasVideoAtt;
                const downloadableFiles = extractDownloadableAttachments(selectedMessage);
                const hasDownloadableMedia = downloadableFiles.length > 0;

                return (
                  <View style={styles.actionGridCard}>
                    {/* Trả lời (Reply) */}
                    <TouchableOpacity
                      style={styles.actionGridItem}
                      onPress={() => {
                        setMessageActionModalVisible(false);
                        setReplyingMessage(selectedMessage);
                        if (activeRoom.isGroup && selectedMessage.senderName) {
                          setInputText((prev) =>
                            prev.startsWith(`@${selectedMessage.senderName}`)
                              ? prev
                              : `@${selectedMessage.senderName} ${prev}`
                          );
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.actionIconBadge, { backgroundColor: "#f5f3ff", borderColor: "#ede9fe" }]}>
                        <Ionicons name="arrow-undo-outline" size={22} color="#7c3aed" />
                      </View>
                      <Text style={styles.actionGridLabel}>Trả lời</Text>
                    </TouchableOpacity>

                    {/* Chuyển tiếp (Forward) */}
                    <TouchableOpacity
                      style={styles.actionGridItem}
                      onPress={() => {
                        setMessageActionModalVisible(false);
                        setForwardingMessage(selectedMessage);
                        setSelectedForwardRoomIds([]);
                        setForwardSearchQuery("");
                        setForwardNote("");
                        setForwardModalVisible(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.actionIconBadge, { backgroundColor: "#f0f9ff", borderColor: "#e0f2fe" }]}>
                        <Ionicons name="arrow-redo-outline" size={22} color="#0284c7" />
                      </View>
                      <Text style={styles.actionGridLabel}>Chuyển tiếp</Text>
                    </TouchableOpacity>

                    {/* Tải về (Download) - Hiển thị nếu tin nhắn có file ghi âm, excel, ảnh, tài liệu,... */}
                    {hasDownloadableMedia && (
                      <TouchableOpacity
                        style={styles.actionGridItem}
                        onPress={() => void handleDownloadMessageFiles(selectedMessage)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.actionIconBadge, { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" }]}>
                          <Ionicons name="download-outline" size={22} color="#059669" />
                        </View>
                        <Text style={styles.actionGridLabel}>Tải về</Text>
                      </TouchableOpacity>
                    )}

                    {/* Sao chép (Copy) - Ẩn đối với tin nhắn thoại / file ghi âm */}
                    {!isVoiceMessage && (
                      <TouchableOpacity
                        style={styles.actionGridItem}
                        onPress={async () => {
                          setMessageActionModalVisible(false);
                          const textToCopy = selectedMessage.content || "";
                          const attToCopy =
                            selectedMessage.attachments?.map((a) => a.url || a.name).join("\n") || "";
                          const fullCopy =
                            textToCopy && attToCopy
                              ? `${textToCopy}\n${attToCopy}`
                              : textToCopy || attToCopy;

                          if (fullCopy) {
                            try {
                              await Clipboard.setStringAsync(fullCopy);
                              showToast("Đã sao chép vào bộ nhớ tạm");
                            } catch {
                              showToast("Đã sao chép tin nhắn");
                            }
                          } else {
                            showToast("Tin nhắn không có nội dung để sao chép");
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.actionIconBadge, { backgroundColor: "#eff6ff", borderColor: "#dbeafe" }]}>
                          <Ionicons name="copy-outline" size={22} color="#2563eb" />
                        </View>
                        <Text style={styles.actionGridLabel}>Sao chép</Text>
                      </TouchableOpacity>
                    )}

                    {/* Ghim (Pin / Unpin) */}
                    <TouchableOpacity
                      style={styles.actionGridItem}
                      onPress={() => {
                        void handlePinMessage(selectedMessage);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.actionIconBadge, { backgroundColor: "#fff7ed", borderColor: "#ffedd5" }]}>
                        <Ionicons name="pin-outline" size={22} color="#ea580c" />
                      </View>
                      <Text style={styles.actionGridLabel}>Ghim</Text>
                    </TouchableOpacity>

                    {/* Chi tiết (Details) */}
                    <TouchableOpacity
                      style={styles.actionGridItem}
                      onPress={() => {
                        setMessageActionModalVisible(false);
                        showCustomAlert(
                          "Chi tiết tin nhắn",
                          `Người gửi: ${selectedMessage.senderName || "Đồng nghiệp"}\nThời gian: ${new Date(selectedMessage.createdAt).toLocaleString("vi-VN")}\nTrạng thái: ${selectedMessage.readBy && selectedMessage.readBy.length > 1 ? "Đã xem" : "Đã gửi"}`
                        );
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.actionIconBadge, { backgroundColor: "#f8fafc", borderColor: "#e2e8f0" }]}>
                        <Ionicons name="information-circle-outline" size={22} color="#64748b" />
                      </View>
                      <Text style={styles.actionGridLabel}>Chi tiết</Text>
                    </TouchableOpacity>

                    {/* Xóa / Thu hồi (Delete / Revoke) */}
                    <TouchableOpacity
                      style={styles.actionGridItem}
                      onPress={() => {
                        const senderIdStr = getSenderIdString(selectedMessage.senderId);
                        const isMe =
                          senderIdStr === currentUserId ||
                          selectedMessage.senderId === "me" ||
                          selectedMessage.senderId === currentUserId ||
                          (typeof selectedMessage._id === "string" && selectedMessage._id.startsWith("temp_")) ||
                          selectedMessage.status === "sending";

                        if (isMe) {
                          void handleDeleteMessage(selectedMessage);
                        } else {
                          showCustomAlert("Thông báo", "Bạn chỉ có thể thu hồi tin nhắn do chính bạn gửi.");
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.actionIconBadge, { backgroundColor: "#fef2f2", borderColor: "#fee2e2" }]}>
                        <Ionicons name="trash-outline" size={22} color="#dc2626" />
                      </View>
                      <Text style={[styles.actionGridLabel, { color: "#dc2626" }]}>Xóa</Text>
                    </TouchableOpacity>
                  </View>
                );
              })()}
            </View>
          </Pressable>
        </Modal>

        {/* MODAL: BẢNG CHỌN TOÀN BỘ EMOJI ĐỂ THẢ CẢM XÚC VÀO TIN NHẮN ĐANG CHỌN */}
        <Modal
          visible={reactionFullPickerVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setReactionFullPickerVisible(false)}
        >
          <Pressable style={styles.actionModalOverlay} onPress={() => setReactionFullPickerVisible(false)}>
            <View style={styles.reactionFullPickerCard}>
              <View style={styles.reactionFullPickerHeader}>
                <Text style={styles.reactionFullPickerTitle}>Biểu cảm tin nhắn</Text>
                <TouchableOpacity onPress={() => setReactionFullPickerVisible(false)} hitSlop={8}>
                  <Ionicons name="close-circle" size={22} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {/* Category Switcher Tabs */}
              <View style={styles.emojiCategoryRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiCategoryScroll}>
                  {EMOJI_CATEGORIES.map((cat) => {
                    const isActive = activeReactionCategory === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.emojiCategoryTab, isActive && styles.emojiCategoryTabActive]}
                        onPress={() => setActiveReactionCategory(cat.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={cat.icon as any}
                          size={16}
                          color={isActive ? LUXCARE_PRIMARY : "#64748b"}
                        />
                        <Text style={[styles.emojiCategoryName, isActive && styles.emojiCategoryNameActive]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Emoji Grid Scroll */}
              <ScrollView
                style={{ maxHeight: 260 }}
                contentContainerStyle={styles.emojiGridContent}
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.emojiGrid}>
                  {(EMOJI_CATEGORIES.find((c) => c.id === activeReactionCategory)?.emojis || []).map((emoji, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.emojiBtn}
                      onPress={() => {
                        if (selectedMessage) {
                          void handleReactMessage(selectedMessage, emoji);
                        }
                        setReactionFullPickerVisible(false);
                      }}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.emojiChar}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Modal>

        {/* MODAL: THÔNG TIN PHÒNG CHAT & THÀNH VIÊN */}
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
                <RoomAvatar
                  room={activeRoom}
                  avatarUrl={getRoomAvatarUrl(activeRoom)}
                  roomName={getRoomDisplayName(activeRoom)}
                  isBot={isChatbotRoom(activeRoom)}
                  size={72}
                  fontSize={28}
                />
                <Text style={styles.roomInfoName}>{getRoomDisplayName(activeRoom)}</Text>
                <Text style={styles.roomInfoType}>
                  {activeRoom.isGroup ? `Nhóm trò chuyện (${activeRoom.members?.length} thành viên)` : "Cuộc trò chuyện cá nhân"}
                </Text>
                {activeRoom.isGroup && canManageActiveGroup && (
                  <View style={{ width: "100%", marginTop: 16, gap: 10 }}>
                    <TextInput
                      style={styles.modalInput}
                      value={groupNameDraft}
                      onChangeText={setGroupNameDraft}
                      placeholder="Tên nhóm"
                      placeholderTextColor="#94a3b8"
                    />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <TouchableOpacity
                        style={[styles.roomManageBtn, { flex: 1 }]}
                        onPress={() => void handleSaveGroupName()}
                        disabled={roomActionBusy}
                      >
                        <Ionicons name="create-outline" size={18} color="#2563eb" />
                        <Text style={styles.roomManageBtnText}>Lưu tên</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.roomManageBtn, { flex: 1 }]}
                        onPress={() => void handlePickGroupAvatar()}
                        disabled={roomActionBusy}
                      >
                        <Ionicons name="image-outline" size={18} color="#059669" />
                        <Text style={styles.roomManageBtnText}>Đổi ảnh</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      style={styles.roomManageBtn}
                      onPress={() => void handleUpdateActiveRoom({ onlyAdminsCanMessage: !activeRoom.onlyAdminsCanMessage })}
                      disabled={roomActionBusy}
                    >
                      <Ionicons
                        name={activeRoom.onlyAdminsCanMessage ? "checkbox" : "square-outline"}
                        size={20}
                        color="#7c3aed"
                      />
                      <Text style={styles.roomManageBtnText}>Chỉ Trưởng/Phó phòng được nhắn tin</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Cài đặt thông báo cuộc trò chuyện */}
              <View style={{ padding: 16, marginTop: 16, borderRadius: 12, backgroundColor: "#ecfdf5", flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "#065f46", fontWeight: "700" }}>Thông báo cuộc trò chuyện</Text>
                  <Text style={{ color: "#475569", marginTop: 4 }}>
                    {savingNotifications ? "Đang lưu…" : (activeRoom && chatNotificationsMuted(activeRoom, currentUserId)) ? "Đã tắt thông báo" : "Đang bật thông báo"}
                  </Text>
                  <Text style={{ color: "#475569", marginTop: 4 }}>Tin nhắn và số chưa đọc vẫn được cập nhật.</Text>
                </View>
                <Switch
                  accessibilityLabel="Thông báo cuộc trò chuyện"
                  accessibilityState={{ busy: savingNotifications }}
                  value={Boolean(activeRoom && !chatNotificationsMuted(activeRoom, currentUserId))}
                  trackColor={{ false: "#cbd5e1", true: "#059669" }}
                  thumbColor="#ffffff"
                  ios_backgroundColor="#cbd5e1"
                  disabled={savingNotifications}
                  onValueChange={async (enabled) => {
                    if (savingNotifications) return;
                    const roomId = activeRoom._id;
                    setSavingNotifications(true);
                    try {
                      const updated = await chat.setNotificationsMuted(roomId, !enabled);
                      setRooms((previous) => previous.map((room) => (room._id === roomId ? { ...room, members: updated.members } : room)));
                      setActiveRoom((previous) => (previous?._id === roomId ? { ...previous, members: updated.members } : previous));
                      refreshChat();
                    } catch (error: any) {
                      showCustomAlert("Lỗi", error?.message || "Không thể cập nhật thông báo.");
                    } finally {
                      setSavingNotifications(false);
                    }
                  }}
                />
              </View>

              {activeRoom.isGroup && (
                <View style={{ marginTop: 24 }}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionHeader}>Danh sách thành viên</Text>
                    {canManageActiveGroup && (
                      <TouchableOpacity
                        style={styles.addMemberBtn}
                        onPress={() => setShowAddMembers((prev) => !prev)}
                        disabled={roomActionBusy}
                      >
                        <Ionicons name="person-add-outline" size={16} color="#059669" />
                        <Text style={styles.addMemberBtnText}>Thêm</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  {showAddMembers && canManageActiveGroup && (
                    <View style={styles.addMembersPanel}>
                      {usersList
                        .filter((candidate) => !activeRoom.members?.some((member) => {
                          const memberId = typeof member.userId === "object" ? member.userId?._id || member.userId?.uid : member.userId;
                          return memberId === candidate.uid;
                        }))
                        .map((candidate) => {
                          const selected = selectedAddMemberIds.includes(candidate.uid);
                          return (
                            <TouchableOpacity
                              key={candidate.uid}
                              style={styles.addMemberRow}
                              onPress={() => setSelectedAddMemberIds((prev) => selected ? prev.filter((id) => id !== candidate.uid) : [...prev, candidate.uid])}
                            >
                              <UserAvatar photoURL={candidate.photoURL} name={candidate.displayName || candidate.email} size={32} />
                              <Text style={styles.addMemberName}>{candidate.displayName || candidate.email}</Text>
                              <Ionicons name={selected ? "checkbox" : "square-outline"} size={20} color={selected ? LUXCARE_PRIMARY : "#cbd5e1"} />
                            </TouchableOpacity>
                          );
                        })}
                      <TouchableOpacity
                        style={[styles.submitBtn, { alignSelf: "flex-end", opacity: selectedAddMemberIds.length > 0 && !roomActionBusy ? 1 : 0.5 }]}
                        onPress={() => void handleAddSelectedMembers()}
                        disabled={selectedAddMemberIds.length === 0 || roomActionBusy}
                      >
                        <Text style={styles.submitBtnText}>Thêm vào nhóm</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {activeRoom.members?.map((m: ChatRoomMember, idx: number) => {
                    const mUser = typeof m.userId === "object" ? m.userId : null;
                    return (
                      <View key={idx} style={styles.memberRow}>
                        <View style={styles.memberAvatar}>
                          <UserAvatar
                            photoURL={mUser?.photoURL}
                            name={mUser?.displayName || "U"}
                            size={38}
                            fontSize={14}
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={styles.memberName}>{mUser?.displayName || mUser?.email || "Thành viên"}</Text>
                          <Text style={styles.memberRole}>{m.role === "admin" ? "Trưởng nhóm" : m.role === "deputy" ? "Phó phòng" : "Thành viên"}</Text>
                        </View>
                        {canManageActiveGroup && mUser && (mUser._id || mUser.uid) !== currentUserId && (
                          <TouchableOpacity
                            onPress={() => handleRemoveGroupMember(m)}
                            disabled={roomActionBusy}
                            hitSlop={8}
                          >
                            <Ionicons name="person-remove-outline" size={20} color="#dc2626" />
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              <View style={{ marginTop: 32 }}>
                {activeRoom.isGroup && (
                  <>
                    <TouchableOpacity
                      style={styles.dangerBtn}
                      onPress={() => {
                        showCustomAlert("Rời nhóm", "Bạn có chắc chắn muốn rời khỏi nhóm này không?", [
                          { text: "Hủy", style: "cancel" },
                          {
                            text: "Rời nhóm",
                            style: "destructive",
                            onPress: async () => {
                              try {
                                await postRoomActivity(`${getCurrentUserDisplayName()} đã rời cuộc trò chuyện.`);
                                await chat.leaveRoom(activeRoom._id);
                                setRoomInfoModalVisible(false);
                                setActiveRoom(null);
                                void loadRooms(true);
                                showCustomAlert("Thành công", "Bạn đã rời cuộc trò chuyện.");
                              } catch (err: any) {
                                showCustomAlert("Lỗi", err?.message || "Không thể rời nhóm.");
                              }
                            },
                          },
                        ]);
                      }}
                      disabled={roomActionBusy}
                    >
                      <Ionicons name="log-out-outline" size={20} color="#dc2626" style={{ marginRight: 8 }} />
                      <Text style={styles.dangerBtnText}>Rời khỏi nhóm trò chuyện</Text>
                    </TouchableOpacity>
                    {canManageActiveGroup && (
                      <TouchableOpacity style={[styles.dangerBtn, { marginTop: 10 }]} onPress={handleDissolveActiveGroup} disabled={roomActionBusy}>
                        <Ionicons name="trash-outline" size={20} color="#991b1b" style={{ marginRight: 8 }} />
                        <Text style={[styles.dangerBtnText, { color: "#991b1b" }]}>Giải tán nhóm</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* MODAL: CHUYỂN TIẾP / CHIA SẺ TIN NHẮN */}
        {renderForwardModal()}

        {/* MODAL: XEM ẢNH FULLSCREEN */}
        <Modal
          visible={!!previewImageUri}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewImageUri(null)}
        >
          <View style={styles.imagePreviewOverlay}>
            <SafeAreaView style={{ flex: 1, width: "100%", justifyContent: "center", alignItems: "center" }}>
              <TouchableOpacity
                style={styles.imagePreviewCloseBtn}
                onPress={() => setPreviewImageUri(null)}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={26} color="#ffffff" />
              </TouchableOpacity>
              {previewImageUri && (
                <TouchableOpacity
                  style={styles.imagePreviewDownloadBtn}
                  onPress={() => {
                    let ext = "jpg";
                    let mime = "image/jpeg";
                    if (previewImageUri.includes(".png")) {
                      ext = "png";
                      mime = "image/png";
                    } else if (previewImageUri.includes(".webp")) {
                      ext = "webp";
                      mime = "image/webp";
                    }
                    void handleDownloadAttachment({
                      url: previewImageUri,
                      type: mime,
                      name: `Anh_${Date.now()}.${ext}`,
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="download-outline" size={22} color="#ffffff" />
                </TouchableOpacity>
              )}
              {previewImageUri && (
                <Image
                  source={{ uri: previewImageUri }}
                  style={styles.imagePreviewFull}
                  resizeMode="contain"
                />
              )}
              {renderToast()}
            </SafeAreaView>
          </View>
        </Modal>

        {/* MODAL: XEM VIDEO FULLSCREEN TRỰC TIẾP TRONG APP (CHUẨN ZALO) */}
        <Modal
          visible={!!previewVideoUri}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewVideoUri(null)}
        >
          <FullscreenVideoPlayer
            videoUri={previewVideoUri}
            fileName={previewVideoName}
            onClose={() => setPreviewVideoUri(null)}
            onDownload={async () => {
              if (previewVideoUri) {
                await handleDownloadAttachment({
                  url: previewVideoUri,
                  type: "video/mp4",
                  name: previewVideoName.endsWith(".mp4") ? previewVideoName : `${previewVideoName}.mp4`,
                });
              }
            }}
            toastElement={renderToast()}
          />
        </Modal>

        {/* FLOATING ROUNDED TOAST FEEDBACK */}
        {renderToast()}

        {/* CUSTOM ROUNDED ALERT MODAL */}
        {renderCustomAlert()}
      </View>
    );
  }

  // ==========================================
  // RENDER MAIN SCREEN (ROOMS LIST)
  // ==========================================
  return (
    <View style={styles.safeArea}>
      {/* 1. Header (LuxCare Green Header với khoảng đệm an toàn chống chạm thanh trạng thái) */}
      <View style={[styles.topHeader, { paddingTop: listHeaderTopPadding }]}>
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={19} color="#059669" style={styles.searchIcon} />
          <TextInput
            style={styles.headerSearchInput}
            placeholder="Tìm kiếm đồng nghiệp, tin nhắn..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Nút Tạo cuộc trò chuyện / Nhóm mới */}
        <TouchableOpacity style={styles.headerActionBtn} onPress={handleOpenCreateModal} activeOpacity={0.8}>
          <Ionicons name="add" size={26} color="#059669" />
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
          <ActivityIndicator size="large" color={LUXCARE_PRIMARY} />
          <Text style={styles.loadingText}>Đang tải cuộc trò chuyện...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRooms}
          extraData={filteredRooms}
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[LUXCARE_PRIMARY]} />}
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
            const isMeLastSender = getSenderIdString(item.lastMessage?.senderId) === currentUserId;

            let lastMsgText = "Chưa có tin nhắn";
            if (item.lastMessage) {
              if (item.lastMessage.isDeleted) {
                lastMsgText = "Tin nhắn đã được thu hồi";
              } else if (item.lastMessage.attachments && item.lastMessage.attachments.length > 0) {
                const firstAtt = item.lastMessage.attachments[0];
                const attType = ((firstAtt as any)?.fileType || firstAtt?.type || "").toLowerCase();
                const attUrl = (firstAtt as any)?.fileUrl || firstAtt?.url || "";
                const attName = (firstAtt as any)?.fileName || firstAtt?.name || "Tài liệu";
                let attLabel = "[Hình ảnh/Tệp]";
                if (attType === "audio" || attType.includes("audio") || attUrl.match(/\.(m4a|mp3|wav|aac|ogg)/i)) {
                  attLabel = "[Tin nhắn thoại]";
                } else if (attType === "image" || attType.includes("image") || attUrl.match(/\.(png|jpe?g|webp|gif)/i)) {
                  attLabel = "[Hình ảnh]";
                } else if (attType === "video" || attType.includes("video") || attUrl.match(/\.(mp4|mov|avi|mkv)/i)) {
                  attLabel = "[Video]";
                } else if (attType === "document" || attType === "pdf" || attUrl.match(/\.(pdf|docx?|xlsx?|pptx?)/i)) {
                  attLabel = `[Tệp: ${attName}]`;
                }
                lastMsgText = isMeLastSender ? `Bạn: ${attLabel}` : `${item.isGroup && item.lastMessage.senderName ? `${item.lastMessage.senderName}: ` : ""}${attLabel}`;
              } else if (item.lastMessage.content) {
                lastMsgText = isMeLastSender
                  ? `Bạn: ${item.lastMessage.content}`
                  : `${item.isGroup && item.lastMessage.senderName ? `${item.lastMessage.senderName}: ` : ""}${item.lastMessage.content}`;
              }
            }

            const unreadCount = item.unreadCount || 0;
            const isPinned = item.isPinned || isRoomPinned(item);

            return (
              <TouchableOpacity
                style={[styles.roomCard, isPinned && styles.roomCardPinned]}
                onPress={() => handleOpenRoom(item)}
                onLongPress={() => {
                  const title = isPinned ? "Bỏ ghim tin nhắn ?" : "Ghim tin nhắn ?";
                  const message = isPinned
                    ? `Bỏ ghim cuộc trò chuyện "${roomName}"?`
                    : `Ghim cuộc trò chuyện "${roomName}" lên đầu danh sách?`;
                  showCustomAlert(title, message, [
                    {
                      text: isPinned ? "Bỏ ghim tin nhắn" : "Ghim tin nhắn",
                      onPress: () => void handleTogglePin(item._id),
                    },
                  ]);
                }}
                activeOpacity={0.7}
              >
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                  <RoomAvatar
                    room={item}
                    avatarUrl={getRoomAvatarUrl(item)}
                    roomName={roomName}
                    isBot={isChatbotRoom(item)}
                    isCloud={isCloudRoom(item)}
                    size={50}
                    fontSize={18}
                  />
                </View>

                {/* Content */}
                <View style={styles.roomContent}>
                  <View style={styles.roomTopRow}>
                    <Text style={styles.roomName} numberOfLines={1}>
                      {roomName}
                    </Text>
                    <View style={styles.roomTimeRow}>
                      {isPinned && (
                        <Ionicons name="pin" size={13} color="#059669" style={{ marginRight: 4 }} />
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
          MODAL: TẠO PHÒNG CHAT / NHÓM MỚI
          ========================================== */}
      <Modal visible={createModalVisible} animationType="slide" onRequestClose={() => setCreateModalVisible(false)}>
        <SafeAreaView
          style={[
            styles.modalSafeArea,
            {
              paddingTop: Platform.OS === "ios" ? Math.max(insets.top, 44) : insets.top,
              paddingBottom: Platform.OS === "ios" ? Math.max(insets.bottom, 16) : insets.bottom,
              paddingLeft: insets.left,
              paddingRight: insets.right,
            },
          ]}
          edges={[]}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setCreateModalVisible(false)}
              style={styles.modalHeaderSideButton}
              hitSlop={8}
            >
              <Ionicons name="close" size={24} color="#0f172a" />
            </TouchableOpacity>
            <Text style={[styles.modalHeaderTitle, styles.createModalHeaderTitle]} numberOfLines={1} ellipsizeMode="tail">
              Tạo cuộc trò chuyện mới
            </Text>
            <TouchableOpacity
              onPress={handleCreateRoom}
              disabled={creatingRoom || selectedUserIds.length === 0}
              style={[styles.modalDoneBtn, (selectedUserIds.length === 0 || creatingRoom) && { opacity: 0.4 }]}
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
              <Ionicons name="people-outline" size={20} color={LUXCARE_PRIMARY} style={{ marginRight: 8 }} />
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
              <ActivityIndicator size="large" color={LUXCARE_PRIMARY} />
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
                      <UserAvatar
                        photoURL={item.photoURL}
                        name={item.displayName || item.email || "U"}
                        size={42}
                        fontSize={15}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.userPickName}>{item.displayName || item.email}</Text>
                      <Text style={styles.userPickRole}>{item.role || "Thành viên"}</Text>
                    </View>
                    <Ionicons
                      name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                      size={24}
                      color={isSelected ? LUXCARE_PRIMARY : "#cbd5e1"}
                    />
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ==========================================
          MODAL: XEM ẢNH FULLSCREEN TRỰC TIẾP TRONG APP (KHÔNG MỞ TRÌNH DUYỆT)
          ========================================== */}
      <Modal
        visible={!!previewImageUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImageUri(null)}
      >
        <View style={styles.imagePreviewOverlay}>
          <SafeAreaView style={{ flex: 1, width: "100%", justifyContent: "center", alignItems: "center" }}>
            <TouchableOpacity
              style={styles.imagePreviewCloseBtn}
              onPress={() => setPreviewImageUri(null)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={26} color="#ffffff" />
            </TouchableOpacity>
            {previewImageUri && (
              <TouchableOpacity
                style={styles.imagePreviewDownloadBtn}
                onPress={() => {
                  let ext = "jpg";
                  let mime = "image/jpeg";
                  if (previewImageUri.includes(".png")) {
                    ext = "png";
                    mime = "image/png";
                  } else if (previewImageUri.includes(".webp")) {
                    ext = "webp";
                    mime = "image/webp";
                  }
                  void handleDownloadAttachment({
                    url: previewImageUri,
                    type: mime,
                    name: `Anh_${Date.now()}.${ext}`,
                  });
                }}
                activeOpacity={0.8}
              >
                <Ionicons name="download-outline" size={22} color="#ffffff" />
              </TouchableOpacity>
            )}
            {previewImageUri && (
              <Image
                source={{ uri: previewImageUri }}
                style={styles.imagePreviewFull}
                resizeMode="contain"
              />
            )}
            {renderToast()}
          </SafeAreaView>
        </View>
      </Modal>

      {/* MODAL: XEM VIDEO FULLSCREEN TRỰC TIẾP TRONG APP (CHUẨN ZALO) */}
      <Modal
        visible={!!previewVideoUri}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewVideoUri(null)}
      >
        <FullscreenVideoPlayer
          videoUri={previewVideoUri}
          fileName={previewVideoName}
          onClose={() => setPreviewVideoUri(null)}
          onDownload={async () => {
            if (previewVideoUri) {
              await handleDownloadAttachment({
                url: previewVideoUri,
                type: "video/mp4",
                name: previewVideoName.endsWith(".mp4") ? previewVideoName : `${previewVideoName}.mp4`,
              });
            }
          }}
          toastElement={renderToast()}
        />
      </Modal>

      {/* FLOATING ROUNDED TOAST FEEDBACK */}
      {renderToast()}

      {/* CUSTOM ROUNDED ALERT MODAL */}
      {renderCustomAlert()}
    </View>
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

  /* 1. LUXCARE TOP HEADER */
  topHeader: {
    backgroundColor: LUXCARE_HEADER_BG,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(5, 150, 105, 0.15)",
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.18)",
  },
  searchIcon: {
    marginRight: 8,
  },
  headerSearchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    paddingVertical: 0,
  },
  headerActionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.18)",
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
    borderBottomColor: LUXCARE_PRIMARY,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  tabTextActive: {
    color: LUXCARE_PRIMARY,
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
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#f8fafc",
    backgroundColor: "#ffffff",
  },
  roomCardPinned: {
    backgroundColor: "#f0fdf4",
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
    backgroundColor: LUXCARE_PRIMARY,
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
    backgroundColor: LUXCARE_PRIMARY,
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
    backgroundColor: "#f8fafc",
  },
  chatRoomHeader: {
    backgroundColor: LUXCARE_HEADER_BG,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(5, 150, 105, 0.15)",
  },
  chatBackBtn: {
    padding: 6,
    marginRight: 6,
  },
  chatTitleContainer: {
    flex: 1,
  },
  chatHeaderAvatarWrap: {
    marginRight: 10,
  },
  chatHeaderAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  chatHeaderAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: LUXCARE_PRIMARY,
    alignItems: "center",
    justifyContent: "center",
  },
  chatHeaderAvatarText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  chatHeaderTitle: {
    color: LUXCARE_HEADER_TEXT,
    fontSize: 17,
    fontWeight: "700",
  },
  chatHeaderSubtitle: {
    color: "#047857",
    fontSize: 12,
    marginTop: 1,
  },
  chatHeaderIconBtn: {
    padding: 6,
    marginLeft: 4,
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

  /* PINNED BANNER & DROPDOWN (CHUẨN ZALO) */
  pinnedBannerWrapper: {
    position: "relative",
    zIndex: 30,
  },
  pinnedBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: LUXCARE_MINT_BG,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: LUXCARE_MINT_BORDER,
  },
  pinnedTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#065f46",
  },
  pinnedSubtitle: {
    fontSize: 11,
    color: "#047857",
  },
  pinnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#d1fae5",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 2,
  },
  pinnedBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#059669",
  },
  pinnedDropdownCard: {
    backgroundColor: "#ffffff",
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    overflow: "hidden",
  },
  pinnedDropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#f8fafc",
  },
  pinnedDropdownTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f172a",
  },
  pinnedDropdownSubtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  pinnedDropdownItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  pinnedItemContent: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0f172a",
    lineHeight: 18,
  },
  pinnedItemSender: {
    fontSize: 11,
    color: "#64748b",
    marginTop: 2,
  },
  pinnedDropdownFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
  },
  pinnedDropdownActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  pinnedDropdownActionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
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
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
    marginBottom: 16,
    overflow: "hidden",
  },
  msgSenderAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
  systemMessageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  systemMessageText: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
  },
  msgBubble: {
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  msgBubbleMe: {
    backgroundColor: LUXCARE_MINT_BG,
    borderWidth: 1,
    borderColor: LUXCARE_MINT_BORDER,
    borderBottomRightRadius: 3,
  },
  msgBubbleOther: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderBottomLeftRadius: 3,
  },
  msgBubbleDeleted: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
  },
  msgBubbleHighlighted: {
    backgroundColor: "#fef08a",
    borderColor: "#eab308",
    borderWidth: 1.5,
  },
  msgBubbleEmojiOnly: {
    backgroundColor: "transparent",
    borderWidth: 0,
    shadowColor: "transparent",
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  msgText: {
    fontSize: 15,
    lineHeight: 22,
    includeFontPadding: false,
  },
  msgTextBigEmoji: {
    letterSpacing: 4,
    textAlign: "center",
    includeFontPadding: false,
    paddingVertical: 2,
  },
  msgTextMe: {
    color: "#064e3b",
  },
  msgTextOther: {
    color: "#0f172a",
  },
  msgDeletedText: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#94a3b8",
  },
  bubbleReplyWrap: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderLeftWidth: 3.5,
    borderLeftColor: "#0284c7",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 6,
  },
  bubbleReplySender: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0284c7",
    marginBottom: 1,
  },
  bubbleReplyText: {
    fontSize: 12,
    color: "#475569",
  },
  msgAttachmentsWrap: {
    marginBottom: 6,
  },
  attItem: {
    borderRadius: 14,
    overflow: "hidden",
    marginVertical: 3,
    position: "relative",
    width: 200,
    aspectRatio: 9 / 16,
    backgroundColor: "#0f172a",
  },
  attImage: {
    width: "100%",
    height: "100%",
    borderRadius: 14,
  },
  attSpinnerCenterWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  attSpinnerBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  attFileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(5, 150, 105, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    minWidth: 230,
    maxWidth: 290,
    marginVertical: 3,
  },
  attFileIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  attFileInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    marginRight: 8,
  },
  attFileName: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#0f172a",
    marginBottom: 2,
  },
  attFileSize: {
    fontSize: 11.5,
    color: "#64748b",
    fontWeight: "500",
  },
  attFileDownloadWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    alignItems: "center",
    justifyContent: "center",
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
    borderWidth: 1,
    borderColor: "#f1f5f9",
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
    color: LUXCARE_PRIMARY,
    fontWeight: "600",
  },

  /* VOICE NOTE BUBBLE */
  voiceNoteWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 4,
    gap: 10,
    minWidth: 170,
  },
  voicePlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  voicePlayBtnMe: {
    backgroundColor: LUXCARE_PRIMARY,
  },
  voicePlayBtnOther: {
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  voiceProgressWrap: {
    flex: 1,
    gap: 4,
  },
  voiceWaveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 24,
  },
  voiceWaveBar: {
    width: 3,
    backgroundColor: "#94a3b8",
    borderRadius: 1.5,
  },
  voiceDurationText: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },

  /* RECORDING BAR */
  recordingBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ecfdf5",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#a7f3d0",
  },
  recordingIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#ef4444",
  },
  recordingTimerText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#065f46",
  },
  recordingActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordingCancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: "#fee2e2",
    gap: 4,
  },
  recordingCancelText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "600",
  },
  recordingSendBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: LUXCARE_PRIMARY,
    gap: 4,
  },
  recordingSendText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },

  /* REPLY PREVIEW BAR (CHUẨN ZALO) */
  replyPreviewBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  replyAccentLine: {
    width: 3.5,
    height: 32,
    backgroundColor: "#0284c7",
    borderRadius: 2,
    marginRight: 10,
  },
  replyInfoWrap: {
    flex: 1,
    justifyContent: "center",
  },
  replySenderTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 2,
  },
  replyContentSubtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  replyCloseBtn: {
    padding: 6,
    marginLeft: 8,
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
    backgroundColor: LUXCARE_PRIMARY,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },

  /* EMOJI PICKER BOARD */
  emojiPickerContainer: {
    height: 270,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  emojiCategoryRow: {
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#f8fafc",
  },
  emojiCategoryScroll: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  emojiCategoryTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 5,
  },
  emojiCategoryTabActive: {
    backgroundColor: "#ecfdf5",
    borderColor: LUXCARE_MINT_BORDER,
  },
  emojiCategoryName: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748b",
  },
  emojiCategoryNameActive: {
    color: LUXCARE_PRIMARY,
    fontWeight: "700",
  },
  emojiGridScroll: {
    flex: 1,
  },
  emojiGridContent: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  emojiBtn: {
    width: "12.5%", // 8 emojis per row
    aspectRatio: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiChar: {
    fontSize: 26,
  },
  emojiPickerFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "#ffffff",
  },
  emojiBackspaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  emojiBackspaceText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
  },
  emojiQuickSendBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: LUXCARE_PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 14,
  },
  emojiQuickSendText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#ffffff",
  },

  /* UPLOADING MEDIA BANNER */
  uploadingMediaBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ecfdf5",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: LUXCARE_MINT_BORDER,
  },
  uploadingMediaText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#065f46",
  },

  /* IMAGE FULLSCREEN PREVIEW */
  imagePreviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePreviewCloseBtn: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreviewDownloadBtn: {
    position: "absolute",
    top: 16,
    right: 70,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePreviewFull: {
    width: "100%",
    height: "85%",
  },

  /* ==========================================
      MODAL SHARED STYLES
     ========================================== */
  modalSafeArea: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  modalHeaderSideButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalHeaderTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0f172a",
    flexShrink: 1,
  },
  createModalHeaderTitle: {
    flex: 1,
    textAlign: "center",
    marginHorizontal: 8,
  },
  modalDoneBtn: {
    backgroundColor: LUXCARE_PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  modalDoneBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  groupNameInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.2)",
    backgroundColor: "#ffffff",
  },
  groupNameInput: {
    flex: 1,
    fontSize: 15,
    color: "#0f172a",
  },
  userSearchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    marginVertical: 10,
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: "rgba(5, 150, 105, 0.18)",
    shadowColor: "#059669",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
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
    paddingHorizontal: 12,
    marginVertical: 3,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  userPickAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: LUXCARE_PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  userPickAvatarImg: {
    width: 42,
    height: 42,
    borderRadius: 21,
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

  /* ACTION MODAL & REACTION BAR (CHUẨN ZALO) */
  actionModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 28,
  },
  actionModalCenterWrap: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
  },
  reactionCapsuleBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 32,
    paddingHorizontal: 10,
    paddingVertical: 4,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    marginBottom: 12,
  },
  reactionPillItem: {
    paddingHorizontal: 5,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  reactionPillEmoji: {
    fontSize: 28,
  },
  reactionPlusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  actionGridCard: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 4,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 14,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  actionGridItem: {
    width: "25%",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  actionIconBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    borderWidth: 1,
  },
  actionGridLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1e293b",
    textAlign: "center",
  },
  reactionFullPickerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    width: "100%",
    maxWidth: 380,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 14,
    overflow: "hidden",
  },
  reactionFullPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  reactionFullPickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },

  /* ROOM INFO HERO */
  roomInfoHero: {
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
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
  roomManageBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  roomManageBtnText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  modalInput: {
    width: "100%",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0f172a",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  submitBtn: {
    backgroundColor: "#059669",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "700",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addMemberBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#ecfdf5",
  },
  addMemberBtnText: {
    color: "#059669",
    fontSize: 12,
    fontWeight: "700",
  },
  addMembersPanel: {
    gap: 8,
    padding: 12,
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  addMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  addMemberName: {
    flex: 1,
    color: "#0f172a",
    fontSize: 13,
    fontWeight: "600",
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
    backgroundColor: "#ffffff",
    padding: 10,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  memberAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: LUXCARE_PRIMARY,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  memberAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: "#fee2e2",
  },
  dangerBtnText: {
    color: "#dc2626",
    fontSize: 15,
    fontWeight: "600",
  },

  /* ==========================================
      FORWARD / SHARE MODAL STYLES (CHUẨN ZALO)
     ========================================== */
  forwardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  forwardBackBtn: {
    padding: 6,
    marginRight: 10,
  },
  forwardHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  forwardHeaderSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
  },
  forwardSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    marginHorizontal: 14,
    marginVertical: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  forwardSearchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0f172a",
    paddingVertical: 0,
  },
  forwardSection: {
    marginTop: 12,
  },
  forwardSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: "#f8fafc",
  },
  forwardRoomItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f1f5f9",
  },
  forwardRoomAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  forwardAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  forwardRoomName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
    marginRight: 10,
  },
  forwardCheckboxWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  forwardUncheckedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
  },
  forwardEmptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  forwardEmptyText: {
    fontSize: 14,
    color: "#94a3b8",
  },
  forwardFooterContainer: {
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
  },
  forwardPreviewCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 8,
    marginHorizontal: 12,
    marginBottom: 8,
  },
  forwardPreviewThumb: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  forwardPreviewIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "#e0f2fe",
    alignItems: "center",
    justifyContent: "center",
  },
  forwardPreviewText: {
    fontSize: 13,
    color: "#334155",
    lineHeight: 18,
  },
  forwardInputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
  forwardNoteInput: {
    flex: 1,
    height: 40,
    backgroundColor: "#f1f5f9",
    borderRadius: 20,
    paddingHorizontal: 14,
    fontSize: 14,
    color: "#0f172a",
  },
  forwardSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#0284c7",
    alignItems: "center",
    justifyContent: "center",
  },
  forwardSendBtnDisabled: {
    backgroundColor: "#cbd5e1",
    opacity: 0.6,
  },

  /* ==========================================
      FLOATING ROUNDED TOAST FEEDBACK (BO GÓC)
     ========================================== */
  floatingToastWrap: {
    position: "absolute",
    bottom: 90,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  floatingToastPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    maxWidth: "85%",
  },
  floatingToastText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
    textAlign: "center",
  },

  /* ==========================================
      CUSTOM ROUNDED ALERT DIALOG (BO GÓC TOÀN BỘ POPUP THÔNG BÁO)
     ========================================== */
  customAlertOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  customAlertCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 22,
    alignItems: "center",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  customAlertCloseBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  customAlertTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 10,
  },
  customAlertMessage: {
    fontSize: 14.5,
    color: "#475569",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 20,
  },
  customAlertBtnContainer: {
    width: "100%",
    gap: 10,
    marginTop: 6,
  },
  customAlertBtnRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  customAlertBtnCol: {
    flexDirection: "column",
  },
  customAlertBtn: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  customAlertBtnPrimary: {
    backgroundColor: "#0f172a",
  },
  customAlertBtnSecondary: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  customAlertBtnCancel: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  customAlertBtnDestructive: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fee2e2",
  },
  customAlertBtnText: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  customAlertBtnTextPrimary: {
    color: "#ffffff",
  },
  customAlertBtnTextSecondary: {
    color: "#334155",
  },
  customAlertBtnTextCancel: {
    color: "#64748b",
  },
  customAlertBtnTextDestructive: {
    color: "#dc2626",
  },

  /* VIDEO ATTACHMENT BUBBLE STYLES (CHUẨN ZALO - RATIO 9:16) */
  videoBubbleCard: {
    width: 200,
    aspectRatio: 9 / 16,
    borderRadius: 14,
    overflow: "hidden",
    marginVertical: 3,
    backgroundColor: "#0f172a",
    position: "relative",
  },
  videoBubbleThumb: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  videoBubblePlaceholder: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "#1e293b",
    alignItems: "center",
    justifyContent: "center",
  },
  videoBubbleOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.25)",
  },
  videoBubblePlayBtn: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -26,
    marginLeft: -26,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(5, 150, 105, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
    zIndex: 10,
  },
  videoBubbleSpinnerCenter: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -20,
    marginLeft: -20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  videoBubbleFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    zIndex: 8,
  },
  videoBubbleBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(5, 150, 105, 0.85)",
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    marginRight: 6,
  },
  videoBubbleBadgeText: {
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: "700",
    marginLeft: 3,
    letterSpacing: 0.5,
  },
  videoBubbleName: {
    flex: 1,
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "500",
  },

  /* FULLSCREEN VIDEO MODAL STYLES */
  videoModalOverlay: {
    flex: 1,
    backgroundColor: "#000000",
  },
  videoModalSafeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  videoModalTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 20,
  },
  videoModalIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoModalHeaderTitle: {
    flex: 1,
    color: "#ffffff",
    fontSize: 14.5,
    fontWeight: "600",
    textAlign: "center",
    marginHorizontal: 12,
  },
  videoModalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  videoModalVideoView: {
    width: "100%",
    height: "100%",
  },
  videoModalErrorWrap: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  videoModalErrorText: {
    color: "#94a3b8",
    fontSize: 14,
    marginTop: 10,
  },
});
