import { describe, expect, it } from "vitest";
import { createDocumentPreviewHtml, isLocalPreviewNavigation } from "./documentPreviewHtml";

describe("offline document frame", () => {
  it("embeds bytes as inert JSON and never embeds the filename", () => {
    const html = createDocumentPreviewHtml({ name: "<img src=x onerror=alert(1)>", extension: "docx", base64: "</script><script>alert(1)</script>" });
    const payload = /<script id="payload" type="application\/json">([\s\S]*?)<\/script>/.exec(html)![1];
    expect(payload).not.toContain("<");
    expect(JSON.parse(payload).base64).toBe("</script><script>alert(1)</script>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("connect-src 'none'");
    expect(html).not.toContain('<script src=');
    expect(html).not.toContain("/document-preview.html");
  });
  it.each(["https://lux.test/login", "https://lux.test/document-preview.html", "file:///secret", "javascript:alert(1)", "about:blank#link"])("blocks navigation to %s", url => {
    expect(isLocalPreviewNavigation(url)).toBe(false);
  });
  it("allows only the inline document contexts", () => {
    expect(isLocalPreviewNavigation("about:blank")).toBe(true);
    expect(isLocalPreviewNavigation("about:srcdoc")).toBe(true);
  });
});
