import { expect, it } from "vitest";
import { communicationBadge, countBlogUnread, mergeBlogSeen } from "./communicationState";
it("counts new posts once and excludes own posts and already viewed posts", () => {
  const posts = [{ id: "old", authorId: "other" }, { id: "new", authorId: "other" }, { id: "new", authorId: "other" }, { id: "own", authorId: "me" }];
  expect(countBlogUnread(posts, ["old"], "me")).toBe(1);
  expect(countBlogUnread(posts, null, "me")).toBe(0);
  expect(countBlogUnread(posts, mergeBlogSeen(["old"], ["new"]), "me")).toBe(0);
});
it("viewing one channel preserves unseen posts in the other channel", () => {
  const seen = mergeBlogSeen(["old"], ["channel-a"]);
  expect(countBlogUnread([{ id: "channel-a", authorId: "other" }, { id: "channel-b", authorId: "other" }], JSON.parse(JSON.stringify(seen)), "me")).toBe(1);
});
it("caps badges and preserves unrelated feature badges", () => {
  expect(communicationBadge("/(tabs)/work?from=modules", 4, 9, "7", 3)).toBe("3");
  expect(communicationBadge("/(tabs)/work", 4, 9, "7", 0)).toBeUndefined();
  expect(communicationBadge("/(tabs)/work", 4, 9, undefined, 120)).toBe("99+");
  expect(communicationBadge("/(tabs)/blog?from=modules", 4, 9)).toBe("4");
  expect(communicationBadge("/(tabs)/chat", 4, 150)).toBe("99+");
  expect(communicationBadge("/(tabs)/blog", 0, 9, "old")).toBeUndefined();
  expect(communicationBadge("/(tabs)/work", 4, 9, "2")).toBe("2");
});
