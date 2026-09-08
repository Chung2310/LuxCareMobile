export const RECRUITMENT_MIMES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};
export function recruitmentFileType(name: string, size: number) {
  const type = RECRUITMENT_MIMES[name.split(".").pop()?.toLowerCase() || ""];
  if (!type) throw new Error("Chỉ hỗ trợ PDF, DOC hoặc DOCX.");
  if (!Number.isFinite(size) || size <= 0 || size > 10 * 1024 * 1024)
    throw new Error("Tệp phải có nội dung và không vượt quá 10 MB.");
  return type;
}
