const types: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp",
  heic: "image/heic", heif: "image/heif", avif: "image/avif", bmp: "image/bmp", svg: "image/svg+xml",
  mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", mkv: "video/x-matroska",
  zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
  bin: "application/octet-stream", txt: "text/plain", csv: "text/csv", html: "text/html", htm: "text/html", json: "application/json",
};
export function fileExtension(name: string) {
  return /\.([a-z0-9]{1,10})$/i.exec(name)?.[1].toLowerCase() || "";
}
function mime(value = "") {
  const normalized = value.split(";")[0].trim().toLowerCase();
  return ({ "audio/m4a": "audio/mp4", "audio/x-m4a": "audio/mp4", "image/jpg": "image/jpeg",
    "application/x-zip-compressed": "application/zip" } as Record<string, string>)[normalized] || normalized;
}
function decode(value: string) { try { return decodeURIComponent(value); } catch { return value; } }
function basename(value: string) { return value.split(/[\\/]/).pop() || ""; }
function dispositionName(value = "") {
  const encoded = /filename\*\s*=\s*(?:UTF-8)?'[^']*'([^;]+)/i.exec(value);
  if (encoded) return basename(decode(encoded[1].trim().replace(/^"|"$/g, "")));
  const plain = /filename\s*=\s*(?:"([^"]+)"|([^;]+))/i.exec(value);
  return basename((plain?.[1] || plain?.[2] || "").trim());
}
function detectedMime(bytes?: Uint8Array) {
  if (!bytes) return "";
  const starts = (...values: number[]) => values.every((v, i) => bytes[i] === v);
  const text = String.fromCharCode(...bytes.subarray(0, 512));
  if (text.startsWith("%PDF-")) return types.pdf;
  if (starts(137, 80, 78, 71, 13, 10, 26, 10)) return types.png;
  if (starts(255, 216, 255)) return types.jpg;
  if (/^GIF8[79]a/.test(text)) return types.gif;
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WEBP") return types.webp;
  if (text.startsWith("RIFF") && text.slice(8, 12) === "WAVE") return types.wav;
  if (text.startsWith("ID3")) return types.mp3;
  if (text.slice(4, 8) === "ftyp") {
    const brand = text.slice(8, 12);
    if (/^(heic|heix|hevc|hevx)$/.test(brand)) return types.heic;
    if (/^(avif|avis)$/.test(brand)) return types.avif;
    if (brand === "qt  ") return types.mov;
    if (brand === "M4A ") return types.m4a;
  }
  if (/^\s*(?:<!doctype html|<html\b)/i.test(text.replace(/^\xEF\xBB\xBF/, ""))) return types.html;
  if (/^\s*\{\s*"(?:error|message|status|detail)"\s*:/.test(text)) return types.json;
  return "";
}
export type FileFormatInput = {
  name?: string; url?: string; contentType?: string; contentDisposition?: string; mimeType?: string; bytes?: Uint8Array;
};
export function resolveFileFormat(input: FileFormatInput) {
  let urlName = "";
  try {
    const url = new URL(input.url || "");
    if (["http:", "https:", "file:", "content:"].includes(url.protocol)) urlName = basename(decode(url.pathname));
  } catch {}
  const requested = basename(input.name || "");
  const server = dispositionName(input.contentDisposition);
  const named = [requested, server, urlName].find(n => types[fileExtension(n)]);
  const hint = mime(input.mimeType);
  const expected = hint && hint !== "application/octet-stream" && Object.values(types).includes(hint)
    ? hint : types[fileExtension(named || "")] || "";
  const responseType = mime(input.contentType);
  const detected = detectedMime(input.bytes);
  const actual = detected || responseType;
  if ((actual === types.html || actual === types.json || actual.endsWith("+json")) && expected !== actual) {
    throw new Error("Máy chủ trả về trang web hoặc dữ liệu lỗi thay vì tệp. Vui lòng kiểm tra lại liên kết tải.");
  }
  let mimeType = detected || responseType;
  if (!mimeType || ["application/octet-stream", "binary/octet-stream"].includes(mimeType))
    mimeType = types[fileExtension(server)] || mimeType;
  if (!mimeType || mimeType === "application/octet-stream" || mimeType === "binary/octet-stream" ||
      mimeType === "text/plain" || (mimeType === types.zip && ["docx", "xlsx", "pptx"].includes(fileExtension(named || "")))) {
    mimeType = expected || mimeType || "application/octet-stream";
  }
  let name = requested || server || urlName || "tai-lieu";
  const ext = fileExtension(name);
  const canonical = Object.keys(types).find(key => types[key] === mimeType);
  if (canonical && types[ext] !== mimeType && (mimeType !== "application/octet-stream" || !ext)) {
    name = (ext && (types[ext] || ["dat", "download"].includes(ext)) ? name.slice(0, -ext.length - 1) : name) + "." + canonical;
  } else if (!ext && fileExtension(server || urlName)) {
    name += "." + fileExtension(server || urlName);
  }
  name = name.replace(/[^\p{L}\p{N}._-]/gu, "_").replace(/^\.+/, "") || "tai-lieu";
  const suffix = fileExtension(name);
  if (name.length > 120) name = name.slice(0, 110) + (suffix ? "." + suffix : "");
  return { name, mimeType: mimeType || "application/octet-stream", extension: fileExtension(name) };
}
export function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const chunks: string[] = [];
  let chunk = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const value = (bytes[i] << 16) | ((bytes[i + 1] || 0) << 8) | (bytes[i + 2] || 0);
    chunk += alphabet[(value >>> 18) & 63] + alphabet[(value >>> 12) & 63] +
      (i + 1 < bytes.length ? alphabet[(value >>> 6) & 63] : "=") +
      (i + 2 < bytes.length ? alphabet[value & 63] : "=");
    if (chunk.length >= 8192) { chunks.push(chunk); chunk = ""; }
  }
  chunks.push(chunk);
  return chunks.join("");
}
