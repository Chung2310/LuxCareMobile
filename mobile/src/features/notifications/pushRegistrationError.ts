export function pushRegistrationError(error: unknown, stage: "token" | "server", platform: string): string {
  const message = error instanceof Error ? error.message : "";
  const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
  if (stage === "token" && /firebase|google-services|fcm|sender.?id/i.test(message)) {
    return "Bản cài Android chưa đăng ký được dịch vụ thông báo. Vui lòng cài bản mới đã cấu hình thông báo nền.";
  }
  if (stage === "token" && platform === "ios" && /aps-environment|entitlement|provision|apns/i.test(message)) {
    return "Bản cài iPhone chưa có quyền nhận thông báo nền. Cần bản ứng dụng được ký với quyền Push Notifications.";
  }
  if (stage === "server" && status === 404) return "Máy chủ chưa hỗ trợ đăng ký thông báo nền. Vui lòng báo quản trị viên.";
  if (stage === "server" && status === 403) return "Máy chủ từ chối đăng ký thông báo cho tài khoản này. Vui lòng báo quản trị viên.";
  return "Chưa kết nối được dịch vụ thông báo nền. Ứng dụng sẽ tự thử lại khi đang mở.";
}
