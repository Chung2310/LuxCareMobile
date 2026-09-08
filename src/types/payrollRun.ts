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
  effectiveLines?: PayrollRunLine[];
  effectiveError?: { code?: string; message?: string };
  publishedEmployeeIds?: string[];
}
