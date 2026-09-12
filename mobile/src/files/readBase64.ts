import { File, Paths } from "expo-file-system";

/**
 * Đọc file URI (file:// hoặc content://) thành chuỗi Base64 an toàn trên Android, iOS và Web
 * Bao gồm cơ chế fallback nhiều tầng để khắc phục lỗi Scoped Storage / FileSystemFile.base64 trên Android
 */
export async function readPickedFileAsBase64(uri: string, fileName?: string): Promise<string> {
  // 1. Thử native File API của expo-file-system (nhanh nhất)
  try {
    const file = new File(uri);
    const b64 = await file.base64();
    if (b64 && typeof b64 === "string" && b64.length > 0) {
      return b64.replace(/\s/g, "");
    }
  } catch {
    // Bỏ qua lỗi native (ví dụ: Missing 'READ' permission for accessing the file trên Android)
  }

  // 2. Thử FileSystem.readAsStringAsync từ expo-file-system/legacy (hỗ trợ content:// qua ContentResolver)
  try {
    const legacyFs = await import("expo-file-system/legacy");
    if (legacyFs && typeof legacyFs.readAsStringAsync === "function") {
      const b64 = await legacyFs.readAsStringAsync(uri, {
        encoding: (legacyFs.EncodingType?.Base64 || "base64") as any,
      });
      if (b64 && typeof b64 === "string" && b64.length > 0) {
        return b64.replace(/\s/g, "");
      }
    }
  } catch {}

  // 3. Thử Web fetch + blob + FileReader (React Native Blob/ContentResolver native)
  try {
    if (typeof fetch === "function") {
      const response = await fetch(uri);
      if (response.ok || uri.startsWith("file:") || uri.startsWith("content:")) {
        const blob = await response.blob();
        if (typeof FileReader !== "undefined") {
          const b64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === "string") {
                const commaIdx = reader.result.indexOf(",");
                resolve(commaIdx >= 0 ? reader.result.substring(commaIdx + 1) : reader.result);
              } else {
                reject(new Error("Không thể chuyển đổi dữ liệu tệp."));
              }
            };
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(blob);
          });
          if (b64 && typeof b64 === "string" && b64.length > 0) {
            return b64.replace(/\s/g, "");
          }
        }
      }
    }
  } catch {}

  // 4. Thử sao chép vào thư mục cache nội bộ rồi đọc
  try {
    const legacyFs = await import("expo-file-system/legacy");
    const safeExt = fileName && fileName.includes(".") ? fileName.split(".").pop() : "tmp";
    const cacheDir = legacyFs.cacheDirectory || Paths?.cache?.uri || "";
    if (cacheDir && typeof legacyFs.copyAsync === "function" && typeof legacyFs.readAsStringAsync === "function") {
      const tempDest = `${cacheDir}temp_read_${Date.now()}_${Math.random().toString(36).slice(2)}.${safeExt}`;
      await legacyFs.copyAsync({ from: uri, to: tempDest });
      try {
        const b64 = await legacyFs.readAsStringAsync(tempDest, {
          encoding: (legacyFs.EncodingType?.Base64 || "base64") as any,
        });
        if (b64 && typeof b64 === "string" && b64.length > 0) {
          return b64.replace(/\s/g, "");
        }
      } finally {
        if (typeof legacyFs.deleteAsync === "function") {
          void legacyFs.deleteAsync(tempDest, { idempotent: true }).catch(() => {});
        }
      }
    }
  } catch {}

  throw new Error("Không thể đọc nội dung tệp đính kèm. Vui lòng thử chọn tệp khác hoặc cấp quyền truy cập bộ nhớ.");
}
