export interface PayrollPayment {
  _id: string;
  runId: string;
  amount: number;
  status: "draft" | "confirmed" | "cancelled" | "reversed";
  lines?: { employeeId: string; amount: number }[];
  paymentDate?: string;
  createdAt?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  reversedAt?: string;
  evidenceUrl?: string;
  note?: string;
}
