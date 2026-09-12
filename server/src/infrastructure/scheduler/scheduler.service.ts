// Scheduled maintenance, run by the API.
//
// Six jobs: expiring tokens, closing attendance nobody checked out of, and the
// retention passes that keep the audit log, the probe images and the attachment
// rows from growing without limit.
//
// THE DATABASE DOES NOT SCHEDULE THEM, AND THAT IS THE DESIGN
//
// A database scheduler means an extension, which means a SUPERUSER install, a
// `shared_preload_libraries` entry and a server restart — a permanent
// deployment prerequisite. It also means the job bodies live as SQL strings
// inside scheduler rows, where nothing type-checks them, nothing tests them,
// and a mistake is found by noticing that attendance quietly stopped being
// concluded some weeks ago.
//
// As ordinary methods they are compiled, and the rules they apply — the
// overnight shift boundary, the Cairo clock — are the same tested functions the
// request path uses rather than a second copy written in another language.
//
// RUNNING ONCE ACROSS N INSTANCES
//
// A plain setInterval in two instances runs everything twice. Every job
// therefore holds a Postgres advisory lock keyed on its own name for as long as
// it runs: whoever gets it runs, everyone else skips this tick and tries again
// at the next. No table, no leader election, no extra dependency — see
// infrastructure/database/advisory-lock.service.ts for why it is the
// session-scoped form and not the transaction-scoped one.
//
// The jobs are all idempotent anyway — deletes bounded by age, and an UPDATE
// that sets a status already-set rows do not match — so a double run would be
// harmless. The lock keeps two instances from doing the same work twice, not
// from being correct.
//
// FAILURE
//
// A job that throws is logged and the tick ends. It is not retried immediately
// and it never takes the process down: maintenance falling behind is a problem
// for tomorrow, while an API that will not start is a problem right now.
import { Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { and, eq, gte, inArray, isNotNull, isNull, lt, ne, or } from 'drizzle-orm';
import { AdvisoryLockService } from '../database/advisory-lock.service.js';
import { UnitOfWorkService } from '../database/unit-of-work.service.js';
import { appSettings, attendance, qrTokens, refreshTokens, shifts } from '../database/schema/index.js';
import { CheckoutStatus } from '../../common/enums/index.js';
import { cairoNow } from '../../domain/clock.js';
import { nextDate, previousDate, toMin } from '../../domain/attendance/windows.js';
import { env } from '../../config/env.js';
import { AuditService } from '../../modules/audit/audit.service.js';
import { StorageService } from '../../modules/storage/storage.service.js';

import { HOUR_MS as HOUR, MINUTE_MS as MINUTE } from '../../config/constants.js';

interface Job {
  name: string;
  everyMs: number;
  /** Returns a short line for the log, or null to say nothing happened. */
  run: () => Promise<string | null>;
}

@Injectable()
export class SchedulerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private timers: NodeJS.Timeout[] = [];
  private readonly running = new Set<string>();
  private stopped = false;

  constructor(
    private readonly uow: UnitOfWorkService,
    private readonly locks: AdvisoryLockService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  private get jobs(): Job[] {
    return [
      {
        // A minute of grace after expiry, so a token being redeemed at the
        // instant it lapses is refused by the check that reads it rather than
        // vanishing underneath it and returning "no such token".
        name: 'cleanup-expired-qr',
        everyMs: MINUTE,
        run: async () => {
          const cutoff = new Date(Date.now() - MINUTE).toISOString();
          const n = await this.uow.transaction(async (db) => {
            const gone = await db
              .delete(qrTokens)
              .where(lt(qrTokens.expiresAt, cutoff))
              .returning({ id: qrTokens.id });
            return gone.length;
          });
          return n ? `deleted ${n} expired QR token(s)` : null;
        },
      },
      {
        // Closes an attendance that was never checked out of, once that
        // shift's check-out window has passed.
        //
        // The deadline uses the same overnight rule as the request path
        // (domain/attendance/windows.ts): a close time that reads EARLIER on
        // the clock than the open time belongs to the following day.
        //
        // Reading the candidates into Node costs nothing here — the set is
        // bounded to attendance still open from the last two days, at most one
        // day's students — and it keeps that rule in one tested place.
        //
        // The two-day bound is load-bearing: anything older was closed by an
        // earlier run, and without it this rescans the whole table every
        // fifteen minutes forever.
        name: 'mark-left-work',
        everyMs: 15 * MINUTE,
        run: async () => {
          const now = cairoNow();

          const n = await this.uow.transaction(async (db) => {
            const conf = await db
              .select({ enabled: appSettings.autoLeaveWork })
              .from(appSettings)
              .where(eq(appSettings.id, 1))
              .limit(1);
            if (!conf[0]?.enabled) return 0;

            const open = await db
              .select({
                id: attendance.id,
                date: attendance.date,
                checkoutClose: shifts.checkoutClose,
                endTime: shifts.endTime,
                checkinOpen: shifts.checkinOpen,
              })
              .from(attendance)
              .leftJoin(shifts, eq(shifts.id, attendance.shiftId))
              .where(
                and(
                  isNotNull(attendance.checkInAt),
                  isNull(attendance.checkOutAt),
                  // `is distinct from 'left_work'` — a null status counts as not
                  // yet marked, which a plain `<>` would silently exclude.
                  or(
                    isNull(attendance.checkoutStatus),
                    ne(attendance.checkoutStatus, CheckoutStatus.LEFT_WORK),
                  ),
                  gte(attendance.date, previousDate(now.date)),
                ),
              );

            const overdue = open
              .filter((row) => {
                const close = toMin(row.checkoutClose ?? row.endTime ?? '23:59');
                // A close time EARLIER on the clock than the open time means an
                // overnight shift: its deadline is the following day.
                const overnight = row.checkinOpen != null && close < toMin(row.checkinOpen);
                const deadlineDate = overnight ? nextDate(row.date) : row.date;

                if (now.date !== deadlineDate) return now.date > deadlineDate;
                return now.minutesOfDay > close;
              })
              .map((row) => row.id);

            if (!overdue.length) return 0;

            const marked = await db
              .update(attendance)
              .set({ checkoutStatus: CheckoutStatus.LEFT_WORK })
              .where(inArray(attendance.id, overdue))
              .returning({ id: attendance.id });

            return marked.length;
          });
          return n ? `marked ${n} attendance row(s) left_work` : null;
        },
      },
      {
        // Kept for a week AFTER expiry rather than deleted on the dot: a token
        // replayed just after it lapses is still worth seeing, and the row is
        // what makes that visible. Revoked-but-unexpired rows are deliberately
        // NOT touched — those are what reuse detection matches against.
        name: 'cleanup-expired-refresh-tokens',
        everyMs: 24 * HOUR,
        run: async () => {
          const cutoff = new Date(Date.now() - 7 * 24 * HOUR).toISOString();
          const n = await this.uow.transaction(async (db) => {
            const gone = await db
              .delete(refreshTokens)
              .where(lt(refreshTokens.expiresAt, cutoff))
              .returning({ id: refreshTokens.id });
            return gone.length;
          });
          return n ? `deleted ${n} expired refresh token(s)` : null;
        },
      },
      {
        // A row per check-in, per member, per day — so this needs a bound, or
        // the audit log becomes the largest thing in the database inside a year.
        name: 'prune-audit',
        everyMs: 24 * HOUR,
        run: async () => {
          let total = 0;
          // Bounded per pass, looped until a pass comes back short: the first
          // run on a long-lived database can face millions of rows, and one
          // unbounded DELETE would hold a transaction open across all of them.
          for (;;) {
            const n = await this.audit.prune(env.AUDIT_RETENTION_DAYS, 10_000);
            total += n;
            if (n < 10_000 || this.stopped) break;
          }
          return total ? `deleted ${total} audit row(s)` : null;
        },
      },
      {
        // Probe captures are BIOMETRIC images, written on every check-in and
        // check-out. Holding them longer than the retention policy allows is a
        // liability, not a feature.
        name: 'prune-probes',
        everyMs: 24 * HOUR,
        run: async () => {
          let total = 0;
          for (;;) {
            const n = await this.storage.pruneProbes(env.PROBE_RETENTION_DAYS, 1_000);
            total += n;
            if (n < 1_000 || this.stopped) break;
          }
          return total ? `deleted ${total} expired probe image(s)` : null;
        },
      },
      {
        // NEW. Reports only — see StorageService.reconcile() for why it must
        // not be the thing that decides to delete a file.
        name: 'reconcile-attachments',
        everyMs: 24 * HOUR,
        run: async () => {
          const report = await this.storage.reconcile();
          const problems = Object.entries(report)
            .filter(([, r]) => r.missing > 0 || r.orphaned > 0)
            .map(([b, r]) => `${b}: ${r.missing} missing, ${r.orphaned} orphaned`);
          return problems.length ? problems.join('; ') : null;
        },
      },
    ];
  }

  onApplicationBootstrap(): void {
    if (!env.schedulerEnabled) {
      console.log('[scheduler] disabled (SCHEDULER_ENABLED=0)');
      return;
    }

    for (const job of this.jobs) {
      // Stagger the first run so six jobs do not all fire on the same tick at
      // boot, and so a restart loop does not hammer the database.
      const first = setTimeout(() => {
        void this.tick(job);
        const timer = setInterval(() => void this.tick(job), job.everyMs);
        // Never hold the process open for a timer. Without this a shutdown
        // waits out the longest interval.
        timer.unref();
        this.timers.push(timer);
      }, 10_000 + Math.floor(Math.random() * 20_000));
      first.unref();
      this.timers.push(first);
    }

    console.log(`[scheduler] ${this.jobs.length} job(s) scheduled`);
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
  }

  /**
   * One attempt at one job.
   *
   * `running` guards against a slow job overlapping itself in THIS process; the
   * advisory lock guards against another process running it at the same time.
   * Both are needed — the first is free and the second costs a round trip.
   */
  private async tick(job: Job): Promise<void> {
    if (this.stopped || this.running.has(job.name)) return;
    this.running.add(job.name);

    try {
      const started = Date.now();
      const note = await this.withJobLock(job.name, job.run);
      if (note) console.log(`[scheduler] ${job.name}: ${note} (${Date.now() - started}ms)`);
    } catch (err) {
      console.error(`[scheduler] ${job.name} failed`, err);
    } finally {
      this.running.delete(job.name);
    }
  }

  /**
   * Hold this job's lock for as long as it runs, or skip this tick.
   *
   * A plain setInterval in two instances runs everything twice, so each job is
   * claimed before it runs.
   *
   * The lock itself is AdvisoryLockService — it needs a pinned connection and
   * must not be in a transaction, and that file says why. Here it is just a
   * name: whoever takes it runs, everyone else skips and tries next tick.
   *
   * The jobs are all idempotent anyway — deletes bounded by age, and an UPDATE
   * that sets a status already-set rows do not match — so a double run would be
   * harmless. The lock keeps two instances from doing the same work twice, not
   * from being correct.
   */
  private async withJobLock(name: string, run: () => Promise<string | null>): Promise<string | null> {
    return this.locks.withLock(name, run);
  }
}
