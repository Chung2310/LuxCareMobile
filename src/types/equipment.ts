export type EquipmentStatus =
  | "ready"
  | "using"
  | "booked"
  | "maintenance"
  | "disposed"
  | string;

export type EquipmentComplianceStatus = "overdue" | "upcoming" | "valid" | string;

export interface EquipmentDocument {
  _id?: string;
  name: string;
  uri: string;
  type?: string;
  code?: string;
  issueDate?: string;
  expiryDate?: string;
  fileName?: string;
  fileSize?: number;
  uploadedAt?: string;
  uploadedBy?: string;
  issuingAuthority?: string;
  notes?: string;
}

export interface EquipmentRecord {
  _id: string;
  id?: string;
  companyCode: string;
  branchId?: string;
  code: string;
  name: string;
  category?: string;
  departmentId?: string | null;
  department?: string;
  departmentName?: string;
  status: EquipmentStatus;
  complianceStatus?: EquipmentComplianceStatus;
  nextInspectionDate?: string;
  lastInspectionDate?: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  origin?: string;
  riskClassification?: string;
  inspectionIntervalMonths?: number | string;
  inspectionResult?: string;
  inspectionAgency?: string;
  inspectionCertFile?: string;
  inspectionCertFileName?: string;
  documents?: EquipmentDocument[];
  location?: string;
  purchaseDate?: string;
  usageStartDate?: string;
  assignedTo?: string;
  assignedToName?: string;
  currentBorrowerId?: string;
  currentBorrowerName?: string;
  imageUri?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface EquipmentSummary {
  total: number;
  byStatus: { status: string; count: number }[];
  booked?: number;
  ready?: number;
  using?: number;
  maintenance?: number;
  disposed?: number;
}

export interface EquipmentComplianceSummary {
  overdue: number;
  upcoming: number;
  valid: number;
}

export interface EquipmentListParams {
  search?: string;
  status?: string;
  category?: string;
  departmentId?: string;
  page?: number;
  limit?: number;
}

export interface EquipmentListResponse {
  items: EquipmentRecord[];
  total: number;
  page?: number;
  limit?: number;
}

export interface EquipmentRequestRecord {
  _id: string;
  equipmentId: string;
  equipmentName: string;
  equipmentCode: string;
  employeeId: string;
  employeeName: string;
  requestType: "borrow" | "return";
  status: "pending" | "approved" | "rejected" | "cancelled";
  reason?: string;
  note?: string;
  expectedReturnAt?: string;
  rejectionReason?: string;
  createdAt?: string;
}
