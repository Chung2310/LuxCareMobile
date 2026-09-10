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

export function createResourceService(transport: ServiceTransport) {
  return {
    async list(companyCode?: string, search?: string, currentUserName?: string): Promise<ResourceItem[]> {
      const items: ResourceItem[] = [];

      // 1. Try fetching from /api/v1/resources if available
      try {
        const query = search ? `?search=${encodeURIComponent(search)}` : "";
        const res = await transport.fetch(`/api/v1/resources${query}`);
        if (res.ok) {
          const body = await res.json();
          const list = Array.isArray(body) ? body : body.data || body.items || [];
          if (Array.isArray(list) && list.length > 0) {
            return list.map((item: any, idx: number) => {
              const itemOwner = item.createdBy?.displayName || item.owner || "Hệ thống";
              const isMine = currentUserName ? itemOwner === currentUserName : true;
              return {
                id: item._id || item.id || `res-${idx}`,
                name: item.title || item.name || item.filename || "Tài nguyên",
                type: item.type || detectResourceType(item.filename || item.name || "", item.mimeType),
                subtitle: isMine
                  ? `Của bạn • ${formatTimeAgo(item.updatedAt || item.createdAt)}`
                  : `Được chia sẻ bởi ${itemOwner} • ${formatTimeAgo(item.updatedAt || item.createdAt)}`,
                owner: itemOwner,
                updatedAt: formatTimeAgo(item.updatedAt || item.createdAt),
                size: item.size ? `${(item.size / 1024).toFixed(0)} KB` : "1.2 MB",
                url: item.url || item.fileUrl,
                isStarred: Boolean(item.isStarred || item.starred),
                isShared: Boolean(item.isShared || item.shared),
                sharedBy: isMine ? undefined : itemOwner,
                permission: isMine ? "owner" : "shared",
              };
            });
          }
        }
      } catch (e) {
        // Fallback
      }

      // 2. Fetch files from credentials service (shared with staff)
      try {
        const query = companyCode ? `?companyCode=${encodeURIComponent(companyCode)}` : "";
        const res = await transport.fetch(`/api/v1/hr-credentials${query}`);
        if (res.ok) {
          const body = await res.json();
          const creds = Array.isArray(body) ? body : body.data || body.credentials || [];
          creds.forEach((c: any) => {
            const fileName = c.credentialName || c.title || c.fileName || "Văn bằng chứng chỉ";
            const owner = c.employeeName || c.owner || "Phòng Nhân sự";
            const isMine = currentUserName ? owner === currentUserName : false;
            items.push({
              id: c._id || c.id || `cred-${Math.random()}`,
              name: fileName,
              type: detectResourceType(fileName, c.fileType),
              subtitle: isMine
                ? `Của bạn • ${formatTimeAgo(c.updatedAt || c.issueDate)}`
                : `Được chia sẻ bởi ${owner} • ${formatTimeAgo(c.updatedAt || c.issueDate)}`,
              owner: owner,
              updatedAt: formatTimeAgo(c.updatedAt || c.issueDate),
              size: "850 KB",
              url: c.fileUrl || c.attachment,
              isStarred: Boolean(c.isStarred),
              isShared: true,
              sharedBy: isMine ? undefined : owner,
              permission: isMine ? "owner" : "shared",
            });
          });
        }
      } catch (e) {
        // ignore
      }

      // 3. Fetch equipment documentation files (shared across company)
      try {
        const res = await transport.fetch("/api/v1/equipment");
        if (res.ok) {
          const body = await res.json();
          const list = Array.isArray(body) ? body : body.data || body.equipment || [];
          list.forEach((eq: any) => {
            if (eq.name) {
              items.push({
                id: eq._id || eq.id || `eq-${Math.random()}`,
                name: `Tài liệu HDSD thiết bị - ${eq.name}`,
                type: "pdf",
                subtitle: `Được chia sẻ bởi Quản lý thiết bị • ${formatTimeAgo(eq.updatedAt || eq.createdAt)}`,
                owner: "Quản lý thiết bị",
                updatedAt: formatTimeAgo(eq.updatedAt || eq.createdAt),
                size: "1.5 MB",
                isStarred: eq.status === "ready",
                isShared: true,
                sharedBy: "Quản lý thiết bị",
                permission: "shared",
              });
            }
          });
        }
      } catch (e) {
        // ignore
      }

      return items;
    },

    async upload(file: { name: string; type: string; uri: string }): Promise<any> {
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.type || "application/octet-stream",
      } as any);

      const res = await transport.fetch("/api/v1/media/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Không thể tải lên tệp tài nguyên.");
      return res.json();
    },
  };
}
