// The audit trail.
//
// Read-only, and there is no write call here on purpose: every row is written
// by the server as a side effect of something it did itself. A client that
// could post audit rows could forge the record of its own refusal.
import { apiFetch } from './http';
import type { JsonValue } from '../json.types';

/**
 * Every event the server records. Kept in step with
 * server/src/common/enums/audit.enum.ts — a value missing here shows up in the
 * table as its raw key rather than a translated label, which is ugly but never
 * hides a row.
 */
export const AUDIT_EVENTS = [
  'login',
  'password_changed',
  'face_enrolled',
  'mock_location_detected',
  'out_of_range',
  'low_accuracy',
  'face_mismatch',
  'liveness_failed',
  'integrity_failed',
  'check_in',
  'check_out',
  'master_login',
  'staff_deleted',
  'member_lookup_out_of_scope',
  'outside_window',
  'checkout_blocked',
  'server_error',
  'superadmin_backup',
  'superadmin_restore',
  'attendance_imported',
] as const;

export type AuditEventName = (typeof AUDIT_EVENTS)[number];

/**
 * The events that describe a control being tested rather than the ordinary
 * traffic of people arriving at work. Mirrors
 * server/src/domain/audit/events.ts — the server filters by its own list, this
 * one only decides what gets highlighted.
 */
export const SECURITY_EVENTS: readonly string[] = [
  'mock_location_detected',
  'face_mismatch',
  'liveness_failed',
  'integrity_failed',
  'master_login',
  'staff_deleted',
  'member_lookup_out_of_scope',
  'out_of_range',
  'low_accuracy',
  'outside_window',
  'checkout_blocked',
];

export interface AuditEntry {
  id: string;
  event: string;
  actor_id: string | null;
  actor_name: string | null;
  actor_national_id: string | null;
  actor_role: string | null;
  detail: JsonValue;
  created_at: string;
}

export interface AuditFilters {
  event?: string[];
  actor_id?: string;
  /** ISO date (YYYY-MM-DD) — sent as the start of that day. */
  from?: string;
  /** ISO date (YYYY-MM-DD) — sent as the end of that day. */
  to?: string;
  security_only?: boolean;
}

/**
 * A date the user picked is a DAY, not an instant. `to` has to mean "up to the
 * end of that day" or picking today for both ends returns nothing — which is
 * the first thing anyone tries.
 */
function toQuery(filters: AuditFilters, page?: number, pageSize?: number): string {
  const q = new URLSearchParams();
  if (page) q.set('page', String(page));
  if (pageSize) q.set('page_size', String(pageSize));
  for (const e of filters.event ?? []) q.append('event', e);
  if (filters.actor_id) q.set('actor_id', filters.actor_id);
  if (filters.from) q.set('from', `${filters.from}T00:00:00.000Z`);
  if (filters.to) q.set('to', `${filters.to}T23:59:59.999Z`);
  if (filters.security_only) q.set('security_only', '1');
  const s = q.toString();
  return s ? `?${s}` : '';
}

export function listAudit(
  filters: AuditFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: AuditEntry[]; total: number }> {
  return apiFetch(`/audit${toQuery(filters, page, pageSize)}`);
}

/** Counts per event for the same filters, for the strip above the table. */
export function auditSummary(filters: AuditFilters): Promise<Record<string, number>> {
  return apiFetch(`/audit/summary${toQuery(filters)}`);
}
