export type EquipmentStatus =
  | "ready"
  | "using"
  | "booked"
  | "maintenance"
  | "disposed"
  | string;

export type EquipmentComplianceStatus = "overdue" | "upcoming" | "valid" | string;

export interface EquipmentRecord {
  _id: string;
  id?: string;
  companyCode: string;
  branchId?: string;
  code: string;
  name: string;
  category?: string;
  department?: string;
  departmentName?: string;
  status: EquipmentStatus;
  complianceStatus?: EquipmentComplianceStatus;
  nextInspectionDate?: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  location?: string;
  assignedTo?: string;
  assignedToName?: string;
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
  department?: string;
  page?: number;
  limit?: number;
}

export interface EquipmentListResponse {
  items: EquipmentRecord[];
  total: number;
  page?: number;
  limit?: number;
}
