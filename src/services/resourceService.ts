import type { ServiceTransport } from "./serviceTransport";

export interface ResourceItem {
  id: string;
  name: string;
  type: "spreadsheet" | "video" | "image" | "document" | "pdf" | "folder" | "link" | "note" | "audio";
  subtitle: string;
  owner: string;
  updatedAt: string;
  size?: string;
  url?: string;
  uri?: string;
  content?: string;
  noteImageUri?: string;
  parentId?: string | null;
  isStarred?: boolean;
  isShared?: boolean;
  sharedBy?: string;
  sharedWithCount?: number;
  permission?: "owner" | "shared";
  isFixed?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
}

export function detectResourceType(filename: string, mime?: string): ResourceItem["type"] {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  if (["xls", "xlsx", "csv"].includes(ext) || mime?.includes("spreadsheet") || mime?.includes("excel")) {
    return "spreadsheet";
  }
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext) || mime?.includes("video")) {
    return "video";
  }
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext) || mime?.includes("image")) {
    return "image";
  }
  if (ext === "pdf" || mime?.includes("pdf")) {
    return "pdf";
  }
  if (["mp3", "m4a", "wav", "aac"].includes(ext) || mime?.includes("audio")) {
    return "audio";
  }
  return "document";
}

export function formatTimeAgo(dateStr?: string | Date): string {
  if (!dateStr) return "Vừa xong";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return String(dateStr);
  
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return "Vừa xong";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
  if (diffSec < 86400) return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
  return `${date.getDate()} thg ${date.getMonth() + 1}`;
}

export function mapResourceItem(item: any, currentUserName?: string): ResourceItem {
  const isFolder = item.type === "folder";
  const itemOwner = item.creatorName || item.createdBy?.displayName || item.owner || "Hệ thống";
  const isMine = currentUserName ? itemOwner === currentUserName : true;

  let mappedType: ResourceItem["type"] = "document";
  if (isFolder) {
    mappedType = "folder";
  } else if (item.section === "drive" && (!item.mimeType || item.mimeType === "application/vnd.google-apps.shortcut")) {
    mappedType = "link";
  } else {
    mappedType = detectResourceType(item.name || item.title || item.filename || "", item.mimeType);
  }

  const sizeStr = isFolder
    ? "Thư mục"
    : item.size
    ? item.size > 1024 * 1024
      ? `${(item.size / (1024 * 1024)).toFixed(1)} MB`
      : `${(item.size / 1024).toFixed(0)} KB`
    : "1.2 MB";

  const fileUrl = item.fileUrl || item.url || item.driveLink || "";

  let itemSubtitle = "";
  if (isFolder) {
    itemSubtitle =
      item.name === "Trò chuyện"
        ? "Tệp & phương tiện từ các cuộc trò chuyện"
        : `Thư mục ${isMine ? "của bạn" : `của ${itemOwner}`} • ${formatTimeAgo(item.updatedAt || item.createdAt)}`;
  } else if (item.sourceType === "chat.attachment" || item.roomId) {
    itemSubtitle = isMine
      ? `Của bạn (Gửi từ Chat) • ${formatTimeAgo(item.createdAt || item.updatedAt)}`
      : `Gửi bởi ${itemOwner} • ${formatTimeAgo(item.createdAt || item.updatedAt)}`;
  } else {
    itemSubtitle = isMine
      ? `Của bạn • ${formatTimeAgo(item.updatedAt || item.createdAt)}`
      : `Được chia sẻ bởi ${itemOwner} • ${formatTimeAgo(item.updatedAt || item.createdAt)}`;
  }

  return {
    id: String(item._id || item.id),
    name: item.name || item.title || item.filename || "Tài nguyên",
    type: mappedType,
    subtitle: itemSubtitle,
    owner: itemOwner,
    updatedAt: formatTimeAgo(item.updatedAt || item.createdAt),
    size: sizeStr,
    url: fileUrl,
    uri: fileUrl,
    content: fileUrl,
    parentId: item.parentId ? String(item.parentId) : null,
    isStarred: Boolean(item.isStarred || item.starred),
    isShared: Boolean(item.isShared || item.shared || (item.shares && item.shares.length > 0)),
    sharedBy: isMine ? undefined : itemOwner,
    permission: isMine ? "owner" : "shared",
    isFixed: Boolean(item.isFixed),
    isDeleted: Boolean(item.isDeleted),
    deletedAt: item.deletedAt ? formatTimeAgo(item.deletedAt) : undefined,
  };
}

export function createResourceService(transport: ServiceTransport) {
  return {
    /**
     * Liệt kê tài nguyên từ API máy chủ (lưu trên MongoDB).
     */
    async list(
      parentIdOrCompanyCode?: string | null,
      sectionOrSearch?: string,
      currentUserName?: string,
    ): Promise<ResourceItem[]> {
      const items: ResourceItem[] = [];

      try {
        const params = new URLSearchParams();
        if (parentIdOrCompanyCode && parentIdOrCompanyCode.length === 24) {
          params.set("parentId", parentIdOrCompanyCode);
        } else if (parentIdOrCompanyCode && parentIdOrCompanyCode !== "all") {
          // If passed as parentId
          params.set("parentId", parentIdOrCompanyCode);
        }

        if (sectionOrSearch === "local" || sectionOrSearch === "drive") {
          params.set("section", sectionOrSearch);
        } else if (sectionOrSearch) {
          params.set("search", sectionOrSearch);
        }

        const queryStr = params.toString() ? `?${params.toString()}` : "";
        const res = await transport.fetch(`/api/v1/resources${queryStr}`);
        if (res.ok) {
          const body = await res.json();
          const list = Array.isArray(body) ? body : body.items || body.data || [];
          return list.map((item: any) => mapResourceItem(item, currentUserName));
        }
      } catch {
        // Bỏ qua và thử fallback nếu cần
      }

      return items;
    },

    /**
     * Danh sách thùng rác
     */
    async listTrash(currentUserName?: string): Promise<ResourceItem[]> {
      const res = await transport.fetch("/api/v1/resources/trash");
      if (!res.ok) throw new Error("Không thể tải danh sách thùng rác.");
      const body = await res.json();
      const list = Array.isArray(body) ? body : body.items || body.data || [];
      return list.map((item: any) => mapResourceItem(item, currentUserName));
    },

    /**
     * Tạo thư mục mới trên cơ sở dữ liệu MongoDB
     */
    async createFolder(
      name: string,
      parentId?: string | null,
      section: "local" | "drive" = "local",
    ): Promise<ResourceItem> {
      const res = await transport.fetch("/api/v1/resources/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parentId: parentId || null,
          section,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Không thể tạo thư mục.");
      }
      const body = await res.json();
      return mapResourceItem(body.item || body);
    },

    /**
     * Lưu tệp đã upload lên Cloudinary vào cơ sở dữ liệu MongoDB
     */
    async createFile(input: {
      name: string;
      fileUrl: string;
      parentId?: string | null;
      mimeType?: string;
      size?: number;
    }): Promise<ResourceItem> {
      const res = await transport.fetch("/api/v1/resources/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: input.name.trim(),
          fileUrl: input.fileUrl,
          parentId: input.parentId || null,
          mimeType: input.mimeType || "",
          size: input.size || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Không thể lưu tệp vào hệ thống.");
      }
      const body = await res.json();
      return mapResourceItem(body.item || body);
    },

    /**
     * Thêm liên kết web / Google Drive
     */
    async addDriveLink(name: string, driveLink: string, driveType?: string): Promise<ResourceItem> {
      const res = await transport.fetch("/api/v1/resources/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          driveLink: driveLink.trim(),
          driveType: driveType || "file",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Không thể lưu liên kết.");
      }
      const body = await res.json();
      return mapResourceItem(body.item || body);
    },

    /**
     * Đổi tên tài nguyên
     */
    async rename(id: string, name: string): Promise<ResourceItem> {
      const res = await transport.fetch(`/api/v1/resources/${id}/rename`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Không thể đổi tên tài nguyên.");
      }
      const body = await res.json();
      return mapResourceItem(body.item || body);
    },

    /**
     * Chuyển vào thùng rác (soft delete)
     */
    async moveToTrash(id: string): Promise<void> {
      const res = await transport.fetch(`/api/v1/resources/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Không thể chuyển tệp vào thùng rác.");
      }
    },

    /**
     * Khôi phục từ thùng rác
     */
    async restore(id: string): Promise<void> {
      const res = await transport.fetch(`/api/v1/resources/${id}/restore`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Không thể khôi phục tài nguyên.");
      }
    },

    /**
     * Xóa vĩnh viễn khỏi MongoDB
     */
    async deletePermanently(id: string): Promise<void> {
      const res = await transport.fetch(`/api/v1/resources/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Không thể xóa vĩnh viễn.");
      }
    },
  };
}
