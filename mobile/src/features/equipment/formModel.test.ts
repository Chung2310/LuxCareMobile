import { expect, it } from "vitest";
import { equipmentTechnicalPayload } from "./formModel";
import { readEquipmentRecord } from "../../../../src/services/equipmentRecord";
const form = {
  riskClassification: "Loại B", manufacturer: "  Hãng SX  ", origin: "Việt Nam", model: "Model 1", serialNumber: "SN1",
  inspectionIntervalMonths: "6", lastInspectionDate: "2026-01-01", nextInspectionDate: "2027-01-01",
  inspectionResult: "Pass", inspectionAgency: "Đơn vị kiểm định", inspectionCertFile: "https://files.example/report.pdf", inspectionCertFileName: "report.pdf",
  usageStartDate: "2026-01-01", documents: [{ _id: "document-id", name: "Chứng nhận", uri: "https://files.example/co.pdf", type: "co_cq", code: "CQ1", issueDate: "2026-01-01", uploadedAt: "2026-01-02T00:00:00Z", uploadedBy: "user-id" }],
};
it("writes technical and inspection values to real backend fields so web and summary see the changes", () => {
  expect(equipmentTechnicalPayload(form)).toEqual({
    riskClassification: "B", manufacturer: "Hãng SX", originCountry: "Việt Nam", modelNumber: "Model 1", serialNumber: "SN1", inspectionCycleMonths: 6,
    lastInspectionDate: "2026-01-01", nextInspectionDate: "2027-01-01", lastInspectionResult: "pass", lastInspectionProvider: "Đơn vị kiểm định",
    lastInspectionReportUrl: "https://files.example/report.pdf", lastInspectionReportFileName: "report.pdf", usageStartDate: "2026-01-01",
    legalDocuments: [{ _id: "document-id", title: "Chứng nhận", fileUrl: "https://files.example/co.pdf", type: "co_cq", documentNumber: "CQ1", issuedDate: "2026-01-01", expiryDate: null, fileName: "Chứng nhận", uploadedAt: "2026-01-02T00:00:00Z", uploadedBy: "user-id" }],
  });
});
it("sends explicit clearing values instead of accidentally retaining old medical data", () => {
  expect(equipmentTechnicalPayload({ ...form, riskClassification: "Chưa phân nhóm", origin: "", model: "", nextInspectionDate: "", inspectionResult: "Pending", inspectionIntervalMonths: "", documents: [] }))
    .toMatchObject({ riskClassification: null, originCountry: "", modelNumber: "", nextInspectionDate: null, lastInspectionResult: null, inspectionCycleMonths: null, legalDocuments: [] });
});
it("does not block editing an older record that has document names without attached files", () => {
  const result = equipmentTechnicalPayload({ ...form, documents: [{ name: "Hóa đơn cũ", uri: "" }, ...form.documents] });
  expect(result.legalDocuments).toHaveLength(1);
  expect(result.legalDocuments[0].fileUrl).toBe("https://files.example/co.pdf");
});
it.each(["0", "121", "-1", "1.5", "abc"])("rejects an invalid inspection interval before sending a save: %s", interval => {
  expect(() => equipmentTechnicalPayload({ ...form, inspectionIntervalMonths: interval })).toThrow("1 đến 120");
});
it("reads a web record and preserves document IDs and metadata through the mobile save round trip", () => {
  const raw = { _id: "one", companyCode: "COMP", name: "Máy", code: "TB", status: "available", ...equipmentTechnicalPayload(form), imageUrl: "https://files.example/image.png" };
  const item = readEquipmentRecord(raw);
  expect(item).toMatchObject({ imageUri: raw.imageUrl, origin: "Việt Nam", model: "Model 1", inspectionIntervalMonths: 6, inspectionResult: "pass", inspectionCertFile: form.inspectionCertFile });
  const roundTrip = equipmentTechnicalPayload({ ...form, documents: item.documents! });
  expect(roundTrip.legalDocuments).toEqual(raw.legalDocuments);
});
