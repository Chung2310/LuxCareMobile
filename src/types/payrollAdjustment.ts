export interface PayrollAdjustment {
  _id: string;
  periodKey: string;
  employeeId: string;
  employeeName?: string;
  kind: "allowance" | "bonus" | "deduction" | "correction";
  amount: number;
  reason: string;
  status: "draft" | "pending" | "approved" | "rejected" | "snapshotted";
  createdAt?: string;
  snapshotAt?: string;
}
