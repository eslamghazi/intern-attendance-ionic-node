// Turn raw Postgres errors into friendly, translated messages.
import type { JsonObject } from './json.types';
// Most important: a delete blocked by a foreign key (the row is still used
// elsewhere) becomes "can't delete — it's linked to <members/attendance/…>".

type T = (key: string, opts?: JsonObject) => string;

interface PgError {
  code?: string;
  message?: string;
  details?: string;
}

/** Returns a friendly message for known DB errors, or null if not recognized. */
export function describeDbError(error: unknown, t: T): string | null {
  const e = error as PgError | null;
  if (!e) return null;

  // 23503 = foreign_key_violation (row is still referenced by other rows)
  if (e.code === '23503') {
    const m =
      /referenced from table "([^"]+)"/.exec(e.details ?? '') ??
      /on table "([^"]+)"/.exec(e.message ?? '');
    const table = m?.[1] ?? '';
    const what = table ? t(`tables.${table}`, { defaultValue: table }) : t('common.relatedRecords');
    return t('common.cannotDeleteLinked', { what });
  }

  // 23505 = unique_violation (duplicate key / value)
  if (e.code === '23505') return t('common.duplicateValue');

  return null;
}
