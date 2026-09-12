import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { randomUUID } from "expo-crypto";
import type { TaskAttachment } from "../../../../src/types/hr";
import { kanbanMedia } from "../../api/services";

/**
 * Xin quyền đọc tệp / truy cập bộ nhớ & thư viện media trên thiết bị
 */
export async function requestFileReadPermission(): Promise<boolean> {
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    return true;
  }

  try {
    // 1. Thử xin quyền thư viện media thông qua expo-image-picker (hỗ trợ cả iOS và Android)
    if (ImagePicker && typeof ImagePicker.requestMediaLibraryPermissionsAsync === "function") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status === "granted") return true;
    }

    // 2. Trên Android cũ (< API 33), xin thêm quyền READ_EXTERNAL_STORAGE
    if (Platform.OS === "android" && PermissionsAndroid?.request) {
      if (typeof Platform.Version === "number" && Platform.Version < 33) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: "Quyền đọc tệp và bộ nhớ",
            message: "LuxCare cần quyền đọc tệp để bạn có thể chọn và tải tài liệu đính kèm lên công việc.",
            buttonNeutral: "Hỏi lại sau",
            buttonNegative: "Từ chối",
            buttonPositive: "Cho phép",
          }
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          return true;
        }
      }
    }

    // Nếu người dùng từ chối, hiện thông báo hướng dẫn mở Cài đặt
    Alert.alert(
      "Cần cấp quyền đọc tệp",
      "LuxCare cần quyền truy cập tệp và bộ nhớ để bạn có thể chọn và đính kèm tài liệu vào công việc. Vui lòng cấp quyền trong Cài đặt thiết bị.",
      [
        { text: "Để sau", style: "cancel" },
        { text: "Mở Cài đặt", onPress: () => void Linking.openSettings() },
      ]
    );
    return false;
  } catch {
    // Nếu hệ điều hành không hỗ trợ API này thì cho phép tiếp tục
    return true;
  }
}

import { readPickedFileAsBase64 } from "../../files/readBase64";

/**
 * Chọn tệp tài liệu (PDF, Word, Excel, file bất kỳ...) từ thiết bị
 */
export async function pickWorkAttachment(): Promise<TaskAttachment | null> {
  const hasPermission = await requestFileReadPermission();
  if (!hasPermission) return null;

  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const file = new File(asset.uri);
  try {
    let size: number | undefined = asset.size;
    if (!Number.isFinite(size) || (size as number) <= 0) {
      try {
        if (Number.isFinite(file.size) && (file.size as number) > 0) {
          size = file.size;
        }
      } catch {}
    }
    if (size !== undefined && (size <= 0 || size > 20 * 1024 * 1024))
      throw new Error("Tệp phải có nội dung và không vượt quá 20 MB.");

    const base64 = await readPickedFileAsBase64(asset.uri, asset.name);
    if (!size || size <= 0) {
      size = Math.round((base64.length * 3) / 4);
    }
    if (!Number.isFinite(size) || size <= 0 || size > 20 * 1024 * 1024)
      throw new Error("Tệp phải có nội dung và không vượt quá 20 MB.");

    const mimeType = asset.mimeType || "application/octet-stream";
    const fileData = `data:${mimeType};base64,${base64}`;
    const uploaded = await kanbanMedia.upload({ file: fileData, fileName: asset.name, mimeType, size });
    const type: TaskAttachment["type"] = mimeType.startsWith("image/")
      ? "image"
      : mimeType.startsWith("video/")
        ? "video"
        : mimeType.startsWith("audio/")
          ? "audio"
          : "file";
    return { id: randomUUID(), name: asset.name, type, mimeType, size, ...uploaded };
  } finally {
    try {
      if (asset.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
    } catch {}
  }
}

/**
 * Chọn ảnh hoặc video từ thư viện ảnh thiết bị
 */
export async function pickImageAttachment(): Promise<TaskAttachment | null> {
  const hasPermission = await requestFileReadPermission();
  if (!hasPermission) return null;

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    quality: 0.8,
    base64: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) return null;
  const asset = result.assets[0];
  const mimeType = asset.mimeType || (asset.type === "video" ? "video/mp4" : "image/jpeg");
  const fileName = asset.fileName || `media_${Date.now()}.${mimeType.split("/")[1] || "jpg"}`;
  const size = asset.fileSize || 1024 * 100;

  if (size > 20 * 1024 * 1024) {
    throw new Error("Tệp không được vượt quá 20 MB.");
  }

  const base64Data = asset.base64
    ? `data:${mimeType};base64,${asset.base64}`
    : asset.uri;

  const uploaded = await kanbanMedia.upload({ file: base64Data, fileName, mimeType, size });
  return {
    id: randomUUID(),
    name: fileName,
    type: asset.type === "video" ? "video" : "image",
    mimeType,
    size,
    ...uploaded,
  };
}

