import { browserTransport, type ServiceTransport } from "./serviceTransport";
import { parseApiErrorResponse } from "./apiClientError";

export interface BlogChannel {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  unreadCount?: number;
}

export interface BlogAttachment {
  id: string;
  type: "file" | "image" | "milestone";
  name: string;
  size?: string;
  url?: string;
  milestoneData?: {
    fromLevel: number;
    toLevel: number;
    title: string;
  };
}

export interface BlogPost {
  id: string;
  channelId: string;
  channelName: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  authorRoleBadge?: string;
  createdAt: string;
  dateGroup?: string;
  title?: string;
  content: string;
  attachments?: BlogAttachment[];
  reactions?: { emoji: string; count: number; userReacted?: boolean }[];
}

export const DEFAULT_BLOG_CHANNELS: BlogChannel[] = [
  { id: "all", name: "tất-cả-bản-tin", slug: "tat-ca", description: "Tất cả thông báo & tin tức phát hành toàn hệ thống", icon: "newspaper-outline" },
  { id: "thong-bao", name: "thông-báo-chung", slug: "thong-bao", description: "Thông báo & chỉ đạo chính thức từ Ban Giám Đốc", icon: "megaphone-outline" },
  { id: "quy-dinh", name: "quy-định-quy-trình", slug: "quy-dinh", description: "Quy trình vận hành, an toàn phòng khám & nhân sự", icon: "shield-checkmark-outline" },
  { id: "y-khoa", name: "kiến-thức-y-khoa", slug: "y-khoa", description: "Chia sẻ chuyên môn, ca lâm sàng & nghiên cứu y học", icon: "medical-outline" },
  { id: "vinh-danh", name: "vinh-danh-khen-thưởng", slug: "vinh-danh", description: "Ghi nhận thành tích cá nhân & tập thể xuất sắc", icon: "trophy-outline" },
  { id: "ban-tin", name: "bản-tin-doanh-nghiệp", slug: "ban-tin", description: "Bản tin nội bộ LuxCare & hoạt động đoàn thể", icon: "briefcase-outline" },
];

export function createBlogService({ fetch, getAccessToken }: ServiceTransport) {
  async function request(path: string, method = "GET", body?: unknown) {
    const headers = new Headers({ "Content-Type": "application/json" });
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw await parseApiErrorResponse(response);
    return response;
  }

  function normalizePost(raw: any): BlogPost {
    const createdAtStr = raw.createdAt || raw.created_at || raw.publishedAt || raw.date || raw.timestamp;
    let formattedDate = "Vừa xong";
    let formattedGroup = "Hôm nay";

    if (createdAtStr) {
      try {
        const d = new Date(createdAtStr);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });
          formattedGroup = d.toLocaleDateString("vi-VN", {
            month: "long",
            day: "numeric",
            year: "numeric",
          });
        } else {
          formattedDate = String(createdAtStr);
        }
      } catch {
        formattedDate = String(createdAtStr);
      }
    }

    const rawContent = String(
      raw.content || raw.body || raw.description || raw.summary || raw.text || raw.message || "",
    );

    const rawAttachments = raw.attachments || raw.files || raw.documents;
    const tagList = Array.isArray(raw.tags) ? raw.tags : [raw.category || raw.channelName || "Thông báo"];
    const mainTag = tagList[0] || "Thông báo";

    return {
      id: String(raw.id || raw._id || `post-${Math.random().toString(36).substring(2, 9)}`),
      channelId: String(raw.channelId || mainTag),
      channelName: String(mainTag),
      authorId: String(raw.authorId || raw.author?._id || raw.author?.id || "author"),
      authorName: String(
        raw.authorName ||
          raw.author?.name ||
          raw.author?.displayName ||
          raw.createdBy ||
          "Ban Biên Tập",
      ),
      authorAvatar: raw.authorAvatar || raw.author?.avatar,
      authorRoleBadge: raw.authorRole || raw.authorRoleBadge || "Ban Biên Tập",
      createdAt: formattedDate,
      dateGroup: formattedGroup,
      title: raw.title?.trim() || undefined,
      content: rawContent,
      attachments: Array.isArray(rawAttachments)
        ? rawAttachments.map((att: any, idx: number) => ({
            id: String(att._id || att.id || `att-${idx}`),
            type: att.type || (att.name?.endsWith(".pdf") ? "file" : "file"),
            name: att.name || att.filename || "Tài liệu đính kèm.pdf",
            size: typeof att.size === "number" ? `${(att.size / 1024).toFixed(1)} KB` : att.size || "831.5 KB",
            url: att.url || att.uri || att.path,
          }))
        : undefined,
      reactions: [
        {
          emoji: "❤️",
          count: typeof raw.likesCount === "number" ? raw.likesCount : Array.isArray(raw.likes) ? raw.likes.length : 0,
          userReacted: Boolean(raw.isLiked),
        },
      ],
    };
  }

  return {
    getChannels: async (): Promise<BlogChannel[]> => {
      try {
        const response = await request("/api/v1/blogs/info");
        const body = await response.json();
        const data = body.data || body;
        if (data && data.channelName) {
          return [DEFAULT_BLOG_CHANNELS[0]];
        }
      } catch {
        // Fallback to default channel list
      }
      return DEFAULT_BLOG_CHANNELS;
    },

    getPosts: async (channelId = "all"): Promise<BlogPost[]> => {
      try {
        const queryParams = new URLSearchParams();
        if (channelId && channelId !== "all") queryParams.set("tag", channelId);
        queryParams.set("limit", "50");

        const qs = queryParams.toString();
        const response = await request(`/api/v1/blogs${qs ? `?${qs}` : ""}`);
        const body = await response.json();
        const data = body.data || body;
        const list = Array.isArray(data)
          ? data
          : data?.posts || data?.items || data?.docs;

        if (Array.isArray(list)) {
          return list.map(normalizePost);
        }
      } catch {
        // Return empty array if request fails
      }
      return [];
    },

    toggleReaction: async (postId: string, emoji = "❤️"): Promise<void> => {
      try {
        await request(`/api/v1/blogs/${encodeURIComponent(postId)}/like`, "POST");
      } catch {
        // Handled silently
      }
    },
  };
}

export const blogService = createBlogService(browserTransport);
