type FileAccess = {
  copyAsync(options: { from: string; to: string }): Promise<void>;
  getInfoAsync(uri: string): Promise<{ exists: boolean; isDirectory?: boolean }>;
};

export async function prepareLocalBlogFile(source: string, destination: string, files: FileAccess): Promise<string> {
  try {
    // Copying also verifies read access, unlike merely checking whether a path exists.
    if (source !== destination) await files.copyAsync({ from: source, to: destination });
    const info = await files.getInfoAsync(destination);
    if (!info.exists || info.isDirectory) throw new Error("Missing local file");
    return destination;
  } catch {
    throw new Error(
      "Tệp đính kèm cục bộ không còn tồn tại hoặc ứng dụng không có quyền đọc. " +
      "Nếu đây là bài viết đã đăng, hãy nhờ người đăng chọn lại tệp gốc và tải lên máy chủ; đường dẫn cache của DocumentPicker không dùng được trên thiết bị khác.",
    );
  }
}
