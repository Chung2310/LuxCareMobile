import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";

export async function captureDocumentPhoto(signal?: AbortSignal) {
  if (signal?.aborted) return null;
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (signal?.aborted) return null;
  if (!permission.granted) {
    throw new Error(permission.canAskAgain
      ? "Vui lòng cho phép sử dụng máy ảnh để chụp tài liệu."
      : "Quyền máy ảnh đang bị tắt. Vào Cài đặt của thiết bị, cho phép LuxCare dùng máy ảnh rồi thử lại.");
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    cameraType: ImagePicker.CameraType.back,
    allowsEditing: false,
    quality: 0.85,
    base64: true,
  });
  if (result.canceled || !result.assets?.length) return null;
  const asset = result.assets[0];
  try {
    if (signal?.aborted) return null;
    // ImagePicker's base64 image representation is JPEG.
    const content = asset.base64;
    if (!content) throw new Error("Không đọc được ảnh vừa chụp. Vui lòng chụp lại.");
    const padding = content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0;
    const size = Math.floor(content.length * 3 / 4) - padding;
    if (size <= 0 || size > 10 * 1024 * 1024) throw new Error("Ảnh phải có nội dung và tối đa 10 MB. Vui lòng chụp lại.");
    return { file: "data:image/jpeg;base64," + content, name: "anh-tai-lieu-" + Date.now() + ".jpg", mimeType: "image/jpeg", size };
  } finally {
    try {
      if (asset.uri.startsWith(Paths.cache.uri)) {
        const file = new File(asset.uri);
        if (file.exists) file.delete();
      }
    } catch {}
  }
}