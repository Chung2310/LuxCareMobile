export interface BadgeInfo {
  label: string;
  bg: string;
  color: string;
}

export interface ParsedHistoryAction {
  category:
    | "create"
    | "complete"
    | "status"
    | "priority"
    | "assignee"
    | "subtask"
    | "attachment"
    | "timing"
    | "general";
  title: string;
  description?: string;
  fromBadge?: BadgeInfo;
  toBadge?: BadgeInfo;
  iconName: string;
  themeColor: string;
  themeBg: string;
}

export const STATUS_MAP: Record<string, BadgeInfo> = {
  "todo": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "not started": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "not_started": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "chưa bắt đầu": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "doing": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "in progress": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "in_progress": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "đang làm": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "review/testing": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "review": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "testing": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "chờ kiểm tra": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "done": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "completed": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "hoàn thành": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "archived": { label: "Lưu trữ", bg: "#f8fafc", color: "#64748b" },
  "lưu trữ": { label: "Lưu trữ", bg: "#f8fafc", color: "#64748b" },
  "cancelled": { label: "Đã hủy", bg: "#fff1f2", color: "#e11d48" },
  "đã hủy": { label: "Đã hủy", bg: "#fff1f2", color: "#e11d48" },
};

export const PRIORITY_MAP: Record<string, BadgeInfo> = {
  "low": { label: "Thấp", bg: "#f1f5f9", color: "#64748b" },
  "thấp": { label: "Thấp", bg: "#f1f5f9", color: "#64748b" },
  "medium": { label: "Trung bình", bg: "#eff6ff", color: "#2563eb" },
  "normal": { label: "Trung bình", bg: "#eff6ff", color: "#2563eb" },
  "trung bình": { label: "Trung bình", bg: "#eff6ff", color: "#2563eb" },
  "high": { label: "Cao", bg: "#fff7ed", color: "#ea580c" },
  "cao": { label: "Cao", bg: "#fff7ed", color: "#ea580c" },
  "urgent": { label: "Khẩn cấp", bg: "#fef2f2", color: "#dc2626" },
  "khẩn cấp": { label: "Khẩn cấp", bg: "#fef2f2", color: "#dc2626" },
};

export function parseTaskAction(rawAction?: string): ParsedHistoryAction {
  const text = (rawAction || "").trim();
  const lower = text.toLowerCase();

  // 1. Tạo mới / Creation
  if (
    /^(tạo|khởi tạo|created?)/i.test(text) ||
    lower.includes("tạo mới") ||
    lower.includes("created task") ||
    lower === "tạo công việc"
  ) {
    return {
      category: "create",
      title: "Khởi tạo công việc",
      description: "Công việc được khởi tạo trên hệ thống.",
      iconName: "sparkles",
      themeColor: "#059669",
      themeBg: "#ecfdf5",
    };
  }

  // 2. Hoàn thành / Complete
  if (
    (lower.includes("hoàn thành") &&
      !lower.includes("việc con") &&
      !lower.includes("subtask") &&
      !lower.includes("->")) ||
    lower === "done" ||
    lower === "completed" ||
    lower.endsWith("-> done") ||
    lower.endsWith("-> completed") ||
    lower.endsWith("-> hoàn thành")
  ) {
    return {
      category: "complete",
      title: "Hoàn thành công việc",
      description: "Đã đánh dấu hoàn tất toàn bộ công việc.",
      iconName: "checkmark-circle",
      themeColor: "#059669",
      themeBg: "#ecfdf5",
    };
  }

  // 3. Trạng thái / Status
  if (lower.includes("status") || lower.includes("trạng thái")) {
    let fromBadge: BadgeInfo | undefined;
    let toBadge: BadgeInfo | undefined;

    const cleanStatusPrefix = (str: string) =>
      str
        .replace(/^(đổi trạng thái|chuyển trạng thái|status|trạng thái)\s*:?/i, "")
        .replace(/^từ\s+/i, "")
        .trim();

    if (text.includes("->") || lower.includes(" sang ")) {
      const parts = text.includes("->")
        ? text.split("->")
        : text.split(/ sang /i);
      const fromStr = cleanStatusPrefix(parts[0]);
      const toStr = cleanStatusPrefix(parts[1]);
      const rawFrom = fromStr.toLowerCase();
      const rawTo = toStr.toLowerCase();

      fromBadge = STATUS_MAP[rawFrom] || {
        label: fromStr,
        bg: "#f1f5f9",
        color: "#475569",
      };
      toBadge = STATUS_MAP[rawTo] || {
        label: toStr,
        bg: "#eff6ff",
        color: "#2563eb",
      };
    } else {
      const toStr = cleanStatusPrefix(text);
      const rawTo = toStr.toLowerCase();
      toBadge = STATUS_MAP[rawTo] || {
        label: toStr,
        bg: "#eff6ff",
        color: "#2563eb",
      };
    }

    return {
      category: "status",
      title: "Đổi trạng thái công việc",
      fromBadge,
      toBadge,
      iconName: "swap-horizontal",
      themeColor: "#2563eb",
      themeBg: "#eff6ff",
    };
  }

  // 4. Độ ưu tiên / Priority
  if (lower.includes("priority") || lower.includes("ưu tiên")) {
    let fromBadge: BadgeInfo | undefined;
    let toBadge: BadgeInfo | undefined;

    const cleanPriorityPrefix = (str: string) =>
      str
        .replace(/^(đổi độ ưu tiên|đổi mức ưu tiên|priority|độ ưu tiên|mức ưu tiên)\s*:?/i, "")
        .replace(/^từ\s+/i, "")
        .trim();

    if (text.includes("->") || lower.includes(" sang ")) {
      const parts = text.includes("->")
        ? text.split("->")
        : text.split(/ sang /i);
      const fromStr = cleanPriorityPrefix(parts[0]);
      const toStr = cleanPriorityPrefix(parts[1]);
      const rawFrom = fromStr.toLowerCase();
      const rawTo = toStr.toLowerCase();

      fromBadge = PRIORITY_MAP[rawFrom] || {
        label: fromStr,
        bg: "#f1f5f9",
        color: "#64748b",
      };
      toBadge = PRIORITY_MAP[rawTo] || {
        label: toStr,
        bg: "#fff7ed",
        color: "#ea580c",
      };
    } else {
      const toStr = cleanPriorityPrefix(text);
      const rawTo = toStr.toLowerCase();
      toBadge = PRIORITY_MAP[rawTo] || {
        label: toStr,
        bg: "#fff7ed",
        color: "#ea580c",
      };
    }

    return {
      category: "priority",
      title: "Đổi mức độ ưu tiên",
      fromBadge,
      toBadge,
      iconName: "flag",
      themeColor: "#ea580c",
      themeBg: "#fff7ed",
    };
  }

  // 5. Giao việc / Assignee
  if (
    lower.includes("assignee") ||
    lower.includes("giao việc") ||
    lower.includes("người thực hiện") ||
    lower.includes("phụ trách")
  ) {
    const assigneeVal = text
      .replace(
        /^(assignee|giao việc cho|đổi người thực hiện thành|người phụ trách)\s*:?/i,
        "",
      )
      .trim();
    return {
      category: "assignee",
      title: "Phân công người thực hiện",
      description: assigneeVal
        ? `Đã giao cho: ${assigneeVal}`
        : "Đã cập nhật phân công người thực hiện công việc.",
      iconName: "person",
      themeColor: "#7c3aed",
      themeBg: "#f5f3ff",
    };
  }

  // 6. Việc con / Subtask
  if (
    lower.includes("subtask") ||
    lower.includes("việc nhỏ") ||
    lower.includes("việc con")
  ) {
    return {
      category: "subtask",
      title: "Cập nhật việc con",
      description: text,
      iconName: "checkbox",
      themeColor: "#0891b2",
      themeBg: "#ecfeff",
    };
  }

  // 7. Đính kèm / Attachments
  if (
    lower.includes("attach") ||
    lower.includes("tệp") ||
    lower.includes("đính kèm") ||
    lower.includes("tài liệu")
  ) {
    return {
      category: "attachment",
      title: "Tài liệu đính kèm",
      description: text,
      iconName: "attach",
      themeColor: "#0d9488",
      themeBg: "#f0fdfa",
    };
  }

  // 8. Hạn hoàn thành / Due date
  if (lower.includes("due") || lower.includes("hạn") || lower.includes("deadline")) {
    return {
      category: "timing",
      title: "Hạn hoàn thành",
      description: text,
      iconName: "calendar",
      themeColor: "#e11d48",
      themeBg: "#fff1f2",
    };
  }

  // 9. Mặc định / General
  return {
    category: "general",
    title: "Cập nhật công việc",
    description: text || "Đã cập nhật thông tin công việc.",
    iconName: "time",
    themeColor: "#475569",
    themeBg: "#f1f5f9",
  };
}

export function formatHistoryUser(userStr?: string): {
  name: string;
  initial: string;
  bg: string;
  color: string;
} {
  if (!userStr || !userStr.trim()) {
    return { name: "Người dùng", initial: "U", bg: "#f1f5f9", color: "#475569" };
  }
  const clean = userStr.trim();
  if (clean.toLowerCase() === "admin") {
    return {
      name: "Quản trị viên (Admin)",
      initial: "AD",
      bg: "#eff6ff",
      color: "#1d4ed8",
    };
  }
  if (clean.toLowerCase() === "system" || clean.toLowerCase() === "hệ thống") {
    return { name: "Hệ thống", initial: "HT", bg: "#f8fafc", color: "#64748b" };
  }
  if (clean.includes("@")) {
    const prefix = clean.split("@")[0];
    const initial = prefix.slice(0, 2).toUpperCase();
    return { name: prefix, initial, bg: "#f5f3ff", color: "#7c3aed" };
  }
  const words = clean.split(/\s+/).filter(Boolean);
  let initial = "U";
  if (words.length >= 2) {
    initial = (words[0][0] + words[words.length - 1][0]).toUpperCase();
  } else if (words.length === 1) {
    initial = words[0].slice(0, 2).toUpperCase();
  }
  return { name: clean, initial, bg: "#f0fdf4", color: "#15803d" };
}

export function formatHistoryTime(timeStr?: string): {
  relative: string;
  full: string;
} {
  if (!timeStr) return { relative: "--", full: "--" };
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return { relative: timeStr, full: timeStr };

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  const full = `${hour}:${minute} ngày ${day}/${month}/${year}`;

  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 0) return { relative: full, full };

  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return { relative: "Vừa xong", full };
  if (diffMin < 60) return { relative: `${diffMin} phút trước`, full };
  if (diffHours < 24) {
    const isToday = new Date().getDate() === d.getDate();
    if (isToday) return { relative: `Hôm nay lúc ${hour}:${minute}`, full };
  }
  if (diffDays === 1) return { relative: `Hôm qua lúc ${hour}:${minute}`, full };
  if (diffDays < 7) return { relative: `${diffDays} ngày trước`, full };
  return { relative: `${day}/${month}/${year}`, full };
}
