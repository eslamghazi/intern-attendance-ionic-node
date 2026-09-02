// The member_directory filter shared by the admin grids, the bulk actions and
// the roster views.
//
// On PostgREST every one of these filters had to travel in the URL, so a bulk
// action first pulled every matching id down to the phone and then sent them
// back in chunks. Here the predicate is built once and reused as a subquery, so
// "apply to all filtered" is a single UPDATE.
import { sql, type SQL } from 'drizzle-orm';

/**
 * Largest page any listing endpoint will serve.
 *
 * This is NOT a UI page size — the grids ask for ~12 rows. It has to cover the
 * EXPORT path, where the client asks for one huge page on purpose (the client's
 * REPORT_PAGE_SIZE). Set it below that and every export — members, the monthly
 * attendance matrix, the roster — fails with a validation error instead of
 * downloading.
 *
 * The limit rejects rather than clamps: silently returning fewer rows than
 * asked for is how an export loses students without anyone noticing.
 */
export const MAX_PAGE_SIZE = 5000;

export type SearchField = 'name' | 'national_id' | 'code';

/** Map a search field to its member_directory column. Whitelisted — the value
 *  reaches an identifier position, so it can never come straight from input. */
export function searchColumn(field: SearchField): 'full_name' | 'national_id' | 'member_code' {
  return field === 'national_id' ? 'national_id' : field === 'code' ? 'member_code' : 'full_name';
}

export interface MemberFilters {
  branchId?: string | null;
  search?: string;
  field?: SearchField;
  /** Only members with the flag on. Absent/false means "don't filter". */
  bypass_face?: boolean;
  bypass_location?: boolean;
  /** Only members whose app clock is pinned. */
  frozen?: boolean;
  /** Tri-state: true = enrolled, false = not, undefined = all. */
  has_face?: boolean;
  is_active?: boolean;
  /** Restrict to the members assigned to this department for (year, month). */
  departmentId?: string | null;
  year?: number;
  month?: number;
}

/**
 * A boolean expression over `member_directory d`. Callers alias the view as `d`.
 */
export function directoryWhere(o: MemberFilters): SQL {
  const conds: SQL[] = [sql`true`];

  if (o.branchId) conds.push(sql`d.branch_id = ${o.branchId}`);

  const term = (o.search ?? '').trim();
  if (term) {
    const col = searchColumn(o.field ?? 'name');
    conds.push(sql`${sql.identifier(col)} ilike ${`%${term}%`}`);
  }

  if (o.bypass_face) conds.push(sql`d.bypass_face = true`);
  if (o.bypass_location) conds.push(sql`d.bypass_location = true`);
  if (o.frozen) conds.push(sql`d.frozen_at is not null`);
  if (o.has_face !== undefined) conds.push(sql`d.has_face = ${o.has_face}`);
  if (o.is_active !== undefined) conds.push(sql`d.is_active = ${o.is_active}`);

  if (o.departmentId && o.year && o.month) {
    conds.push(sql`exists (
      select 1 from public.member_departments md
       where md.member_id = d.member_id
         and md.year = ${o.year} and md.month = ${o.month}
         and md.department_id = ${o.departmentId}
    )`);
  }

  return sql.join(conds, sql` and `);
}

/** `select member_id from member_directory d where <filters>` — for bulk actions. */
export function filteredMemberIds(o: MemberFilters): SQL {
  return sql`(select d.member_id from public.member_directory d where ${directoryWhere(o)})`;
}

/** Same, but the profile ids (deleting a member means deleting their profile). */
export function filteredProfileIds(o: MemberFilters): SQL {
  return sql`(select d.profile_id from public.member_directory d where ${directoryWhere(o)})`;
}

// Month bounds live in the roster domain — they describe a roster month, not a
// member filter — and are re-exported here so the two never drift apart.
export { monthBounds } from '../roster/bulk.js';
