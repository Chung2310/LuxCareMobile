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
  // Not Started / Chưa bắt đầu
  "todo": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "to do": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "to-do": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "to_do": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "not started": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "not_started": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "not-started": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "backlog": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "open": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "new": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "pending": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "chờ thực hiện": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "chờ xử lý": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "chưa bắt đầu": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },
  "chua bat dau": { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" },

  // In Progress / Đang làm
  "doing": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "in progress": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "in_progress": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "in-progress": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "progress": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "processing": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "working": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "wip": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "đang làm": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "dang lam": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "đang thực hiện": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "dang thuc hien": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },
  "đang xử lý": { label: "Đang làm", bg: "#fffbeb", color: "#d97706" },

  // Review & Testing / Chờ kiểm tra
  "review/testing": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "review / testing": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "review-testing": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "review_testing": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "review": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "in review": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "in_review": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "in-review": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "under review": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "testing": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "test": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "qa": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "qc": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "chờ kiểm tra": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "cho kiem tra": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "kiểm tra": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "chờ duyệt": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },
  "chờ review": { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" },

  // Done / Hoàn thành
  "done": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "completed": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "complete": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "finished": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "finish": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "closed": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "close": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "resolved": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "resolve": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "hoàn thành": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "hoan thanh": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "đã xong": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "da xong": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },
  "xong": { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" },

  // Archived / Lưu trữ
  "archived": { label: "Lưu trữ", bg: "#f8fafc", color: "#64748b" },
  "archive": { label: "Lưu trữ", bg: "#f8fafc", color: "#64748b" },
  "lưu trữ": { label: "Lưu trữ", bg: "#f8fafc", color: "#64748b" },
  "luu tru": { label: "Lưu trữ", bg: "#f8fafc", color: "#64748b" },
  "đã lưu trữ": { label: "Lưu trữ", bg: "#f8fafc", color: "#64748b" },

  // Cancelled / Đã hủy
  "cancelled": { label: "Đã hủy", bg: "#fff1f2", color: "#e11d48" },
  "canceled": { label: "Đã hủy", bg: "#fff1f2", color: "#e11d48" },
  "cancel": { label: "Đã hủy", bg: "#fff1f2", color: "#e11d48" },
  "cancelling": { label: "Đã hủy", bg: "#fff1f2", color: "#e11d48" },
  "rejected": { label: "Đã hủy", bg: "#fff1f2", color: "#e11d48" },
  "reject": { label: "Đã hủy", bg: "#fff1f2", color: "#e11d48" },
  "đã hủy": { label: "Đã hủy", bg: "#fff1f2", color: "#e11d48" },
  "da huy": { label: "Đã hủy", bg: "#fff1f2", color: "#e11d48" },
  "hủy": { label: "Đã hủy", bg: "#fff1f2", color: "#e11d48" },
  "từ chối": { label: "Đã hủy", bg: "#fff1f2", color: "#e11d48" },

  // Blocked / On Hold / Tạm dừng
  "blocked": { label: "Tạm dừng", bg: "#fef2f2", color: "#b91c1c" },
  "blocking": { label: "Tạm dừng", bg: "#fef2f2", color: "#b91c1c" },
  "on hold": { label: "Tạm dừng", bg: "#fef2f2", color: "#b91c1c" },
  "on_hold": { label: "Tạm dừng", bg: "#fef2f2", color: "#b91c1c" },
  "on-hold": { label: "Tạm dừng", bg: "#fef2f2", color: "#b91c1c" },
  "paused": { label: "Tạm dừng", bg: "#fef2f2", color: "#b91c1c" },
  "pause": { label: "Tạm dừng", bg: "#fef2f2", color: "#b91c1c" },
  "waiting": { label: "Tạm dừng", bg: "#fef2f2", color: "#b91c1c" },
  "tạm dừng": { label: "Tạm dừng", bg: "#fef2f2", color: "#b91c1c" },
  "tam dung": { label: "Tạm dừng", bg: "#fef2f2", color: "#b91c1c" },
  "bị chặn": { label: "Tạm dừng", bg: "#fef2f2", color: "#b91c1c" },
  "đang chờ": { label: "Tạm dừng", bg: "#fef2f2", color: "#b91c1c" },

  // Reopened / Mở lại
  "reopened": { label: "Mở lại", bg: "#f0fdf4", color: "#15803d" },
  "reopen": { label: "Mở lại", bg: "#f0fdf4", color: "#15803d" },
  "mở lại": { label: "Mở lại", bg: "#f0fdf4", color: "#15803d" },
  "mo lai": { label: "Mở lại", bg: "#f0fdf4", color: "#15803d" },
  "đã mở lại": { label: "Mở lại", bg: "#f0fdf4", color: "#15803d" },
};

/**
 * Tra cứu badge trạng thái chuẩn tiếng Việt 100%.
 * Tuyệt đối không trả về text tiếng Anh (todo, doing, in_progress, done, review...).
 */
export function lookupStatusBadge(raw?: string): BadgeInfo {
  if (!raw) {
    return { label: "Chưa rõ", bg: "#f1f5f9", color: "#475569" };
  }

  // Loại bỏ các ký tự bọc (ngoặc kép, ngoặc vuông, hai chấm...) và khoảng trắng dư thừa
  const clean = raw
    .replace(/^["'([{<\s]+|["')\]}>\s.,;:]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const lower = clean.toLowerCase();

  // 1. Khớp từ điển trực tiếp
  if (STATUS_MAP[lower]) {
    return STATUS_MAP[lower];
  }

  // 2. Thử chuẩn hóa dấu gạch ngang, gạch dưới
  const spaceNorm = lower.replace(/[-_]/g, " ");
  if (STATUS_MAP[spaceNorm]) {
    return STATUS_MAP[spaceNorm];
  }
  const underNorm = lower.replace(/[\s-]/g, "_");
  if (STATUS_MAP[underNorm]) {
    return STATUS_MAP[underNorm];
  }
  const dashNorm = lower.replace(/[\s_]/g, "-");
  if (STATUS_MAP[dashNorm]) {
    return STATUS_MAP[dashNorm];
  }

  // 3. Heuristic đối chiếu từ khóa đảm bảo 100% tiếng Việt
  if (/done|complet|finish|close|resolv|xong/i.test(lower)) {
    return { label: "Hoàn thành", bg: "#ecfdf5", color: "#059669" };
  }
  if (/doing|progress|process|working|wip|đang|dang/i.test(lower)) {
    return { label: "Đang làm", bg: "#fffbeb", color: "#d97706" };
  }
  if (/review|test|qa|qc|ki[eể]m|duy[eệ]t/i.test(lower)) {
    return { label: "Chờ kiểm tra", bg: "#eff6ff", color: "#2563eb" };
  }
  if (/todo|to[-_ ]?do|not[-_ ]?start|backlog|open|pend|ch[oờ]|m[oớ]i|new/i.test(lower)) {
    return { label: "Chưa bắt đầu", bg: "#f1f5f9", color: "#475569" };
  }
  if (/cancel|reject|h[uủ]y|ch[oố]i/i.test(lower)) {
    return { label: "Đã hủy", bg: "#fff1f2", color: "#e11d48" };
  }
  if (/pause|hold|block|ch[aặ]n|d[uừ]ng|wait/i.test(lower)) {
    return { label: "Tạm dừng", bg: "#fef2f2", color: "#b91c1c" };
  }
  if (/archiv|l[uư]u/i.test(lower)) {
    return { label: "Lưu trữ", bg: "#f8fafc", color: "#64748b" };
  }
  if (/reopen|m[oở]/i.test(lower)) {
    return { label: "Mở lại", bg: "#f0fdf4", color: "#15803d" };
  }

  // Dự phòng: Nếu có ký tự tiếng Việt có dấu thì giữ nguyên, ngược lại dịch thành "Cập nhật"
  const hasVietnamese = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(clean);
  return {
    label: hasVietnamese ? clean : "Cập nhật",
    bg: "#f1f5f9",
    color: "#475569",
  };
}

export function isStatusKeyword(str: string): boolean {
  if (!str) return false;
  const clean = str
    .replace(/^["'([{<\s]+|["')\]}>\s.,;:]+$/g, "")
    .trim()
    .toLowerCase();
  if (STATUS_MAP[clean]) return true;
  const spaceNorm = clean.replace(/[-_]/g, " ");
  if (STATUS_MAP[spaceNorm]) return true;
  return /^(todo|to[-_ ]?do|doing|done|complete|completed|finish|finished|in[-_ ]?progress|not[-_ ]?started?|review|testing|review\/testing|archived?|cancelled?|canceled?|blocked?|on[-_ ]?hold|pending|open|closed?)$/i.test(clean);
}

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

export function lookupPriorityBadge(raw?: string): BadgeInfo {
  if (!raw) return { label: "Bình thường", bg: "#eff6ff", color: "#2563eb" };
  const clean = raw.trim().toLowerCase();
  if (PRIORITY_MAP[clean]) return PRIORITY_MAP[clean];
  if (/urgent|kh[aẩ]n/i.test(clean)) return PRIORITY_MAP["urgent"];
  if (/high|cao/i.test(clean)) return PRIORITY_MAP["high"];
  if (/low|th[aấ]p/i.test(clean)) return PRIORITY_MAP["low"];
  return PRIORITY_MAP["medium"];
}

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

  // Tiện ích làm sạch tiền tố trạng thái
  const cleanStatusPrefix = (str: string) =>
    str
      .replace(
        /^(đổi trạng thái|chuyển trạng thái|cập nhật trạng thái|status|trạng thái|change status|changed status|update status|updated status|set status|status changed)\s*:?/i,
        "",
      )
      .replace(/^(từ|from)\s+/i, "")
      .replace(/^(sang|to)\s+/i, "")
      .trim();

  // Kiểm tra thao tác chuyển trạng thái (Status Transition)
  const isExplicitStatus =
    lower.includes("status") ||
    lower.includes("trạng thái") ||
    lower.includes("chuyển sang") ||
    lower.includes("đổi sang") ||
    lower.includes("change status") ||
    lower.includes("changed status") ||
    lower.includes("update status") ||
    lower.includes("updated status");

  // Thử khớp dạng "từ X sang Y" hoặc "from X to Y"
  const fromToMatch = text.match(/(?:từ|from)\s+([^-=>\n]+?)\s+(?:sang|to|->|=>)\s+(.+)/i);

  // Thử khớp dạng "X -> Y" hoặc "X => Y" hoặc "X sang Y"
  const hasArrow = text.includes("->") || text.includes("=>") || /\s+sang\s+/i.test(text);

  let statusTransitionFrom: string | undefined;
  let statusTransitionTo: string | undefined;

  if (fromToMatch) {
    statusTransitionFrom = cleanStatusPrefix(fromToMatch[1]);
    statusTransitionTo = cleanStatusPrefix(fromToMatch[2]);
  } else if (hasArrow) {
    const delimiterMatch = text.match(/(.+?)\s*(?:->|=>|\bsang\b)\s*(.+)/i);
    if (delimiterMatch) {
      statusTransitionFrom = cleanStatusPrefix(delimiterMatch[1]);
      statusTransitionTo = cleanStatusPrefix(delimiterMatch[2]);
    }
  }

  const isTransitionAStatus =
    Boolean(
      statusTransitionTo &&
        (isExplicitStatus ||
          isStatusKeyword(statusTransitionTo) ||
          (statusTransitionFrom && isStatusKeyword(statusTransitionFrom))),
    );

  // Thao tác đổi trạng thái
  if (isTransitionAStatus || (isExplicitStatus && !lower.includes("priority") && !lower.includes("ưu tiên"))) {
    let fromBadge: BadgeInfo | undefined;
    let toBadge: BadgeInfo | undefined;

    if (statusTransitionTo) {
      if (statusTransitionFrom && statusTransitionFrom.length > 0) {
        fromBadge = lookupStatusBadge(statusTransitionFrom);
      }
      toBadge = lookupStatusBadge(statusTransitionTo);
    } else {
      const toStr = cleanStatusPrefix(text);
      toBadge = lookupStatusBadge(toStr);
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

  // 2. Hoàn thành / Complete (khi không phải dạng chuyển trạng thái A -> B)
  if (
    (lower.includes("hoàn thành") &&
      !lower.includes("việc con") &&
      !lower.includes("subtask")) ||
    lower === "done" ||
    lower === "completed"
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
