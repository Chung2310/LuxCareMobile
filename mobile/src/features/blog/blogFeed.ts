import type { BlogPost } from "../../../../src/services/blogService";

/** An inverted list expects the newest item first. Never mutate the badge snapshot. */
export function selectBlogFeed(posts: BlogPost[], query: string): BlogPost[] {
  const search = query.toLowerCase();
  return posts.filter(post => !search || [post.content, post.title, post.authorName]
    .some(value => value?.toLowerCase().includes(search)))
    .sort((a, b) => b.createdAtTs - a.createdAtTs);
}
