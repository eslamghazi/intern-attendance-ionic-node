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

/**
 * LOCAL MODE — the same suites, without containers.
 *
 * Docker is not available everywhere these need to run, and the suites are the
 * only place a good deal of this code is exercised at all. In local mode the
 * database is reached with a `psql` on PATH and the API is a process the runner
 * started, so everything below has two implementations and one contract. The
 * suites themselves cannot tell the difference and are unchanged.
 *
 *   E2E_LOCAL=1       use a local Postgres and a local API
 *   DATABASE_URL      how to reach it
 *   E2E_PSQL          path to psql, when it is not on PATH
 */
const LOCAL = process.env.E2E_LOCAL === '1';
const PSQL = process.env.E2E_PSQL || 'psql';
const DB_URL = process.env.DATABASE_URL || '';

if (LOCAL && !DB_URL) {
  throw new Error('E2E_LOCAL=1 needs DATABASE_URL');
}

/**
 * Restart the API in local mode.
 *
 * Registered by run.mjs, which owns the process — a suite runs as its own
 * process and cannot hold a handle on it. Left unset, reset() says so rather
 * than silently skipping the restart and letting the next suite inherit the
 * previous one's rate-limit budget.
 */
let localRestart = null;
export function onLocalRestart(fn) {
  localRestart = fn;
}

/**
 * The account every suite signs in as.
 *
 * There is no seed step any more: the API creates the first superadmin itself,
 * with a GENERATED password nobody can predict. So local mode sets a known one
 * with scripts/superadmin-password.mjs after starting the API and passes it
 * here — see run.mjs. Against the containers, export these yourself.
 */
export const SUPERADMIN = {
  nationalId: process.env.E2E_SUPERADMIN_ID || '30110281500753',
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
  return { status: res.status, body: unwrap(json) };
}

/**
 * Take the payload out of the success envelope, exactly as the client does.
 *
 * The API answers `{ ok: true, data: … }` and ClientApp/src/lib/api/http.ts
 * unwraps it before any screen sees it — so a suite reading the raw envelope is
 * testing a shape nothing in the product ever handles. Every assertion here was
 * written against the payload (`body.access_token`, not `body.data.access_token`)
 * and they read `undefined` until this was added.
 *
 * FAILURES ARE LEFT ALONE. The error envelope is `{ ok: false, error: … }`, the
 * client keeps it whole, and two suites assert on `body.error.code`.
 */
function unwrap(payload) {
  if (!payload || typeof payload !== 'object' || payload.ok !== true) return payload;

  // A page: the client offers the rows under every name a screen might ask for.
  if (typeof payload.total === 'number' && Array.isArray(payload.data)) {
    return {
      data: payload.data,
      items: payload.data,
      rows: payload.data,
      total: payload.total,
      meta: payload.meta,
    };
  }
  return payload.data !== undefined ? payload.data : payload;
}

export const login = (nationalId, password) =>
  call('POST', '/auth/login', { body: { national_id: nationalId, password } });

export const loginSuper = () => login(SUPERADMIN.nationalId, SUPERADMIN.password);

/**
 * Every page a superadmin can grant, with every operation.
 *
 * A freshly created admin holds NOTHING — PermissionsGuard refuses them every
 * staff route until a superadmin grants pages. The suites that test scoping
 * BY ASSIGNMENT (branch A vs branch B) need their admins past that gate, so
 * they grant everything here and let the assignment do the narrowing. Kept in
 * step with ADMIN_PAGES minus the two superadmin-only pages.
 */
export const ALL_GRANTABLE_PAGES = [
  'dashboard', 'groups', 'branches', 'members', 'rosters', 'review', 'audit',
  'presence', 'faceTest', 'faceImages', 'memberLookup', 'qr', 'shifts',
  'departments', 'settings',
];

export const grantAll = (suToken, adminId, full_name, national_id) =>
  call('PATCH', `/admins/${adminId}`, {
    token: suToken,
    body: {
      full_name,
      national_id,
      permissions: { pages: ALL_GRANTABLE_PAGES, ops: ['create', 'edit', 'delete', 'export'] },
    },
  });

/**
 * Run one statement against the database.
 *
 * Collapsed to a single line: the query is passed as one `-c` argument and a
 * newline inside it ends the statement early — which shows up as a syntax error
 * pointing at a line that looks perfectly fine.
 */
export function psql(query) {
  const sql = query.replace(/\s+/g, ' ').trim().replace(/"/g, '\\"');
  const cmd = LOCAL
    // `-d`, not a positional: psql stops parsing options at the first
    // positional argument, so `psql <url> -t -A -c <sql>` reads the URL as the
    // database, `-t` as the USERNAME, and warns that the rest was ignored —
    // then exits 0 having run nothing, which reads as an empty result.
    ? `"${PSQL}" -d "${DB_URL}" -t -A -c "${sql}"`
    : `docker compose ${COMPOSE} exec -T db psql -U attendance -d attendance -t -A -c "${sql}"`;
  return atRoot(cmd, { encoding: 'utf8' }).trim();
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
export async function reset() {
  psql(`delete from public.profiles where role <> 'superadmin'`);
  psql(`delete from public.refresh_tokens`);
  psql(`delete from public.audit_log`);
  psql(`update public.app_settings set master_password_hash = null where id = 1`);

  if (LOCAL) {
    if (!localRestart) throw new Error('local mode: no restarter registered — see onLocalRestart');
    await localRestart();
    await waitForHealth();
    return;
  }

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

/** Poll /health until the API answers, or give up after ~30s. */
export async function waitForHealth(tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${ORIGIN}/health`);
      if (res.ok) return;
    } catch {
      /* still starting */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`the API did not answer /health at ${ORIGIN}`);
}
