export interface PayrollIssue {
  code: string;
  message: string;
  severity: string;
  runId?: string;
  employeeId?: string;
  field?: string;
  remediation?: string;
}
