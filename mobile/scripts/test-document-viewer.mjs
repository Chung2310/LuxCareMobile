import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const JSZip = require(require.resolve("jszip", { paths: [path.join(root, "node_modules/mammoth")] }));
const result = await build({ absWorkingDir: root, entryPoints: ["src/features/blog/documentPreviewHtml.ts"], bundle: true, write: false, platform: "node", format: "esm" });
const { createDocumentPreviewHtml } = await import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"));

function pdfFixture() {
  const stream = "0 0 0 rg 20 20 120 40 re f\nBT /F1 18 Tf 20 110 Td (Preview PDF) Tj ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Length " + stream.length + " >>\nstream\n" + stream + "endstream",
  ];
  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(output.length); output += (index + 1) + " 0 obj\n" + object + "\nendobj\n"; });
  const xref = output.length;
  output += "xref\n0 7\n0000000000 65535 f \n" + offsets.slice(1).map(offset => String(offset).padStart(10, "0") + " 00000 n \n").join("");
  output += "trailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF";
  return Buffer.from(output).toString("base64");
}
async function wordFixture() {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="png" ContentType="image/png"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file("word/document.xml", '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml"><w:body><w:p><w:r><w:t>Xin chào LuxCare</w:t></w:r></w:p><w:p><w:hyperlink r:id="external"><w:r><w:t>External link</w:t></w:r></w:hyperlink></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Ô trong bảng</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:r><w:t>&lt;script&gt;alert(1)&lt;/script&gt;</w:t></w:r></w:p><w:p><w:r><w:pict><v:shape><v:imagedata r:id="image"/></v:shape></w:pict></w:r></w:p></w:body></w:document>');
  zip.file("word/_rels/document.xml.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="external" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.invalid/login" TargetMode="External"/><Relationship Id="image" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image.png"/></Relationships>');
  zip.file("word/media/image.png", Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=", "base64"));
  return zip.generateAsync({ type: "base64" });
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const requests = [], errors = [];
  page.on("request", request => requests.push(request.url()));
  page.on("pageerror", error => errors.push(error.message));
  await page.setContent('<iframe sandbox="allow-scripts" style="width:100%;height:700px"></iframe>');
  await page.evaluate(() => { window.messages = []; window.addEventListener("message", event => window.messages.push(event.data)); });
  async function preview(extension, base64) {
    await page.evaluate(html => {
      window.messages = [];
      document.querySelector("iframe").srcdoc = html;
    }, createDocumentPreviewHtml({ extension, base64, name: "test." + extension }));
    await page.waitForFunction(() => window.messages.some(message => ["loaded", "error"].includes(message.type)), { timeout: 20000 });
    return page.frames().find(frame => frame !== page.mainFrame());
  }
  let frame = await preview("pdf", pdfFixture());
  assert.equal(await frame.locator("#status").textContent(), "Trang 1/2");
  assert.equal(await frame.locator("canvas").count(), 1);
  assert.ok(await frame.locator("canvas").evaluate(canvas => {
    const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
    return data.some((value, index) => index % 4 === 0 && value < 100 && data[index + 3] > 0);
  }), "PDF must draw visible content");
  await frame.locator("#next").click();
  await frame.waitForFunction(() => document.getElementById("status").textContent === "Trang 2/2");
  assert.equal(await frame.locator("#next").isDisabled(), true);
  await frame.locator("#previous").click();
  await frame.waitForFunction(() => document.getElementById("status").textContent === "Trang 1/2");
  console.log("PASS PDF renders locally and navigates pages");

  frame = await preview("docx", await wordFixture());
  assert.match(await frame.locator("#content").textContent(), /Xin chào LuxCare/);
  assert.equal(await frame.locator("table td").textContent(), "Ô trong bảng");
  assert.equal(await frame.locator("#content a").count(), 0);
  assert.equal(await frame.locator("#content script").count(), 0);
  assert.equal(await frame.locator("#content img").count(), 1);
  await frame.waitForFunction(() => document.querySelector("#content img").naturalWidth > 0);
  console.log("PASS DOCX text/table render; links and executable markup are absent");

  for (const extension of ["pdf", "docx"]) {
    await preview(extension, Buffer.from("broken file").toString("base64"));
    assert.equal(await page.evaluate(() => window.messages.at(-1).type), "error");
  }
  assert.deepEqual(requests, [], "viewer must never make network requests");
  assert.deepEqual(errors, [], "no uncaught errors in viewer");
  console.log("PASS corrupt documents report errors; all previews run without network requests");
} finally { await browser.close(); }
