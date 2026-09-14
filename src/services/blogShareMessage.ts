import type { BlogPost } from "./blogService";

export function blogShareMessage(post: BlogPost, resolveUrl: (url: string) => string): string {
  const publicFiles = post.attachmentsPublic === true ? post.attachments || [] : [];
  const files = publicFiles.map(file => {
    const url = file.shareUrl || file.url;
    return url ? `📎 ${file.name}: ${resolveUrl(url)}` : `📎 ${file.name}`;
  }).join("\n");
  let content = post.content;
  // Do not forward a private attachment URL pasted into the post body.
  if (post.attachmentsPublic !== true) {
    for (const file of post.attachments || []) {
      for (const url of [file.url, file.shareUrl].filter((value): value is string => !!value)) {
        content = content.split(resolveUrl(url)).join("[Tệp không công khai]").split(url).join("[Tệp không công khai]");
      }
    }
  }
  return `${post.title ? `📢 [${post.title}]` : "📢 [Bản tin LuxCare]"}\n\n${content}${files ? "\n\n" + files : ""}${post.authorName ? "\n\n👤 Tác giả: " + post.authorName : ""}${post.channelName ? "\n🏷️ Kênh: " + post.channelName : ""}\n🏥 LuxCare Medical System`;
}
