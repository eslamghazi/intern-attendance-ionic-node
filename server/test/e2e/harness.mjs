// Shared plumbing for the end-to-end suites.
//
// These run against a REAL stack — the containers, the database, the nginx in
// front of it — because that is where the interesting failures were. Every bug
// these caught was invisible to the unit tests and to reading the code:
//
//   * signed image URLs pointed at a route that did not exist;
//   * every Postgres error came back as 500 because drizzle wraps it;
//   * revoking a stolen token family was rolled back by the throw that followed;
//   * six admin endpoints ran as the service role with no scope check.
//
// Run them against the production compose too, not just the dev one. In
// production the API publishes no port at all and everything arrives through
// nginx, so a suite pointed at :8787 tests a path production does not use:
//
//   npm run test:e2e                       dev stack   (api on :8787)
//   npm run test:e2e:prod                  prod stack  (through nginx on :8080)
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The repository root — where the compose files live.
 *
 * Every `docker compose` call below runs from here rather than from wherever
 * the suite was launched. The `-f docker-compose.yml` flags are relative, so
 * without this the whole suite depends on the caller's directory: `npm run
 * test:e2e:prod` sets the cwd to `server/`, which has no compose file, and
 * every suite fails at `reset()` with "cannot find the file specified" — a
 * message that says nothing about what is actually wrong.
 */
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

/** Run a command from the repo root, whatever the caller's directory is. */
const atRoot = (cmd, opts = {}) => execSync(cmd, { cwd: REPO_ROOT, ...opts });

/** Where the API is. Set API_BASE to test through nginx instead. */
export const BASE = process.env.API_BASE || 'http://127.0.0.1:8787/api/v1';

/** The origin, for the signed image URLs — they are relative to the API root. */
export const ORIGIN = new URL(BASE).origin;

/**
 * Which compose files to address. The prod overlay closes the database port, so
 * `docker compose exec db` needs the same flags the stack was started with or
 * it talks to a container it cannot find.
 */
const COMPOSE =
  process.env.COMPOSE_FILES ||
  (process.env.API_BASE?.includes(':8080')
    ? '-f docker-compose.yml -f docker-compose.prod.yml'
    : '');

export const SUPERADMIN = {
  nationalId: process.env.E2E_SUPERADMIN_ID || '29001011234567',
  password: process.env.E2E_SUPERADMIN_PW || 'SuperTest!2026',
};

let pass = 0;
let fail = 0;

export function check(label, actual, expected) {
  const ok = actual === expected;
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}  (got ${actual}, want ${expected})`);
  return ok;
}

export function section(title) {
  console.log(`\n--- ${title} ---`);
}

/** Exit code and totals for the runner. */
export function results() {
  return { pass, fail };
}

export function report() {
  console.log(`\n${pass} passed, ${fail} failed\n`);
  return fail === 0;
}

/**
 * One HTTP call.
 *
 * `content-type` is set ONLY when there is a body. Fastify rejects an empty
 * body that claims to be JSON at the parsing stage — before preHandler — so a
 * DELETE carrying the header returns 400 whatever the caller's role is. The
 * real client gets this right (ClientApp/src/lib/api/http.ts); the first
 * version of this harness did not, and read the 400 as a broken route.
 */
export async function call(method, path, { token, body, raw } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (raw) {
    return { status: res.status, bytes: Buffer.from(await res.arrayBuffer()), headers: res.headers };
  }
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json };
}

export const login = (nationalId, password) =>
  call('POST', '/auth/login', { body: { national_id: nationalId, password } });

export const loginSuper = () => login(SUPERADMIN.nationalId, SUPERADMIN.password);

/**
 * Run one statement against the database.
 *
 * Collapsed to a single line: the query is passed as one `-c` argument and a
 * newline inside it ends the statement early — which shows up as a syntax error
 * pointing at a line that looks perfectly fine.
 */
export function psql(query) {
  const sql = query.replace(/\s+/g, ' ').trim().replace(/"/g, '\\"');
  return atRoot(
    `docker compose ${COMPOSE} exec -T db psql -U attendance -d attendance -t -A -c "${sql}"`,
    { encoding: 'utf8' },
  ).trim();
}

/**
 * Put the database back to "one superadmin and nothing else", and restart the
 * API.
 *
 * The restart is not tidiness: the sign-in rate limiter is in-memory and allows
 * ten attempts a minute per national id. A suite signs in far more often than
 * that, so without this the next suite starts against a 429 and every check
 * fails for a reason that has nothing to do with what it is testing.
 */
export function reset() {
  psql(`delete from public.profiles where role <> 'superadmin'`);
  psql(`delete from public.refresh_tokens`);
  psql(`delete from public.audit_log`);
  psql(`update public.app_settings set master_password_hash = null where id = 1`);
  atRoot(`docker compose ${COMPOSE} restart api`, { stdio: 'pipe' });

  for (let i = 0; i < 30; i++) {
    try {
      atRoot(
        `docker compose ${COMPOSE} exec -T api node -e ` +
          `"fetch('http://127.0.0.1:8787/health').then(r=>{if(!r.ok)process.exit(1)})"`,
        { stdio: 'pipe' },
      );
      return;
    } catch {
      /* still starting */
    }
  }
  throw new Error('the API did not come back after a restart');
}
