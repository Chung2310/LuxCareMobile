export interface PayrollAudit {
  _id: string;
  periodKey: string;
  action: string;
  actorId: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}
