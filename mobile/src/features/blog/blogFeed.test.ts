import { expect, it } from "vitest";
import type { BlogPost } from "../../../../src/services/blogService";
import { selectBlogFeed } from "./blogFeed";

const posts = [
  { id: "old", createdAtTs: 1, content: "Nội dung", title: "Thông báo", authorName: "Lan" },
  { id: "new", createdAtTs: 3, content: "Bài mới", authorName: "Mai" },
  { id: "middle", createdAtTs: 2, content: "Lịch họp", authorName: "An" },
] as BlogPost[];

it("orders newest first for the inverted timeline without mutating input", () => {
  expect(selectBlogFeed(posts, "").map(p => p.id)).toEqual(["new", "middle", "old"]);
  expect(posts.map(p => p.id)).toEqual(["old", "new", "middle"]);
});
it.each([["THÔNG", "old"], ["bài", "new"], ["MAI", "new"]])("searches title, content and author: %s", (query, id) => {
  expect(selectBlogFeed(posts, query).map(p => p.id)).toEqual([id]);
});
it("handles empty and unmatched feeds", () => {
  expect(selectBlogFeed([], "")).toEqual([]);
  expect(selectBlogFeed(posts, "missing")).toEqual([]);
});
