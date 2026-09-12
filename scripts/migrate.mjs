// Migration runner.
//
//   db/migrations/*.sql   applied ONCE each, in order, checksummed.
//
// That is the whole of it, because the database owns nothing but its schema: no
// functions, no triggers, no scheduled jobs, no policies. Every one of those is
// application code under test, so there is no second category of thing to apply
// and no re-apply pass to sequence against the migrations.
//
// AN ORDINARY ROLE AND AN EMPTY DATABASE ARE THE WHOLE PREREQUISITE. The schema
// needs no extensions, so there is no superuser step before this and none after
// it. If a statement here ever needs more rights than the role that owns the
// schema, the statement is wrong — not the role.
//
// Applied files are tracked in public._migrations WITH A CHECKSUM, so one
// cannot be edited underneath a deployed environment: the next run refuses
// rather than silently leaving two environments with different schemas.
//
// A failure names the file, the line, the statement and the whole Postgres
// error (see report() below). Anything less turns a five-minute fix into an
// afternoon.
//
//   node scripts/migrate.mjs [--status] [--dry-run]
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';
import {
  applyPending,
  connect,
  ensureLedger,
  lineOf,
  pending,
  SqlFileError,
  status,
} from './lib/migrator.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(ROOT, 'db', 'migrations');

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);

/**
 * Everything known about a failure, in the order someone debugging wants it:
 * where it happened, what was sent, and what Postgres actually said.
 */
function report(err, sourceOf) {
  const out = ['', '─'.repeat(72), '[migrate] FAILED', ''];

  const pg = err instanceof SqlFileError ? err.cause : err;
  const inFile = err instanceof SqlFileError;

  if (inFile) {
    // err.offset locates the statement in the file; pg.position (1-based, in
    // BYTES of the statement) locates the error inside the statement. Adding
    // them gives the line that actually failed rather than the line the
    // statement began on — usually many lines apart in a DO block.
    const body = sourceOf?.(err.file);
    const within = Number(pg?.position) > 0 ? Number(pg.position) - 1 : 0;
    const line = body ? lineOf(body, err.offset + within) : null;

    out.push(`  file       ${err.file}${line ? `:${line}` : ''}`);
    if (line && within) out.push(`  statement  begins at line ${lineOf(body, err.offset)}`);
  }

  if (pg?.code) out.push(`  sqlstate   ${pg.code}`);
  if (pg?.severity) out.push(`  severity   ${pg.severity}`);
  out.push('', '  message');
  out.push(...String(pg?.message ?? err.message ?? err).split('\n').map((l) => `    ${l}`));

  for (const [label, value] of [
    ['detail', pg?.detail],
    ['hint', pg?.hint],
    ['where', pg?.where],
    ['schema', pg?.schema],
    ['table', pg?.table],
    ['column', pg?.column],
    ['constraint', pg?.constraint],
  ]) {
    if (!value) continue;
    out.push('', `  ${label}`);
    out.push(...String(value).split('\n').map((l) => `    ${l}`));
  }

  if (inFile) {
    // The whole statement, not an excerpt. It is the thing to paste into psql,
    // and truncating it is exactly what made the old output useless.
    out.push('', '  statement');
    out.push(...err.statement.split('\n').map((l) => `    ${l}`));
  }

  const extra = hint(String(pg?.message ?? ''));
  if (extra) out.push(extra);

  out.push('─'.repeat(72), '');
  console.error(out.join('\n'));
}

function hint(message) {
  if (/password authentication failed/i.test(message)) {
    return [
      "",
      "Hint: Postgres applies POSTGRES_PASSWORD only when it FIRST initialises",
      "      its data directory. An existing volume keeps the password it was",
      "      created with, so changing POSTGRES_PASSWORD in .env afterwards",
      "      locks you out of your own database: the value in .env and the one",
      "      in the volume have simply diverged.",
      "",
      "      If the database is still empty, start it over:",
      "        docker compose down",
      "        docker volume rm intern-attendance_db-data",
      "",
      "      If it holds real data, change the password IN the database:",
      "        docker compose exec db psql -U attendance -d attendance \\",
      "          -c \"alter role attendance with password 'the-new-one'\"",
    ].join('\n');
  }

  if (/extension|shared_preload_libraries/i.test(message)) {
    return (
      '\n  see also\n' +
      '    This schema needs NO Postgres extensions. If a statement here is asking\n' +
      '    for one, it came from a migration generated against an older model —\n' +
      '    regenerate it (npm run db:generate) rather than installing anything.'
    );
  }
  return '';
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[migrate] DATABASE_URL is not set (copy .env.example to .env)');
    process.exit(1);
  }

  // Bounded retry. This runs as a container that starts the moment the database
  // reports healthy, and "healthy" and "accepting TCP connections" are not quite
  // the same instant — the entry point's initialisation server listens on the
  // unix socket only. Waiting a few seconds here is better than a failed deploy.
  let client;
  try {
    client = await connect({
      url: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === '1',
      // Surfaces any RAISE NOTICE a migration emits. node-postgres swallows them
      // silently otherwise, so a file that reported why it skipped something
      // would look as though it had done nothing at all.
      onNotice: (message) => console.log(`      note: ${message}`),
    });
  } catch (err) {
    console.error(`[migrate] ${err.message}`);
    process.exit(1);
  }

  await ensureLedger(client);

  if (flag('status')) {
    const { names, applied } = await status(client, MIGRATIONS);
    const done = new Set(applied);
    for (const n of names) console.log(`  ${done.has(n) ? 'applied' : 'pending'}  ${n}`);
    console.log(`
${applied.length}/${names.length} applied`);
    await client.end();
    return;
  }

  // A DATABASE THIS RUNNER HAS NOT SEEN BEFORE IS TREATED AS AN EMPTY ONE.
  //
  // There is deliberately no "adopt what is already there" mode. If this is
  // pointed at a populated database it did not build, the first CREATE TABLE
  // fails with `already exists` — which is the correct answer, not a case to
  // handle: it is not this application's database.

  try {
    if (flag('dry-run')) {
      const names = await pending(client, MIGRATIONS);
      for (const name of names) console.log(`  would apply  ${name}`);
      console.log(`
[migrate] ${names.length} pending.`);
      return;
    }

    const ran = await applyPending(client, MIGRATIONS, {
      onStart: (name) => process.stdout.write(`  applying  ${name} ... `),
      onDone: () => console.log('ok'),
    });

    console.log(`
[migrate] ${ran.length} migration(s) applied.`);
  } catch (err) {
    console.log('FAILED');
    // Re-read the file to turn a character offset into a line number. Cheap,
    // and it keeps the happy path from carrying every file body around.
    report(err, (rel) => {
      try {
        return readFileSync(join(ROOT, rel), 'utf8');
      } catch {
        return null;
      }
    });
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
