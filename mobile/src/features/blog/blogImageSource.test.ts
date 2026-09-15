import { describe, expect, it, vi } from "vitest";
import { blogImageLocation, loadBlogImageSource } from "./blogImageSource";
import { MobileApi } from "../../api/client";
const origin = "https://lux.test", path = "/api/v1/blogs/files/" + "a".repeat(24);
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const response = () => new Response(png, { headers: { "content-type": "application/octet-stream" } });
describe("Blog image preview", () => {
  it.each([path, path + "/preview", origin + path, origin + path + "/preview?v=2", path + "/", path.toUpperCase().replace("/API/V1/BLOGS/FILES/", "/api/v1/blogs/files/")])("authenticates managed image %s through preview", async url => {
    const fetch = vi.fn().mockResolvedValue(response());
    const source = await loadBlogImageSource(url, origin, fetch, new AbortController().signal);
    expect(fetch.mock.calls[0][0].toLowerCase()).toBe(path + "/preview");
    expect(source).toBe("data:image/png;base64," + Buffer.from(png).toString("base64"));
  });
  it("retains embedded image data without a network request", async () => {
    const fetch = vi.fn();
    const uri = "data:image/png;base64," + Buffer.from(png).toString("base64");
    expect(await loadBlogImageSource(uri, origin, fetch, new AbortController().signal)).toBe(uri);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps public CDN images direct without sending credentials", async () => {
    const fetch = vi.fn();
    const url = "https://res.cloudinary.com/demo/image/upload/photo.jpg";
    expect(await loadBlogImageSource(url, origin, fetch, new AbortController().signal)).toBe(url);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("does not treat another server's managed-looking URL as our protected file", () => {
    expect(blogImageLocation("https://other.test" + path, origin).previewPath).toBeNull();
  });
  it.each([401, 403])("does not fall back to download when preview returns %s", async status => {
    const fetch = vi.fn().mockResolvedValue(new Response("", { status }));
    await expect(loadBlogImageSource(path, origin, fetch, new AbortController().signal)).rejects.toThrow(String(status));
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each(["text/html", "application/json"])("rejects a non-image %s response", async type => {
    const fetch = vi.fn().mockResolvedValue(new Response("<html>login</html>", { headers: { "content-type": type } }));
    await expect(loadBlogImageSource(path, origin, fetch, new AbortController().signal)).rejects.toThrow();
  });
  it("checks image size before buffering", async () => {
    const arrayBuffer = vi.fn();
    const fetch = vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ "content-length": String(21 * 1024 * 1024) }), arrayBuffer });
    await expect(loadBlogImageSource(path, origin, fetch, new AbortController().signal)).rejects.toThrow("20 MB");
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
  it("discards the result after the image is unmounted", async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockImplementation(async () => { controller.abort(); return response(); });
    await expect(loadBlogImageSource(path, origin, fetch, controller.signal)).rejects.toThrow("Đã dừng");
  });
  it("refreshes an expired token and retains the branch when fetching images", async () => {
    const network = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ accessToken: "new-token" }), { headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(response());
    const api = new MobileApi(origin, { read: async () => null, write: async () => {}, clear: async () => {} }, network);
    await api.setSession("old-token", "refresh-token");
    api.setBranchId("b".repeat(24));
    const source = await loadBlogImageSource(origin + path, origin, api.transport.fetch, new AbortController().signal);
    expect(source).toContain("data:image/png;base64,");
    expect(network.mock.calls[2][0]).toBe(origin + path + "/preview");
    const headers = new Headers(network.mock.calls[2][1].headers);
    expect(headers.get("Authorization")).toBe("Bearer new-token");
    expect(headers.get("x-branch-id")).toBe("b".repeat(24));
  });
});
