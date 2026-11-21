import type { EquipmentDocument } from "../../../../src/types/equipment";
import { inspectionResultValue, riskClassificationValue, writeEquipmentDocument } from "../../../../src/services/equipmentRecord";

export function equipmentTechnicalPayload(form: {
  riskClassification: string; manufacturer: string; origin: string; model: string; serialNumber: string;
  inspectionIntervalMonths: string; lastInspectionDate: string; nextInspectionDate: string;
  inspectionResult: string; inspectionAgency: string; inspectionCertFile: string; inspectionCertFileName: string;
  usageStartDate: string; documents: EquipmentDocument[];
}) {
  const cycle = form.inspectionIntervalMonths.trim();
  if (cycle && (!/^\d+$/.test(cycle) || Number(cycle) < 1 || Number(cycle) > 120))
    throw new Error("Chu kỳ kiểm định phải là số nguyên từ 1 đến 120 tháng.");
  return {
    riskClassification: riskClassificationValue(form.riskClassification) || null,
    manufacturer: form.manufacturer.trim(), originCountry: form.origin.trim(), modelNumber: form.model.trim(), serialNumber: form.serialNumber.trim(),
    inspectionCycleMonths: cycle ? Number(cycle) : null,
    lastInspectionDate: form.lastInspectionDate || null, nextInspectionDate: form.nextInspectionDate || null,
    lastInspectionResult: inspectionResultValue(form.inspectionResult) || null,
    lastInspectionProvider: form.inspectionAgency.trim(), lastInspectionReportUrl: form.inspectionCertFile.trim(), lastInspectionReportFileName: form.inspectionCertFileName,
    // Older mobile records may only have document names in notes, without attached files.
    // Keep those in notes rather than submitting invalid empty URLs to the legal-document API.
    usageStartDate: form.usageStartDate || null, legalDocuments: form.documents.filter(doc => doc.uri?.trim()).map(writeEquipmentDocument),
  };
}
