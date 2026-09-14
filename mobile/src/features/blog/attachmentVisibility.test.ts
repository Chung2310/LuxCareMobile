import { describe, expect, it, vi } from "vitest";
import { createBlogService, type BlogPost } from "../../../../src/services/blogService";
import { blogShareMessage } from "../../../../src/services/blogShareMessage";
const fixture = { id: "post", content: "Read https://files.test/private.pdf", authorName: "Author", attachments: [{ _id: "file", type: "file", name: "private.pdf", url: "https://files.test/private.pdf" }] };
const setup = (body: unknown, status = 200) => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  return { fetch, service: createBlogService({ fetch, getAccessToken: () => "token" }) };
};
describe("blog file permissions", () => {
  it.each([true, false, undefined, null, "true"])("normalizes flag %s without truthy coercion", async flag => {
    const { service } = setup({ data: { ...fixture, attachmentsPublic: flag } });
    expect((await service.getPost("post")).attachmentsPublic).toBe(flag === undefined || flag === true);
  });
  it("sends explicit false and does not accept a silent backend fallback", async () => {
    const { fetch, service } = setup({ data: { attachmentsPublic: true } });
    await expect(service.updateAttachmentVisibility("post/a", false)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledWith("/api/v1/blogs/post%2Fa/attachment-visibility", expect.objectContaining({ method: "PATCH", body: '{"attachmentsPublic":false}' }));
  });
  it("propagates revoked access instead of returning the cached URL", async () => {
    const { service } = setup({ message: "Private file" }, 403);
    await expect(service.getAttachmentAccess("post", "file")).rejects.toThrow();
  });
  it("persists the selected permission in a new post", async () => {
    const { service, fetch } = setup({ data: { ...fixture, attachmentsPublic: false } });
    await service.createPost({ content: "body", attachmentsPublic: false });
    expect(JSON.parse(fetch.mock.calls[0][1].body).attachmentsPublic).toBe(false);
  });
  it("removes private attachments and their pasted URL from shared content", () => {
    const post = { ...fixture, attachmentsPublic: false } as unknown as BlogPost;
    const message = blogShareMessage(post, url => url);
    expect(message).not.toContain("https://files.test/private.pdf");
    expect(message).not.toContain("📎");
    expect(message).toContain("Author");
  });
  it("shares the public download URL instead of authenticated preview", () => {
    const post = { ...fixture, content: "body", attachmentsPublic: true, attachments: [{ id: "f", type: "image", name: "photo", url: "/preview", shareUrl: "/download" }] } as BlogPost;
    const message = blogShareMessage(post, url => "https://app.test" + url);
    expect(message).toContain("https://app.test/download");
    expect(message).not.toContain("/preview");
  });
});
