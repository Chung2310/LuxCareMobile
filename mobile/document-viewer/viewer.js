import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { WorkerMessageHandler } from "pdfjs-dist/legacy/build/pdf.worker.mjs";
import mammoth from "mammoth/mammoth.browser.js";
import DOMPurify from "dompurify";
import assets from "preview-pdf-assets";

// Use the bundled worker on the local page: no server, CDN or worker URL.
globalThis.pdfjsWorker = { WorkerMessageHandler };
const notify = (type, message) => {
  const event = { type, message };
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(event));
  else window.parent.postMessage(event, "*");
};
const fail = error => {
  const message = error?.name === "PasswordException"
    ? "PDF được bảo vệ bằng mật khẩu. Vui lòng dùng bản không có mật khẩu để xem trước."
    : "Không đọc được tài liệu. Tệp có thể bị hỏng, được bảo vệ hoặc có nội dung chưa hỗ trợ.";
  document.getElementById("status").textContent = message;
  notify("error", message);
};
function decode(base64) {
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0));
}
class LocalBinaryDataFactory {
  async fetch({ kind, filename }) {
    const data = assets[kind + "/" + filename];
    if (!data) throw new Error("Missing local PDF resource");
    return decode(data);
  }
}
document.addEventListener("click", event => {
  if (event.target.closest("a")) event.preventDefault();
});
document.addEventListener("submit", event => event.preventDefault());
let pdf, loadingTask, currentPage = 1, busy = false;
const previous = document.getElementById("previous");
const next = document.getElementById("next");
const status = document.getElementById("status");
const content = document.getElementById("content");

async function renderPage(number) {
  if (busy) return;
  busy = true;
  previous.disabled = next.disabled = true;
  try {
    const page = await pdf.getPage(number);
    const natural = page.getViewport({ scale: 1 });
    const width = Math.max(280, Math.min(window.innerWidth - 24, 1200));
    const scale = Math.min(width / natural.width * Math.min(window.devicePixelRatio || 1, 2),
      4096 / natural.width, 4096 / natural.height, Math.sqrt(8000000 / (natural.width * natural.height)));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    canvas.style.width = Math.min(width, viewport.width) + "px";
    canvas.style.maxWidth = "100%";
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", "Trang " + number);
    await page.render({ canvasContext: canvas.getContext("2d"), canvas, viewport }).promise;
    content.replaceChildren(canvas);
    page.cleanup();
    currentPage = number;
    status.textContent = "Trang " + number + "/" + pdf.numPages;
    window.scrollTo(0, 0);
    notify("loaded");
  } catch (error) { fail(error); }
  finally {
    busy = false;
    previous.disabled = currentPage <= 1;
    next.disabled = currentPage >= pdf.numPages;
  }
}
previous.onclick = () => void renderPage(currentPage - 1);
next.onclick = () => void renderPage(currentPage + 1);
window.addEventListener("pagehide", () => { void loadingTask?.destroy().catch(() => {}); });

async function start() {
  const payload = JSON.parse(document.getElementById("payload").textContent);
  const bytes = decode(payload.base64);
  if (payload.extension === "pdf") {
    loadingTask = getDocument({
      data: bytes, BinaryDataFactory: LocalBinaryDataFactory, useWorkerFetch: false,
      useSystemFonts: false, isOffscreenCanvasSupported: false, isImageDecoderSupported: false,
      maxImageSize: 16000000, canvasMaxAreaInBytes: 32000000, enableXfa: false, stopAtErrors: true,
    });
    pdf = await loadingTask.promise;
    document.getElementById("controls").hidden = false;
    await renderPage(1);
  } else if (payload.extension === "docx") {
    const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer }, { externalFileAccess: false });
    const clean = DOMPurify.sanitize(result.value, {
      USE_PROFILES: { html: true },
      FORBID_TAGS: ["a", "form", "input", "button", "style", "video", "audio", "iframe", "object", "embed"],
      FORBID_ATTR: ["style", "srcset", "href", "action", "formaction", "target"],
      RETURN_DOM_FRAGMENT: true,
    });
    for (const img of clean.querySelectorAll("img")) {
      if (!/^data:image\/(?:png|jpeg|gif|webp|bmp);base64,/i.test(img.getAttribute("src") || "")) img.remove();
    }
    content.className = "word";
    content.replaceChildren(clean);
    status.textContent = content.textContent.trim() || content.querySelector("img") ? "" : "Tài liệu trống.";
    notify("loaded");
  } else {
    throw new Error("Unsupported document");
  }
}
void start().catch(fail);
