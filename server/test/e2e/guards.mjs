// The authorization model, checked as an invariant.
//
// THE API IS THE ONLY GUARD. It connects as one role that owns the schema, so
// the database restrains nothing: a route reachable without a check is open, not
// "covered by a policy nobody read".
//
// Part 1 is therefore the most important check in this file — every route is
// guarded, or listed as public on purpose.
//
// Parts 2 and 3 assert the other half of that claim: that the database really
// does hold no second layer. Not because a second layer would be unsafe, but
// because a HALF one is — a policy or a grant that filters some queries and not
// others makes the API's own checks look correct while the real rule lives
// somewhere no test reads.
import { check, psql, report } from './harness.mjs';

const { readdirSync, readFileSync } = await import('node:fs');
const { join, dirname } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

/* ------------------------------------------------------------------ part 1 */

console.log('\n--- every route is guarded, or is public on purpose ---');

// HOW PROTECTION WORKS HERE
//
// AuthGuard and RolesGuard are registered as APP_GUARD in app.module.ts, so
// they run on EVERY route. A route is protected unless it opts out with
// `@Public()`. That inverts what this check has to do: it is not "find the
// route that forgot a guard", it is "find the route that opted out without
// anyone noticing".
//
// THIS CHECK WAS DEAD. It used to scan `src/routes/` for Fastify registrations
// and assert each carried a preHandler. That directory stopped existing when
// the API moved to NestJS modules — so readdirSync threw, and the most
// important assertion in this file had not run since. It is written against the
// structure that exists now, and the guard-registration check below fails
// loudly if that structure moves again.

const MODULES = join(SRC, 'modules');

// Routes that answer without a session, each with the reason.
const PUBLIC_ROUTES = new Map([
  ['GET /health', 'liveness probe'],
  ['GET /health/ready', 'readiness probe'],
  ['GET /api/v1/health', 'the same probe under the API prefix'],
  ['GET /api/v1/health/ready', 'the same probe under the API prefix'],
  ['GET /api/v1/time/now', 'the server clock, which the app needs before sign-in'],
  ['GET /api/v1/settings', 'returns null without a session; the client falls back to defaults'],
  ['GET /api/v1/settings/branding', 'org name and logo, shown on the sign-in screen'],
  ['GET /api/v1/settings/branding/logo.png', 'the logo as an image, for a link-preview crawler that has no token'],
  ['POST /api/v1/auth/login', 'the credential IS the request'],
  ['POST /api/v1/auth/refresh', 'renews an access token that has usually just expired'],
  ['POST /api/v1/auth/logout', 'a client with an expired access token must still be able to end its session'],
  ['GET /api/v1/storage/:kind/object', 'the URL signature is the credential; an <img> cannot send a header'],
  ['GET /api/v1/storage/:kind/url', 'answers {} for anything the caller may not see'],
  ['POST /api/v1/storage/:kind/urls', 'same, in a batch'],
]);

// The whole model rests on the two guards being global. If that registration
// ever goes, every route silently becomes public and the scan below would still
// pass — so it is checked first and on its own.
const appModule = readFileSync(join(SRC, 'app.module.ts'), 'utf8');
check('AuthGuard is registered globally', /APP_GUARD[\s\S]{0,80}AuthGuard/.test(appModule), true);
check('RolesGuard is registered globally', /APP_GUARD[\s\S]{0,80}RolesGuard/.test(appModule), true);

function controllers(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...controllers(full));
    else if (entry.name.endsWith('.controller.ts')) out.push(full);
  }
  return out;
}

const ROUTE_RE = /@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)')?\s*\)/g;

const found = [];
for (const file of controllers(MODULES)) {
  const src = readFileSync(file, 'utf8');
  const base = (src.match(/@Controller\(\s*'([^']*)'\s*\)/) ?? [])[1] ?? '';

  let previousEnd = 0;
  for (const m of src.matchAll(ROUTE_RE)) {
    // Everything between the previous route and this one holds this route's own
    // decorators — which is where @Public() would be.
    const decorators = src.slice(previousEnd, m.index);
    previousEnd = m.index + m[0].length;

    const segment = m[2] ?? '';
    const path = '/' + [base, segment].filter(Boolean).join('/');
    found.push({
      key: `${m[1].toUpperCase()} ${path}`,
      isPublic: /@Public\(\)/.test(decorators),
      file: file.slice(file.indexOf('modules')),
    });
  }
}

check('the scan found the routes', found.length > 50, true);

// A route that opted out of the guard without being listed here.
const undeclared = found.filter((r) => r.isPublic && !PUBLIC_ROUTES.has(r.key));
for (const r of undeclared) console.log(`       ${r.key}  (${r.file})  @Public() with no stated reason`);
check(`all ${found.filter((r) => r.isPublic).length} public routes are listed with a reason`,
  undeclared.length, 0);

// A listing that no longer matches a route — the list rotting the other way.
const live = new Set(found.filter((r) => r.isPublic).map((r) => r.key));
const stale = [...PUBLIC_ROUTES.keys()].filter((k) => !live.has(k));
for (const k of stale) console.log(`       ${k} is listed public but no @Public() route matches it`);
check('no stale entries in the public list', stale.length, 0);

/* ------------------------------------------------------------------ part 2 */

console.log('\n--- the database holds no rules of its own ---');

check('no row policies', psql(`select count(*) from pg_policies where schemaname='public'`), '0');

// With no exceptions, deliberately. One table living under a rule the other
// eighteen are exempt from is worse than none: it reads as protection while
// covering a single query path.
check('no table enforces its own row filtering',
  psql(`select coalesce(string_agg(c.relname, ','), '(none)')
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relkind='r' and c.relrowsecurity`),
  '(none)');

// The schema is tables, indexes, constraints, enums and one view — nothing that
// executes. A function in `public` is application logic in a place no test
// reaches and no type describes, which is the thing this project keeps out.
check('the database owns no functions',
  psql(`select coalesce(string_agg(p.proname, ','), '(none)')
          from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public'`),
  '(none)');

check('and no triggers',
  psql(`select count(*) from pg_trigger t
          join pg_class c on c.oid = t.tgrelid
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname='public' and not t.tgisinternal`),
  '0');

/* ------------------------------------------------------------------ part 3 */

console.log('\n--- only the owning role can reach the tables ---');

// ONE role connects, and it owns the schema. Any OTHER grantee is a second way
// in that nothing in the API knows about — a role nobody uses is untidy, a role
// that still holds SELECT on `members` is a way to read the whole directory
// without passing a single guard.

check('no role but the owner holds table privileges',
  psql(`select coalesce(string_agg(distinct grantee, ','), '(none)')
          from information_schema.role_table_grants
         where table_schema = 'public'
           and grantee not in (current_user, 'PUBLIC')`),
  '(none)');

check('  and no default privilege will hand one any',
  psql(`select count(*) from pg_default_acl d
          join pg_namespace n on n.oid = d.defaclnamespace
         where n.nspname = 'public'
           and array_length(d.defaclacl, 1) > 0`),
  '0');

// The guarantee those grants existed to provide, kept somewhere a role change
// cannot reach: the query never asks for the column in the first place. The
// only mention left in the file is the comment explaining why.
check('the settings read never selects master_password_hash',
  /master_password_hash|masterPasswordHash/.test(
    readFileSync(join(SRC, 'modules', 'settings', 'settings.repository.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^[ \t]*\/\/.*$/gm, ''),
  ),
  false);

// Nothing may make the DATABASE's answer depend on who is asking. A per-request
// `SET ROLE`, or the JWT published into a session setting, would do exactly that
// — and would move authorization back out of the guards without any route
// changing, which is the kind of drift no route test would catch.
{
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.ts')) {
        const body = readFileSync(full, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^[ \t]*\/\/.*$/gm, '');
        if (/set_config\s*\(\s*['"`](role|request\.jwt\.claims)/i.test(body)) offenders.push(full);
        if (/\bset\s+(local\s+)?role\b/i.test(body)) offenders.push(full);
      }
    }
  };
  walk(SRC);
  for (const f of offenders) console.log(`       ${f}`);
  check('nothing in the API switches role or publishes JWT claims to the session',
    offenders.length, 0);
}

/* ------------------------------------------------------------------ part 4 */

console.log('\n--- every service that takes a caller scopes what it does ---');

// A service method that RECEIVES a `caller` is acting on someone's behalf, so
// either it applies a scope helper or it says here why it does not need one.
//
// THE PROBE MUST MATCH SOMETHING. A predicate that no file satisfies makes this
// check pass vacuously and report an invariant it never tested — which is worse
// than no check at all, because the line in the output says it passed. The
// assertion below therefore fails if the scan finds too few services, and the
// KEYS are paths: if this starts failing after a rename, fix the key rather than
// adding a file to quiet it.
const NO_SCOPE_NEEDED = new Map([
  ['modules/auth/auth.service.ts', 'staff accounts are faculty-wide; branch scope does not apply'],
  ['modules/profile/profile.service.ts', "every statement is pinned to the caller's own id"],
  ['modules/storage/storage.service.ts', 'staff-only deletes and maintenance; paths are not member ids'],
  ['modules/time/time.service.ts', "reads frozen_at for the caller's OWN member row"],
  ['modules/superadmin/superadmin.service.ts',
    'superadmin accounts are faculty-wide, and every route is superadmin-only; '
    + 'the caller is used for the audit trail and to refuse overwriting yourself'],
  ['modules/admins/admins.service.ts',
    'staff accounts are faculty-wide; the caller is used only to leave their '
    + 'own account out of the list they manage'],
]);

const SCOPE_HELPER =
  /\b(require(SelfOr)?(Member|Branch|Unit|Filter)|scopeOf|coversUnit|mayTouchAttachment)\b/;
const TAKES_CALLER = /\bcaller!?\s*:\s*Caller\b/;

function walk(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel));
    else if (entry.name.endsWith('.service.ts') && !entry.name.endsWith('.spec.ts')) out.push(rel);
  }
  return out;
}

const offenders = [];
let takingCaller = 0;
for (const rel of walk(SRC)) {
  const key = rel.replace(/\\/g, '/');
  if (key === 'common/auth/access.service.ts') continue; // defines the helpers
  const body = readFileSync(join(SRC, rel), 'utf8');
  if (!TAKES_CALLER.test(body)) continue;
  takingCaller++;
  if (SCOPE_HELPER.test(body)) continue;
  if (NO_SCOPE_NEEDED.has(key)) continue;
  offenders.push(key);
}

check('the scan actually found the services', takingCaller >= 10, true);
for (const f of offenders) console.log(`       ${f} takes a caller, scopes nothing, gives no reason`);
check(`all ${takingCaller} services taking a caller either scope or say why not`, offenders.length, 0);

process.exit(report() ? 0 : 1);
