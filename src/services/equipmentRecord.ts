import type { EquipmentDocument, EquipmentRecord } from "../types/equipment";

// Keep the form compatible with older records stored in notes while reading the web API's fields.
export function readEquipmentRecord(raw: EquipmentRecord & Record<string, any>): EquipmentRecord {
  if (!raw || typeof raw !== "object" || !(raw._id || raw.id)) throw new Error("Dữ liệu thiết bị không hợp lệ.");
  const item = { ...raw };
  const aliases: Record<string, string> = {
    imageUri: "imageUrl", origin: "originCountry", model: "modelNumber",
    inspectionIntervalMonths: "inspectionCycleMonths", inspectionResult: "lastInspectionResult",
    inspectionAgency: "lastInspectionProvider", inspectionCertFile: "lastInspectionReportUrl",
    inspectionCertFileName: "lastInspectionReportFileName",
  };
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (raw[canonical] !== undefined) item[alias] = raw[canonical];
  }
  if (Array.isArray(raw.legalDocuments)) item.documents = raw.legalDocuments.map((doc: any) => ({
    ...doc, name: doc.title, uri: doc.fileUrl, code: doc.documentNumber, issueDate: doc.issuedDate?.slice(0, 10), expiryDate: doc.expiryDate?.slice(0, 10),
  }));
  return item;
}

const documentTypes: Record<string, string> = {
  "Giấy chứng nhận xuất xứ & chất lượng (CO/CQ)": "co_cq",
  "Hóa đơn mua bán thiết bị": "invoice",
  "Giấy phép nhập khẩu thiết bị y tế": "import_license",
  "Hồ sơ kỹ thuật / Hướng dẫn sử dụng": "manual",
};
const canonicalTypes = ["invoice", "co_cq", "import_license", "circulation_license", "calibration_cert", "manual", "other"];
export function writeEquipmentDocument(doc: EquipmentDocument) {
  return {
    ...(doc._id ? { _id: doc._id } : {}),
    title: doc.name, fileUrl: doc.uri, type: canonicalTypes.includes(doc.type || "") ? doc.type : documentTypes[doc.type || ""] || "other",
    documentNumber: doc.code || "", issuedDate: doc.issueDate || null, expiryDate: doc.expiryDate || null,
    fileName: doc.fileName || doc.name,
    fileSize: doc.fileSize, uploadedAt: doc.uploadedAt, uploadedBy: doc.uploadedBy,
    issuingAuthority: doc.issuingAuthority, notes: doc.notes,
  };
}

export function riskClassificationValue(value: string) {
  return /^[ABCD]$/.test(value) ? value : /^Loại ([ABCD])$/.exec(value)?.[1] || "";
}
export function inspectionResultValue(value: string) {
  const normalized = value.toLowerCase();
  return ["pass", "fail", "conditional"].includes(normalized) ? normalized : "";
}
