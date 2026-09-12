// The member_directory filter, shared by the admin grids, the bulk actions and
// the roster views.
//
// ONE PREDICATE, BUILT ONCE, USED THREE WAYS: as a `where` on a listing, as a
// `count` behind it, and as a SUBQUERY inside a bulk write. That last one is the
// reason it is a value rather than a query — `inArray(members.id,
// filteredMemberIds(f))` keeps "apply to every member that matches" a single
// statement, so it is one round trip and one atomic step no matter how many
// thousands of members match.
//
// It is built from the view's own column objects rather than as SQL text, so
// Drizzle qualifies every column itself and a renamed column breaks the build
// instead of failing at runtime on the first request that uses that filter.
import { and, between, eq, exists, ilike, inArray, isNotNull, or, sql, type SQL } from 'drizzle-orm';
import { QueryBuilder } from 'drizzle-orm/pg-core';
import { memberDepartments, memberDirectory, rosterDays } from '../../infrastructure/database/schema/index.js';
import { monthBounds } from '../roster/bulk.js';

// See config/constants.ts. Re-exported here because this is where the filters
// live, and anything building a page already imports this module.
export { MAX_PAGE_SIZE } from '../../config/constants.js';

export type SearchField = 'name' | 'national_id' | 'code';

/**
 * Map a search field to its member_directory column.
 *
 * Returns the COLUMN, not its name. A name would end up in an identifier
 * position, which is the one place a string derived from client input must never
 * reach — and there the safety depends on a whitelist somebody has to keep
 * correct. A column object cannot be anything but one of these three, so the
 * guarantee is structural instead.
 */
export function searchColumn(field: SearchField) {
  return field === 'national_id'
    ? memberDirectory.nationalId
    : field === 'code'
      ? memberDirectory.memberCode
      : memberDirectory.fullName;
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
  /** The cohort (الدفعة). */
  groupId?: string | null;
  /**
   * Only members ROSTERED on this shift in (year, month) — or on `day` of it.
   * A roster type is a shift: morning, evening, night.
   */
  shiftId?: string | null;
  /**
   * Only members rostered on this day of (year, month), on `shiftId` if given.
   * The roster and review grids narrow their columns to it as well.
   */
  day?: number | null;
  /**
   * The caller's reach, ANDed on top of everything else.
   *
   * This is not a filter the client sends — it is the admin's assignments,
   * attached server-side. It belongs here rather than as a separate check
   * because it has to survive paging, counting and exporting alike: a scope
   * applied anywhere but inside the query gives a page that is filtered and a
   * total that is not.
   *
   * Undefined means unrestricted (a superadmin). An EMPTY reach means the
   * caller reaches nothing, which is not the same thing — see directoryWhere.
   */
  scope?: { branchIds: readonly string[]; groupIds: readonly string[] } | undefined;
  year?: number;
  month?: number;
}

/** Builds subqueries without a connection — they are composed, not executed. */
const qb = new QueryBuilder();

/**
 * A boolean expression over `member_directory`.
 *
 * `undefined` when nothing was asked for, which is what Drizzle's `.where()`
 * already means by "no restriction" — so the old `true` seed condition is gone
 * rather than replaced.
 */
export function directoryWhere(o: MemberFilters): SQL | undefined {
  const conds: SQL[] = [];

  // THE CALLER'S REACH FIRST, because it is the one condition the client did
  // not choose and cannot widen. An assigned admin sees every branch and group
  // they run — not one at a time, and not everybody.
  if (o.scope) {
    const reach: SQL[] = [];
    if (o.scope.branchIds.length) {
      reach.push(inArray(memberDirectory.branchId, [...o.scope.branchIds]));
    }
    if (o.scope.groupIds.length) {
      reach.push(inArray(memberDirectory.groupId, [...o.scope.groupIds]));
    }
    // An assignment row naming neither reaches NOTHING, rather than everything.
    conds.push(reach.length ? or(...reach)! : sql`false`);
  }

  if (o.branchId) conds.push(eq(memberDirectory.branchId, o.branchId));
  if (o.groupId) conds.push(eq(memberDirectory.groupId, o.groupId));

  const term = (o.search ?? '').trim();
  if (term) conds.push(ilike(searchColumn(o.field ?? 'name'), `%${term}%`));

  if (o.bypass_face) conds.push(eq(memberDirectory.bypassFace, true));
  if (o.bypass_location) conds.push(eq(memberDirectory.bypassLocation, true));
  if (o.frozen) conds.push(isNotNull(memberDirectory.frozenAt));
  if (o.has_face !== undefined) conds.push(eq(memberDirectory.hasFace, o.has_face));
  if (o.is_active !== undefined) conds.push(eq(memberDirectory.isActive, o.is_active));

  if (o.departmentId && o.year && o.month) {
    conds.push(
      exists(
        qb
          .select({ id: memberDepartments.id })
          .from(memberDepartments)
          .where(
            and(
              eq(memberDepartments.memberId, memberDirectory.memberId),
              eq(memberDepartments.year, o.year),
              eq(memberDepartments.month, o.month),
              eq(memberDepartments.departmentId, o.departmentId),
            ),
          ),
      ),
    );
  }

  // A shift and/or a day narrow to the members ROSTERED there: a member with
  // no roster on that shift or day has nothing to show in a grid filtered to
  // it, and would appear as an empty row otherwise.
  if ((o.shiftId || o.day) && o.year && o.month) {
    const { first, last } = monthBounds(o.year, o.month);
    const rostered: SQL[] = [eq(rosterDays.memberId, memberDirectory.memberId)];
    if (o.day) rostered.push(eq(rosterDays.date, dayInMonth(first, o.day)));
    else rostered.push(between(rosterDays.date, first, last));
    if (o.shiftId) rostered.push(eq(rosterDays.shiftId, o.shiftId));
    conds.push(exists(qb.select({ id: rosterDays.id }).from(rosterDays).where(and(...rostered))));
  }

  return conds.length ? and(...conds) : undefined;
}

/**
 * The matching member ids, as a SUBQUERY — for bulk actions.
 *
 * Deliberately not executed here. `inArray(members.id, filteredMemberIds(f))`
 * keeps "update everything that matches" a single statement, which is both one
 * round trip and one atomic step. Fetching the ids first and sending them back
 * would reintroduce exactly the pattern this file exists to remove.
 */
export function filteredMemberIds(o: MemberFilters) {
  return qb
    .select({ member_id: memberDirectory.memberId })
    .from(memberDirectory)
    .where(directoryWhere(o));
}

/** Same, but the profile ids (deleting a member means deleting their profile). */
export function filteredProfileIds(o: MemberFilters) {
  return qb
    .select({ profile_id: memberDirectory.profileId })
    .from(memberDirectory)
    .where(directoryWhere(o));
}

// Month bounds live in the roster domain — they describe a roster month, not a
// member filter — and are re-exported here so the two never drift apart.
export { monthBounds } from '../roster/bulk.js';

/**
 * The day-of-month of a `yyyy-MM-dd` column value.
 *
 * Was `extract(day from rd.date)::int` in four queries. The column is a DATE
 * and Drizzle reads it as the string Postgres prints, so the day is the two
 * characters at offset 8 — no parsing, no timezone, and nothing for the
 * database to compute per row.
 */
export function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10));
}

/**
 * The inverse: day N of the month `first` belongs to, as `yyyy-MM-dd`.
 *
 * `first` comes from `monthBounds`, so its first eight characters are already
 * `yyyy-MM-`. Turning "day of month" into a date lets a filter be an equality
 * on the date column instead of a function of it — which is the difference
 * between using the index on it and scanning the month.
 */
export function dayInMonth(first: string, day: number): string {
  return `${first.slice(0, 8)}${String(day).padStart(2, '0')}`;
}
