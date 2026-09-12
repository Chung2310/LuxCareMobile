import { describe, expect, it } from "vitest";
import { bytesToBase64, resolveFileFormat } from "./fileFormat";
const bytes = (text: string) => new TextEncoder().encode(text);
describe("download file format", () => {
  it.each([
    ["image/png", "png"], ["image/jpeg", "jpg"], ["audio/mpeg", "mp3"], ["audio/mp4", "m4a"],
    ["application/msword", "doc"], ["application/vnd.ms-excel", "xls"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"],
  ])("uses the exact MIME %s for an extensionless name", (mimeType, ext) => {
    expect(resolveFileFormat({ name: "attachment", mimeType })).toMatchObject({ name: "attachment." + ext, mimeType });
  });
  it("uses the original Word filename when the storage URL has no extension", () => {
    expect(resolveFileFormat({ name: "Mau.docx", url: "https://files.test/raw/hash", contentType: "application/octet-stream" }))
      .toMatchObject({ name: "Mau.docx", extension: "docx" });
  });
  it("recovers a Unicode filename from Content-Disposition", () => {
    expect(resolveFileFormat({ url: "https://files.test/hash", contentDisposition: "attachment; filename*=UTF-8''H%E1%BB%A3p%20%C4%91%E1%BB%93ng.pdf" }))
      .toMatchObject({ name: "Hợp_đồng.pdf", mimeType: "application/pdf" });
  });
  it("prefers actual PNG bytes over a misleading JPG filename/header", () => {
    expect(resolveFileFormat({ name: "photo.jpg", contentType: "image/jpeg", bytes: new Uint8Array([137,80,78,71,13,10,26,10]) }))
      .toMatchObject({ name: "photo.png", mimeType: "image/png" });
  });
  it("keeps Office extensions when the server reports their ZIP container", () => {
    expect(resolveFileFormat({ name: "report.xlsx", contentType: "application/zip", bytes: bytes("PK") }).extension).toBe("xlsx");
  });
  it("handles uppercase extensions, signed URLs and dotted display names", () => {
    expect(resolveFileFormat({ name: "REPORT.PDF", contentType: "application/pdf" }).name).toBe("REPORT.PDF");
    expect(resolveFileFormat({ name: "Ban.v2", url: "https://files.test/report.pdf?signature=a.b" }).name).toBe("Ban.v2.pdf");
  });
  it("preserves the extension while sanitizing traversal and long names", () => {
    const result = resolveFileFormat({ name: "../" + "a".repeat(200) + ".docx" });
    expect(result.name).not.toContain("/");
    expect(result.name.length).toBeLessThanOrEqual(120);
    expect(result.extension).toBe("docx");
  });
  it.each([
    { contentType: "text/html", bytes: bytes("<html>Login</html>") },
    { contentType: "application/json", bytes: bytes('{"error":"denied"}') },
    { contentType: "application/octet-stream", bytes: bytes('{"message":"expired"}') },
  ])("rejects a successful HTTP response containing an error page", (response) => {
    expect(() => resolveFileFormat({ name: "report.pdf", ...response })).toThrow("thay vì tệp");
  });
  it("allows genuine HTML/JSON documents without relabeling them PDF", () => {
    expect(resolveFileFormat({ name: "payslip.html", contentType: "text/html", bytes: bytes("<html>Slip</html>") }).extension).toBe("html");
    expect(resolveFileFormat({ name: "data.json", contentType: "application/json" }).extension).toBe("json");
  });
  it.each([1,2,3,256,8193])("preserves every byte when encoding %i bytes without native btoa/Buffer", length => {
    const original = Uint8Array.from({ length }, (_,i) => i % 256);
    expect(bytesToBase64(original)).toBe(Buffer.from(original).toString("base64"));
  });
});

it("uses a data URI MIME without putting payload bytes in the filename", () => {
  expect(resolveFileFormat({ url: "data:image/png;base64,iVBORw0KGgo=", mimeType: "image/png" })).toMatchObject({ name: "tai-lieu.png" });
});
it("uses exact attachment MIME over an old generic JPG filename", () => {
  expect(resolveFileFormat({ name: "photo.jpg", mimeType: "image/png" }).name).toBe("photo.png");
});
