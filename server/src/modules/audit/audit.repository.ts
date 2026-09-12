import { Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lt, lte, or, type SQL } from 'drizzle-orm';
import { auditLog, members, profiles } from '../../infrastructure/database/schema/index.js';
import { BaseRepository } from '../../infrastructure/database/base.repository.js';
import type { Scope } from '../../domain/access/scope.js';
import { SECURITY_EVENTS } from '../../domain/audit/events.js';
import type { AuditFilters } from './audit.types.js';
import type { JsonValue } from '../../common/json.types.js';
export type { AuditFilters } from './audit.types.js';

@Injectable()
export class AuditRepository extends BaseRepository {

  /**
   * Write one row.
   *
   * THE ONE WRITER. Every audited event in the system goes through here, so
   * that "is this recorded?" has a single answer and a new event cannot be
   * added to one path and silently missed on another.
   *
   * `actorId` is nullable because some events genuinely have no actor: a refused
   * sign-in where the account could not be identified has nobody to attribute.
   * Recording it with a null actor is better than not recording it.
   *
   * NEVER throws. An audit write must not be the thing that fails a check-in —
   * a member standing in a corridor should not be refused because a log insert
   * hit a constraint. The failure is reported to the process log instead, which
   * is the one place an operator can still see it.
   */
  async record(actorId: string | null, event: string, detail: JsonValue): Promise<void> {
    try {
      await this.db.insert(auditLog).values({
        actorId,
        event: event as typeof auditLog.$inferInsert.event,
        detail: (detail ?? null) as typeof auditLog.$inferInsert.detail,
      });
    } catch (err) {
      console.error('[audit] failed to record', { event, actorId, err });
    }
  }

  /**
   * The scope predicate for a read.
   *
   * An assigned admin sees the events of MEMBERS they run, and nothing else.
   * Two consequences worth stating, because both are deliberate:
   *
   *   * events by staff — another admin's `staff_deleted`, a superadmin's
   *     `master_login` — are NOT visible to an assigned admin. Staff are
   *     faculty-wide and do not belong to a branch, so there is no assignment
   *     that could grant them.
   *   * events with a null actor are not visible either, for the same reason:
   *     nothing connects them to an assignment, and a row that cannot be
   *     attributed cannot be scoped.
   *
   * Both are visible to a superadmin, and to an admin with no assignments —
   * which, per domain/access/scope.ts, means faculty-wide.
   *
   * RETURN VALUES: `undefined` means no narrowing, `null` means this scope
   * reaches nothing. They are NOT the same and must never collapse into each
   * other — a missing predicate widens the query to EVERYTHING, which is the
   * one mistake here that fails open. Callers turn `null` into an empty result
   * without querying at all.
   */
  private scopePredicate(scope: Scope): SQL | undefined | null {
    if (scope.kind === 'all') return undefined;
    // 'none' cannot reach this: the service refuses non-staff before asking.
    if (scope.kind === 'none') return null;

    const reach: SQL[] = [];
    if (scope.branchIds.length) reach.push(inArray(members.branchId, [...scope.branchIds]));
    if (scope.groupIds.length) reach.push(inArray(members.groupId, [...scope.groupIds]));
    // An assignment row with both columns null narrows to nothing rather than
    // to everything — the same way `null in (…)` reads as false in SQL.
    if (!reach.length) return null;

    return and(isNotNull(members.id), or(...reach));
  }

  private where(scope: Scope, f: AuditFilters): SQL | undefined | null {
    const scoped = this.scopePredicate(scope);
    if (scoped === null) return null; // reaches nothing
    const parts: (SQL | undefined)[] = [scoped];

    if (f.securityOnly) parts.push(inArray(auditLog.event, [...SECURITY_EVENTS] as never[]));
    else if (f.events?.length) parts.push(inArray(auditLog.event, f.events as never[]));

    if (f.actorId) parts.push(eq(auditLog.actorId, f.actorId));
    if (f.from) parts.push(gte(auditLog.createdAt, f.from));
    if (f.to) parts.push(lte(auditLog.createdAt, f.to));

    const kept = parts.filter((p): p is SQL => p !== undefined);
    return kept.length ? and(...kept) : undefined;
  }

  /**
   * A page of the trail, newest first.
   *
   * The actor is LEFT joined twice over: to `profiles` for the name, and to
   * `members` for the branch and group the scope predicate tests. Both are left
   * joins because an actor may be staff (a profile, no member row) or gone
   * entirely (the foreign key is ON DELETE SET NULL, so the row outlives the
   * account — which is the point of an audit log).
   */
  async findPage(scope: Scope, filters: AuditFilters, limit: number, offset: number) {
    const where = this.where(scope, filters);
    if (where === null) return { rows: [], total: 0 };

    const rows = await this.db
      .select({
        id: auditLog.id,
        event: auditLog.event,
        actor_id: auditLog.actorId,
        actor_name: profiles.fullName,
        actor_national_id: profiles.nationalId,
        actor_role: profiles.role,
        detail: auditLog.detail,
        created_at: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(profiles, eq(profiles.id, auditLog.actorId))
      .leftJoin(members, eq(members.profileId, profiles.id))
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    const totalRows = await this.db
      .select({ n: count() })
      .from(auditLog)
      .leftJoin(profiles, eq(profiles.id, auditLog.actorId))
      .leftJoin(members, eq(members.profileId, profiles.id))
      .where(where);

    return { rows, total: Number(totalRows[0]?.n ?? 0) };
  }

  /** How many rows of each event in range — the summary strip above the table. */
  async countByEvent(scope: Scope, filters: AuditFilters) {
    const where = this.where(scope, filters);
    if (where === null) return [];
    return this.db
      .select({ event: auditLog.event, n: count() })
      .from(auditLog)
      .leftJoin(profiles, eq(profiles.id, auditLog.actorId))
      .leftJoin(members, eq(members.profileId, profiles.id))
      .where(where)
      .groupBy(auditLog.event);
  }

  /**
   * Delete entries older than `days`. Returns how many went.
   *
   * Capped per run: a first run on a database that has never been pruned can
   * face millions of rows, and one unbounded DELETE would hold a long
   * transaction and bloat the table. The scheduler calls this until it returns
   * less than the cap.
   */
  async deleteOlderThan(days: number, cap: number): Promise<number> {
    // The cutoff is computed here rather than as `now() - interval '<n> days'`
    // in the statement. It is a retention boundary measured in days, so a second
    // of clock skew between Node and Postgres cannot matter — and it is the last
    // place in this file that needed an interval literal built by hand.
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Two statements, same bound: pick the oldest `cap` ids, then delete exactly
    // those. It was one statement with a CTE; the CTE bought atomicity that this
    // does not need, because both run inside the caller's transaction and a
    // deleted audit row is never coming back either way.
    const victims = await this.db
      .select({ id: auditLog.id })
      .from(auditLog)
      .where(lt(auditLog.createdAt, cutoff))
      .orderBy(asc(auditLog.createdAt))
      .limit(cap);

    if (!victims.length) return 0;

    const gone = await this.db
      .delete(auditLog)
      .where(inArray(auditLog.id, victims.map((v) => v.id)))
      .returning({ id: auditLog.id });

    return gone.length;
  }
}
