export function validatePublicLink(value: string) {
  const text = value.trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    if (!["https:", "http:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error();
  } catch {
    throw new Error("Liên kết tài liệu phải là URL HTTP/HTTPS hợp lệ, không chứa tài khoản/mật khẩu.");
  }
  return text;
}
export function publicLinkPatch(kind: "job" | "applicant", value: string, original?: string) {
  const trimmed = value.trim();
  if (trimmed === (original || "")) return {};
  const url = validatePublicLink(trimmed);
  return kind === "job" ? { jdFileUrl: url, jdFilePublicId: "" } : { cvUrl: url, cvPublicId: "" };
}
