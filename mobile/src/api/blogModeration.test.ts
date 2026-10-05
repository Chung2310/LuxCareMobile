import { describe, expect, it, vi } from "vitest";
import { createBlogModerationService } from "../../../src/services/blogModerationService";
const setup = (status = 200) => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      new Response(
        JSON.stringify(status === 200 ? { data: { authorId: "author" } } : { message: "Forbidden", code: "FORBIDDEN" }),
        { status, headers: { "content-type": "application/json" } },
      ),
  );
  return { fetch, api: createBlogModerationService({ fetch, getAccessToken: () => "token" }) };
};
describe("Blog moderation API", () => {
  it("reports by postId without a chat room or client-provided author/company", async () => {
    const { api, fetch } = setup();
    await api.report("post", "spam", "Repeated text");
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/blogs/post/reports");
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({ reason: "spam", details: "Repeated text" });
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer token");
  });
  it("derives the blocked author from the selected post", async () => {
    const { api, fetch } = setup();
    expect(await api.blockAuthor("post")).toEqual({ authorId: "author" });
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/blogs/post/block-author");
    expect(fetch.mock.calls[0][1]?.body).toBe("{}");
  });
  it("lists and removes only authenticated user's blocks", async () => {
    const { api, fetch } = setup();
    await api.blocks();
    await api.unblock("author");
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/blogs/blocks");
    expect(fetch.mock.calls[1][0]).toBe("/api/v1/blogs/blocks/author");
    expect(fetch.mock.calls[1][1]?.method).toBe("DELETE");
  });
  it("sends an explicit moderation decision and preserves errors", async () => {
    const { api, fetch } = setup();
    await api.moderate("report", "resolved", "Violates rules", true);
    expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual({
      status: "resolved",
      notes: "Violates rules",
      removePost: true,
    });
    await expect(setup(403).api.blocks()).rejects.toMatchObject({ message: "Forbidden" });
  });
});
