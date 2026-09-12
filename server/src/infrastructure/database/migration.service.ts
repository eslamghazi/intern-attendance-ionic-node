import { Inject, Injectable } from '@nestjs/common';
import type pg from 'pg';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../../config/env.js';
import { PG_POOL } from './pool.provider.js';
import { AdvisoryLockService } from './advisory-lock.service.js';
// The same runner `npm run migrate` uses. Not a second implementation: the
// checksum rule, the statement splitting and the ledger have to be identical
// between what CI applied and what a server does to itself on boot, or the two
// disagree about which migrations a database has had.
import { applyPending, ensureLedger, status } from '../../../scripts/lib/migrator.mjs';

/**
 * `src/` at compile time, `dist/` at run time — both are one level under the
 * server root, so the same relative path reaches scripts/ from either.
 */
const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../../db/migrations');

/**
 * Bring the schema up to date before the API serves anything.
 *
 * WHY THE APP AND NOT ONLY THE CLI
 *
 * A deployment that starts the server without running `npm run migrate` first
 * serves against whatever schema happens to be there — which fails as a column
 * that does not exist, several requests later, rather than at the moment the
 * mistake was made. Applying pending migrations at start-up makes "the code is
 * deployed" and "the schema matches it" one event instead of two.
 *
 * WHY IT BLOCKS RATHER THAN SKIPS
 *
 * AdvisoryLockService.withLock returns null when someone else holds the lock,
 * which is right for a scheduled job: the tick is skipped and the next one
 * comes round. It is wrong here. A second replica that skipped would carry on
 * and start SERVING against a schema the first replica has not finished
 * migrating. So this waits for the lock instead, and Postgres does the waiting.
 *
 * WHY A FAILURE STOPS THE PROCESS
 *
 * Unlike the settings row, which is an invariant worth retrying, a half-applied
 * schema is not something to serve traffic on. The error is rethrown and Nest
 * refuses to start, which is the loudest and cheapest place to find out.
 */
@Injectable()
export class MigrationService {
  constructor(
    @Inject(PG_POOL) private readonly pool: pg.Pool,
    private readonly locks: AdvisoryLockService,
  ) {}

  async run(): Promise<void> {
    if (env.AUTO_MIGRATE !== '1') {
      console.log('[migrate] skipped (AUTO_MIGRATE=0)');
      return;
    }

    await this.locks.withLockBlocking('schema-migrations', async () => {
      // A missing directory is NOT "nothing to do". sqlFiles() answers [] for a
      // path that does not exist, so without this the service would announce
      // that the schema is up to date on an image that simply forgot to ship
      // db/ — which is exactly what the API image did before this existed.
      if (!existsSync(MIGRATIONS_DIR)) {
        throw new Error(
          `no migrations directory at ${MIGRATIONS_DIR} — the deployment is missing db/`,
        );
      }

      const client = await this.pool.connect();
      try {
        await ensureLedger(client);

        const { pending } = await status(client, MIGRATIONS_DIR);
        if (!pending.length) {
          console.log('[migrate] schema is up to date');
          return;
        }

        console.log(`[migrate] ${pending.length} pending`);
        const ran = await applyPending(client, MIGRATIONS_DIR, {
          onStart: (name: string) => process.stdout.write(`  applying  ${name} ... `),
          onDone: () => console.log('ok'),
        });
        console.log(`[migrate] ${ran.length} migration(s) applied`);
      } catch (err) {
        console.error(
          `\n[migrate] FAILED — refusing to start against a half-applied schema.\n` +
            `          ${err instanceof Error ? err.message : String(err)}\n` +
            `          Run \`npm run migrate\` to see the statement and the line.`,
        );
        throw err;
      } finally {
        client.release();
      }
    });
  }
}
