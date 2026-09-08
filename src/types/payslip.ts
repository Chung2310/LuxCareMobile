export interface Payslip {
  runId: string;
  periodKey?: string;
  employeeId: string;
  employeeName?: string;
  netPay: number;
  paidAmount: number;
  balance: number;
  warnings?: string[];
}
export interface PayslipDetail {
  employeeId: string;
  attendance?: Parameters<typeof import("../components/hr/payrollDetails").buildPayrollDetails>[0];
  calculation: Record<string, number>;
  vietnam?: Record<string, unknown>;
  warnings?: string[];
}
