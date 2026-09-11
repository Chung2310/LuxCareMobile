export function communicationBadge(route: string, blogUnread: number, chatUnread: number, fallback?: string) {
  const base = route.split("?")[0];
  const count = base === "/(tabs)/blog" ? blogUnread : base === "/(tabs)/chat" ? chatUnread : -1;
  return count < 0 ? fallback : count > 99 ? "99+" : count > 0 ? String(count) : undefined;
}
export function countBlogUnread(posts: { id: string; authorId: string }[], seen: string[] | null, uid: string) {
  if (seen === null) return 0;
  const read = new Set(seen);
  return new Set(posts.filter(post => post.authorId !== uid && !read.has(post.id)).map(post => post.id)).size;
}
export function mergeBlogSeen(previous: string[], visible: string[]) {
  return [...new Set([...previous, ...visible])].slice(-50);
}
