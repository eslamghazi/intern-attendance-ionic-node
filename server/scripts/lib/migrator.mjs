// The migration runner, with no opinion about who is asking.
//
// ONE IMPLEMENTATION, TWO CALLERS. `scripts/migrate.mjs` is the CLI over this,
// and MigrationService runs it at start-up so a deployment applies its own
// pending migrations. They were never allowed to be two copies: the checksum
// rule, the statement splitting and the ledger are the parts that must not
// differ between "what CI ran" and "what the server did on boot".
//
// Nothing here calls process.exit or prints a report. It throws, and the caller
// decides whether that ends a command or refuses a boot.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { Umzug } from 'umzug';
import pg from 'pg';

const sqlFiles = (dir) =>
  existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.sql')).sort() : [];

const sha = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16);

/** Umzug storage backed by public._migrations. */
function pgStorage(client, pathOf) {
  return {
    async logMigration({ name }) {
      await client.query(
        `insert into public._migrations (id, checksum) values ($1, $2)
         on conflict (id) do update set checksum = excluded.checksum, applied_at = now()`,
        [name, sha(readFileSync(pathOf(name), 'utf8'))],
      );
    },
    async unlogMigration({ name }) {
      await client.query('delete from public._migrations where id = $1', [name]);
    },
    async executed() {
      const { rows } = await client.query(
        'select id from public._migrations order by applied_at',
      );
      return rows.map((r) => r.id);
    },
  };
}

/**
 * A failure with enough on it to act on: which file, which statement, where in
 * the file that statement starts, and everything Postgres said.
 *
 * The runner used to print one line of message on failure. When
 * the message is `permission denied for schema cron` and the file is 200 lines
 * of DO blocks, that is the beginning of a guessing game rather than the end of
 * one.
 */
class SqlFileError extends Error {
  constructor(file, statement, offset, cause) {
    super(cause.message);
    this.name = 'SqlFileError';
    this.file = file;
    this.statement = statement;
    this.offset = offset;
    this.cause = cause;
  }
}

/** 1-based line number of a character offset. */
const lineOf = (text, offset) => text.slice(0, offset).split('\n').length;

/**
 * Split on drizzle's `--> statement-breakpoint`, keeping each statement's
 * character offset in the file so a failure can be reported at the right line.
 *
 * Some statements (CREATE INDEX CONCURRENTLY, ALTER TYPE ... ADD VALUE) cannot
 * share a transaction, which is why drizzle emits the marker at all; honour it
 * rather than sending the file whole.
 */
function splitStatements(body) {
  const MARKER = '--> statement-breakpoint';
  if (!body.includes(MARKER)) return [{ sql: body, offset: 0 }];

  const out = [];
  let cursor = 0;
  for (const chunk of body.split(MARKER)) {
    const leading = chunk.length - chunk.trimStart().length;
    const sql = chunk.trim();
    if (sql) out.push({ sql, offset: cursor + leading });
    cursor += chunk.length + MARKER.length;
  }
  return out;
}

/** Apply one .sql file, attributing any failure to a statement and a line. */
async function applyFile(client, body, { transactional = true, file = '<sql>' } = {}) {
  const statements = splitStatements(body);
  const noTx = !transactional || /^\s*--\s*migrate:no-transaction\s*$/im.test(body);

  if (!noTx) await client.query('begin');
  try {
    for (const { sql, offset } of statements) {
      try {
        await client.query(sql);
      } catch (err) {
        throw new SqlFileError(file, sql, offset, err);
      }
    }
    if (!noTx) await client.query('commit');
  } catch (err) {
    if (!noTx) await client.query('rollback').catch(() => {});
    throw err;
  }
}

/**
 * Connect, with a bounded retry.
 *
 * A FRESH CLIENT PER ATTEMPT. node-postgres clients are single-use: once a
 * connect() has failed, the same object refuses every later attempt with
 * "Client has already been connected." Retrying on one client meant the loop
 * never retried anything.
 */
export async function connect({ url, ssl = false, timeoutMs = 60_000, onNotice } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  for (;;) {
    const client = new pg.Client({
      connectionString: url,
      ssl: ssl ? { rejectUnauthorized: false } : undefined,
    });
    try {
      await client.connect();
      if (onNotice) {
        client.on('notice', (n) => {
          if (n.message) onNotice(n.message);
        });
      }
      return client;
    } catch (err) {
      lastError = err;
      await client.end().catch(() => {});
      if (Date.now() > deadline) {
        throw new Error(`could not connect within ${Math.round(timeoutMs / 1000)}s: ${lastError.message}`);
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

/** The ledger this runner keeps. Safe to call on every start. */
export async function ensureLedger(client) {
  await client.query(`
    create table if not exists public._migrations (
      id         text primary key,
      checksum   text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

/** The .sql files on disk, in order, and how to read one. */
export function migrationFiles(dir) {
  const names = sqlFiles(dir);
  return { names, pathOf: (name) => join(dir, name) };
}

/**
 * Refuse a file that changed after it was applied.
 *
 * Editing an applied migration silently desynchronises environments: the
 * database that ran the old text and the one that will run the new text both
 * report the same migration as done.
 */
export function verifyChecksums(applied, names, pathOf) {
  for (const rec of applied) {
    if (!names.includes(rec.id)) continue;
    if (sha(readFileSync(pathOf(rec.id), 'utf8')) !== rec.checksum) {
      throw new Error(
        `${rec.id} changed after it was applied. ` +
          `Change the models and generate a NEW migration instead.`,
      );
    }
  }
}

/** Which files are on disk but not in the ledger. */
export async function status(client, dir) {
  const { names } = migrationFiles(dir);
  const { rows } = await client.query('select id from public._migrations');
  const done = new Set(rows.map((r) => r.id));
  return {
    names,
    applied: names.filter((n) => done.has(n)),
    pending: names.filter((n) => !done.has(n)),
  };
}

/**
 * Apply everything pending. Returns the names it ran, in order.
 *
 * `hooks.onStart` / `hooks.onDone` are how a caller narrates progress without
 * this module owning a console.
 */
export async function applyPending(client, dir, hooks = {}) {
  const { names, pathOf } = migrationFiles(dir);

  const { rows: applied } = await client.query('select id, checksum from public._migrations');
  verifyChecksums(applied, names, pathOf);

  const umzug = new Umzug({
    migrations: names.map((name) => ({
      name,
      up: () =>
        applyFile(client, readFileSync(pathOf(name), 'utf8'), {
          file: `db/migrations/${name}`,
        }),
      down: async () => {
        throw new Error(`${name} has no down migration — restore from a backup`);
      },
    })),
    context: {},
    storage: pgStorage(client, pathOf),
    logger: undefined,
  });

  if (hooks.onStart) umzug.on('migrating', ({ name }) => hooks.onStart(name));
  if (hooks.onDone) umzug.on('migrated', ({ name }) => hooks.onDone(name));

  const ran = await umzug.up();
  return ran.map((m) => m.name);
}

/** The pending list, without applying anything. */
export async function pending(client, dir) {
  return (await status(client, dir)).pending;
}

export { SqlFileError, lineOf, splitStatements, sha };
