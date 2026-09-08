export interface PayrollRunLine {
  employeeId: string;
  employeeName?: string;
  calculation: Record<string, number>;
  warnings?: string[];
}
export interface PayrollRun {
  _id: string;
  periodKey: string;
  status: string;
  version?: number;
  type?: "regular" | "supplemental";
  effectiveLines?: PayrollRunLine[];
  effectiveError?: { code?: string; message?: string };
  publishedEmployeeIds?: string[];
}
export interface CreatePayrollRunInput {
  periodKey: string;
  startDate: string;
  endDate: string;
  type: "regular";
}
