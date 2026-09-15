import { describe, expect, it, vi } from "vitest";
import { loadBlogDocument, previewRequestPath } from "./documentPreview";
const origin = "https://lux.test", id = "a".repeat(24);
describe("Blog document preview", () => {
  it("uses authenticated preview independently of export permissions", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("%PDF-1.7\n", { headers: { "content-type": "application/pdf" } }));
    const result = await loadBlogDocument({ id: "file", type: "file", name: "private.pdf", url: "/api/v1/blogs/files/" + id }, origin, fetch, new AbortController().signal);
    expect(fetch.mock.calls[0][0]).toBe("/api/v1/blogs/files/" + id + "/preview");
    expect(result.extension).toBe("pdf");
    expect(result.base64).toBe(Buffer.from("%PDF-1.7\n").toString("base64"));
    expect(fetch.mock.calls[0][0]).not.toContain("/access");
  });
  it("routes legacy URLs through the authenticated application proxy", () => {
    expect(previewRequestPath("https://res.cloudinary.com/demo/file.docx", origin, "file.docx")).toContain("/api/v1/media/download?");
  });
  it.each(["javascript:alert(1)", "file:///secret", "https://user:pass@example.com/file"])("rejects unsafe URL %s", url => {
    expect(() => previewRequestPath(url, origin, "file.pdf")).toThrow();
  });
  it("does not fall back to export when preview is denied", async () => {
    const fetch = vi.fn().mockResolvedValue(new Response("", { status: 403 }));
    await expect(loadBlogDocument({ id: "f", type: "file", name: "file.pdf", url: "/api/v1/blogs/files/" + id + "/preview" }, origin, fetch, new AbortController().signal)).rejects.toThrow("403");
    expect(fetch).toHaveBeenCalledOnce();
  });
  it.each(["pdf", "docx", "xls", "xlsx"])("rejects HTML login responses for %s", async extension => {
    const fetch = vi.fn().mockResolvedValue(new Response("<!doctype html><html>login</html>", { headers: { "content-type": "text/html" } }));
    await expect(loadBlogDocument({ id: "f", type: "file", name: "file." + extension, url: "/file." + extension }, origin, fetch, new AbortController().signal)).rejects.toThrow();
  });
  it("rejects oversized documents before buffering them", async () => {
    const bytes = vi.fn(), fetch = vi.fn().mockResolvedValue({ ok: true, headers: new Headers({ "content-length": String(21 * 1024 * 1024) }), arrayBuffer: bytes });
    await expect(loadBlogDocument({ id: "f", type: "file", name: "file.pdf", url: "/file.pdf" }, origin, fetch, new AbortController().signal)).rejects.toThrow("20 MB");
    expect(bytes).not.toHaveBeenCalled();
  });

  it.each(["doc", "pptx", "zip"])("reports unsupported %s files without opening a viewer", async extension => {
    const fetch = vi.fn().mockResolvedValue(new Response("binary", { headers: { "content-type": "application/octet-stream" } }));
    await expect(loadBlogDocument({ id: "f", type: "file", name: "file." + extension, url: "/file." + extension }, origin, fetch, new AbortController().signal)).rejects.toThrow(extension === "doc" ? ".docx" : "Chỉ hỗ trợ");
  });
});
