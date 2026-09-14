export interface PayrollAudit {
  _id: string;
  periodKey: string;
  action: string;
  actorId: string;
  actorName?: string;
  actorDeleted?: boolean;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}
