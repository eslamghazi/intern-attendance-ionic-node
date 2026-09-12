import { Inject, Injectable, type OnApplicationShutdown, type Provider } from '@nestjs/common';
import type pg from 'pg';
import { pool } from './pool.js';

/**
 * The connection pool, as an injectable.
 *
 * The pool is a module-level singleton — one per process is the only correct
 * number, and building it in a factory would not change that. What this token
 * changes is who is ALLOWED to reach it: the two places that genuinely need the
 * driver ask the container, and nothing else imports `db/pool.js` at all.
 *
 * That matters because "who can open a connection outside a transaction" is the
 * kind of thing that spreads quietly. A grep for PG_POOL now answers it.
 */
export const PG_POOL = Symbol('PG_POOL');

export const poolProvider: Provider = {
  provide: PG_POOL,
  useValue: pool,
};

/**
 * Closes the pool when Nest shuts down.
 *
 * A lifecycle hook rather than a `process.on('SIGTERM')` handler, because Nest
 * already sequences shutdown — controllers stop accepting, the scheduler clears
 * its timers — and the pool must close AFTER those, not alongside them. A bare
 * signal handler has no way to know when the rest of the application is done.
 *
 * `pool.end()` waits for checked-out clients to be released, so a job in flight
 * finishes rather than losing its connection underneath it.
 *
 * Requires `app.enableShutdownHooks()` in main.ts; without it Nest registers no
 * signal handler and no shutdown hook in the application ever fires.
 */
@Injectable()
export class PoolLifecycle implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.pool.end();
    } catch (err) {
      // Shutting down is not the moment to fail: the process is going away and
      // Postgres reclaims the backends regardless.
      console.error('[db] error while closing the pool', err);
    }
  }
}
