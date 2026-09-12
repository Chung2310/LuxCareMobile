export type NotificationCategory =
  | "task"
  | "leave"
  | "attendance"
  | "payroll"
  | "warehouse"
  | "training"
  | "system"
  | "chat"
  | "blog"
  | "general";

export interface CategoryInfo {
  category: NotificationCategory;
  label: string;
  iconName:
    | "checkbox-outline"
    | "calendar-outline"
    | "time-outline"
    | "cash-outline"
    | "cube-outline"
    | "school-outline"
    | "settings-outline"
    | "chatbubbles-outline"
    | "newspaper-outline"
    | "notifications-outline";
  color: string;
  bg: string;
  borderColor: string;
}

export function detectNotificationCategory(
  title = "",
  body = "",
  action?: { tab?: string; subTab?: string }
): CategoryInfo {
  const combined = `${title} ${body} ${action?.tab || ""} ${action?.subTab || ""}`.toLowerCase();

  if (
    action?.subTab === "Giao Việc" ||
    combined.includes("công việc") ||
    combined.includes("giao việc") ||
    combined.includes("nhiệm vụ") ||
    combined.includes("task")
  ) {
    return {
      category: "task",
      label: "Công việc",
      iconName: "checkbox-outline",
      color: "#2563eb",
      bg: "#eff6ff",
      borderColor: "#bfdbfe",
    };
  }

  if (
    combined.includes("nghỉ phép") ||
    combined.includes("đơn từ") ||
    combined.includes("xin nghỉ") ||
    combined.includes("duyệt đơn") ||
    combined.includes("leave")
  ) {
    return {
      category: "leave",
      label: "Đơn từ",
      iconName: "calendar-outline",
      color: "#059669",
      bg: "#ecfdf5",
      borderColor: "#a7f3d0",
    };
  }

  if (
    combined.includes("chấm công") ||
    combined.includes("điểm danh") ||
    combined.includes("vào ca") ||
    combined.includes("ra ca") ||
    combined.includes("ca làm") ||
    combined.includes("check-in") ||
    combined.includes("check-out") ||
    combined.includes("quên chấm") ||
    combined.includes("đi muộn") ||
    combined.includes("về sớm") ||
    combined.includes("giờ công") ||
    combined.includes("attendance")
  ) {
    return {
      category: "attendance",
      label: "Chấm công",
      iconName: "time-outline",
      color: "#0891b2",
      bg: "#ecfeff",
      borderColor: "#a5f3fc",
    };
  }

  if (
    combined.includes("lương") ||
    combined.includes("phiếu lương") ||
    combined.includes("thu nhập") ||
    combined.includes("thưởng") ||
    combined.includes("payroll")
  ) {
    return {
      category: "payroll",
      label: "Tiền lương",
      iconName: "cash-outline",
      color: "#d97706",
      bg: "#fffbeb",
      borderColor: "#fde68a",
    };
  }

  if (
    combined.includes("kho") ||
    combined.includes("vật tư") ||
    combined.includes("thiết bị") ||
    combined.includes("dược phẩm") ||
    combined.includes("thuốc") ||
    combined.includes("nhập kho") ||
    combined.includes("xuất kho")
  ) {
    return {
      category: "warehouse",
      label: "Kho & Thiết bị",
      iconName: "cube-outline",
      color: "#ea580c",
      bg: "#fff7ed",
      borderColor: "#fed7aa",
    };
  }

  if (
    combined.includes("đào tạo") ||
    combined.includes("khóa học") ||
    combined.includes("chứng chỉ") ||
    combined.includes("training")
  ) {
    return {
      category: "training",
      label: "Đào tạo",
      iconName: "school-outline",
      color: "#7c3aed",
      bg: "#f5f3ff",
      borderColor: "#ddd6fe",
    };
  }

  if (
    combined.includes("hệ thống") ||
    combined.includes("bảo trì") ||
    combined.includes("cập nhật") ||
    combined.includes("system")
  ) {
    return {
      category: "system",
      label: "Hệ thống",
      iconName: "settings-outline",
      color: "#475569",
      bg: "#f1f5f9",
      borderColor: "#cbd5e1",
    };
  }

  if (
    action?.tab === "chat" ||
    combined.includes("tin nhắn") ||
    combined.includes("chat") ||
    combined.includes("trò chuyện")
  ) {
    return {
      category: "chat",
      label: "Trò chuyện",
      iconName: "chatbubbles-outline",
      color: "#0284c7",
      bg: "#f0f9ff",
      borderColor: "#bae6fd",
    };
  }

  if (
    action?.tab === "blog" ||
    combined.includes("blog") ||
    combined.includes("bài viết") ||
    combined.includes("bản tin")
  ) {
    return {
      category: "blog",
      label: "Bản tin & Blog",
      iconName: "newspaper-outline",
      color: "#9333ea",
      bg: "#faf5ff",
      borderColor: "#e9d5ff",
    };
  }

  return {
    category: "general",
    label: "Thông báo",
    iconName: "notifications-outline",
    color: "#059669",
    bg: "#ecfdf5",
    borderColor: "#a7f3d0",
  };
}
