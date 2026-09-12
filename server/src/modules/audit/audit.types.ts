// What a reader may narrow the audit trail by.

export interface AuditFilters {
  events?: string[];
  actorId?: string;
  from?: string;
  to?: string;
  securityOnly?: boolean;
}
