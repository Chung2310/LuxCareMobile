import viewerScript from "./generated/documentViewer.json";
import type { PreviewDocument } from "./documentPreview";

export function createDocumentPreviewHtml(document: PreviewDocument): string {
  // JSON is embedded as inert data; never interpolate file names/content as markup.
  const payload = JSON.stringify({ extension: document.extension, base64: document.base64 }).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'wasm-unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; font-src data: blob:; connect-src 'none'; frame-src 'none'; form-action 'none'; base-uri 'none'">
<style>
body{margin:0;padding:12px;background:#f1f5f9;color:#0f172a;font:16px system-ui,sans-serif}
#toolbar{position:sticky;top:0;background:#f1f5f9;padding:8px 0;z-index:1}
#status{padding:8px 0}button{padding:10px 18px;margin-right:12px;border:0;border-radius:8px;background:white;color:#4338ca}button:disabled{opacity:.4}
#content{text-align:center;overflow:auto}canvas{background:white;height:auto}
#content.word{text-align:left;padding:16px;background:white;overflow-wrap:anywhere}
.word img{max-width:100%;height:auto}.word table{border-collapse:collapse}.word td,.word th{border:1px solid #cbd5e1;padding:8px}
</style></head><body><div id="toolbar"><div id="controls" hidden><button id="previous" disabled>Trước</button><button id="next" disabled>Sau</button></div><div id="status" role="status">Đang mở tài liệu…</div></div><main id="content"></main>
<script id="payload" type="application/json">${payload}</script>
<script type="module">${viewerScript.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}

export function isLocalPreviewNavigation(url: string): boolean {
  return url === "about:blank" || url === "about:srcdoc";
}
