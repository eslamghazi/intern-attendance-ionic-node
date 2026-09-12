import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { PG_POOL } from './pool.provider.js';

/**
 * "Only one instance runs this at a time", as a Postgres advisory lock.
 *
 * WHY IT IS A SERVICE AND NOT A FUNCTION
 *
 * It takes the pool by injection (`PG_POOL`) rather than importing the
 * singleton, which makes it the ONE component in the API allowed to talk to the
 * driver — a grep for PG_POOL answers "who can open a raw connection?" — and
 * lets the scheduler be tested without a pool at all.
 *
 * WHY IT DOES NOT GO THROUGH DRIZZLE OR UnitOfWorkService
 *
 * `pg_try_advisory_lock` is not a query over data, it is a call into Postgres's
 * lock manager — no ORM models it (Drizzle no more than EF Core, where the same
 * job is done with a raw `sp_getapplock`). Two properties make the escape hatch
 * necessary rather than lazy:
 *
 *   * It must NOT run in a transaction. A transaction-scoped lock releases when
 *     its transaction commits, and a job spans several transactions plus file
 *     I/O — the lock would be gone before the work started and every instance
 *     would run everything anyway.
 *   * It must run on ONE pinned connection for the whole job. A session-level
 *     lock belongs to the session that took it, so acquire and release have to
 *     be the same backend. Anything that hands back a pooled connection between
 *     statements cannot promise that.
 *
 * So it takes a connection out of the pool and holds it. If the process dies
 * instead of releasing, Postgres drops the lock when the connection closes — a
 * crash mid-job cannot lock a job out permanently, which is exactly the failure
 * mode a lock TABLE would have had.
 *
 * Costs one pooled connection for the duration of a job.
 */
@Injectable()
export class AdvisoryLockService {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  /**
   * Run `work` holding the lock named `name`, or return null without running.
   *
   * Null means someone else holds it — a skipped tick, not an error.
   */
  async withLock<T>(name: string, work: () => Promise<T>): Promise<T | null> {
    const key = `job:${name}`;
    const client = await this.pool.connect();
    try {
      const held = await client.query<{ locked: boolean }>(
        'select pg_try_advisory_lock(hashtext($1)::bigint) as locked',
        [key],
      );
      if (!held.rows[0]?.locked) return null;

      try {
        return await work();
      } finally {
        await client
          .query('select pg_advisory_unlock(hashtext($1)::bigint)', [key])
          .catch(() => {}); // the connection is about to be discarded anyway
      }
    } finally {
      client.release();
    }
  }

  /**
   * The same, but WAIT for the lock instead of skipping.
   *
   * `withLock` is built for scheduled work, where somebody else already doing
   * it means this tick has nothing to do. Start-up migrations are the opposite:
   * a replica that skipped would go on to serve requests against a schema the
   * holder has not finished applying. Here the second replica must stand still
   * until the first is done, and `pg_advisory_lock` — no `try_` — is Postgres
   * doing that waiting for us.
   *
   * Same session rules as above: one pinned connection, released on the way
   * out, and dropped by Postgres if the process dies holding it.
   */
  async withLockBlocking<T>(name: string, work: () => Promise<T>): Promise<T> {
    const key = `job:${name}`;
    const client = await this.pool.connect();
    try {
      await client.query('select pg_advisory_lock(hashtext($1)::bigint)', [key]);
      try {
        return await work();
      } finally {
        await client
          .query('select pg_advisory_unlock(hashtext($1)::bigint)', [key])
          .catch(() => {});
      }
    } finally {
      client.release();
    }
  }
}
