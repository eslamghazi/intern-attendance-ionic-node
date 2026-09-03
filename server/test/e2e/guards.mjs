// The authorization model, checked as an invariant.
//
// Row-level security is off. That was a deliberate move — every rule the 54
// policies encoded is in domain/access with unit tests, and the whole suite was
// run against a database with RLS disabled to prove the API stood on its own
// before the policies were dropped.
//
// It also means the API is now the ONLY guard. A route registered without a
// preHandler is not "protected by a policy nobody read" any more; it is open.
// That is what part 1 is for, and it is the most important check in this file.
//
// Parts 2 and 3 cover what deliberately did NOT move into the API: coarse table
// and column privileges, which are cheap, hard to get wrong, and survive a
// route forgetting.
import { check, psql, report } from './harness.mjs';

const { readdirSync, readFileSync } = await import('node:fs');
const { join, dirname } = await import('node:path');
const { fileURLToPath } = await import('node:url');

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

/* ------------------------------------------------------------------ part 1 */

console.log('\n--- every route is guarded, or is public on purpose ---');

// Routes that answer without a session, each with the reason. Anything not
// here must carry requireAuth or requireRole.
const PUBLIC_ROUTES = new Map([
  ['GET /health', 'liveness probe'],
  ['GET /health/ready', 'readiness probe'],
  ['GET /time/now', 'the server clock, which the app needs before sign-in'],
  ['GET /settings/branding', 'org name and logo, shown on the sign-in screen'],
  ['GET /settings', 'returns null without a session; the client falls back to defaults'],
  ['POST /auth/login', 'the credential IS the request'],
  ['POST /auth/refresh', 'renews an access token that has usually just expired'],
  ['POST /auth/logout', 'a client with an expired access token must still be able to end its session'],
  ['GET /storage/:bucket/object', 'the URL signature is the credential; an <img> cannot send a header'],
  ['GET /storage/:bucket/url', 'answers {} for anything the caller may not see'],
  ['POST /storage/:bucket/urls', 'same, in a batch'],
]);

const ROUTE_RE =
  /app\.(get|post|patch|put|delete)\(\s*(?:`([^`]+)`|'([^']+)')([\s\S]{0,200}?)async\s*\(/g;

const unguarded = [];
let routeCount = 0;

for (const file of readdirSync(join(SRC, 'routes'))) {
  if (!file.endsWith('.ts')) continue;
  const src = readFileSync(join(SRC, 'routes', file), 'utf8');
  for (const m of src.matchAll(ROUTE_RE)) {
    const verb = m[1].toUpperCase();
    // Template paths are built from a `base` variable in catalog.ts; the guard
    // is what matters here, not the exact path.
    const path = (m[2] ?? m[3]).replace(/\$\{base\}/g, '<base>');
    const opts = m[4];
    routeCount++;

    // Three files name a guard once and reuse it — `readable`/`writable` in
    // catalog.ts, `adminOnly` in presence.ts, `auth` in reports.ts — so the
    // options position is a bare identifier rather than an inline object.
    //
    // Each is declared as `{ preHandler: app.require… }` at the top of its
    // file, which is checked below rather than assumed: a name that stops being
    // a guard must not keep passing as one.
    const NAMED_GUARDS = ['readable', 'writable', 'adminOnly', 'auth'];
    const guarded =
      /requireAuth|requireRole/.test(opts) ||
      NAMED_GUARDS.some((g) => new RegExp(`,\\s*${g}\\s*,`).test(opts));

    if (!guarded && !PUBLIC_ROUTES.has(`${verb} ${path}`)) {
      unguarded.push(`${verb} ${path}  (${file})`);
    }
  }
}

check('the scan found the routes', routeCount > 50, true);
for (const r of unguarded) console.log(`       ${r}`);
check(`all ${routeCount} routes are guarded or listed public`, unguarded.length, 0);

// The named guards above are only trustworthy if they are still guards. If
// someone redefines `readable` as something else, every route using it would
// keep passing silently — so the declarations are checked, not assumed.
const guardDecls = ['readable', 'writable', 'adminOnly', 'auth'];
const declared = [];
for (const file of readdirSync(join(SRC, 'routes'))) {
  if (!file.endsWith('.ts')) continue;
  const src = readFileSync(join(SRC, 'routes', file), 'utf8');
  for (const g of guardDecls) {
    const m = src.match(new RegExp(`const ${g}\\s*=\\s*\\{[^}]*\\}`));
    if (m) declared.push({ file, name: g, ok: /preHandler:\s*app\.require(Auth|Role)/.test(m[0]) });
  }
}
for (const d of declared.filter((x) => !x.ok)) {
  console.log(`       ${d.file}: \`${d.name}\` is used as a guard but does not set a preHandler`);
}
check('every named guard really sets a preHandler',
  declared.length > 0 && declared.every((d) => d.ok), true);

/* ------------------------------------------------------------------ part 2 */

console.log('\n--- RLS really is off, and nothing depends on it ---');

check('no policies remain', psql(`select count(*) from pg_policies where schemaname='public'`), '0');

// refresh_tokens keeps RLS on with no policies: belt and braces beside the
// revoke, so a future grant added without thinking still denies every row.
check('RLS is off except the one table that keeps it deliberately',
  psql(`select coalesce(string_agg(c.relname, ','), '(none)')
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
         where n.nspname='public' and c.relkind='r' and c.relrowsecurity`),
  'refresh_tokens');

// If one of these came back, something is reaching for the old model.
check('the RLS helper functions are gone',
  psql(`select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
         where n.nspname='public' and p.proname in
           ('is_admin','is_superadmin','admin_can_access','admin_branch_ids',
            'admin_group_ids','admin_has_assignments','current_app_role',
            'my_member_id','attachment_folder')`),
  '0');

/* ------------------------------------------------------------------ part 3 */

console.log('\n--- the grants that deliberately stayed in the database ---');

check('refresh_tokens: unreachable by a signed-in caller',
  psql(`select has_table_privilege('authenticated','public.refresh_tokens','SELECT')::text`), 'false');
check('app_settings: no table-wide select',
  psql(`select has_table_privilege('authenticated','public.app_settings','SELECT')::text`), 'false');
check('  readable columns granted',
  psql(`select has_column_privilege('authenticated','public.app_settings','org_name','SELECT')::text`), 'true');
check('  master_password_hash is not',
  psql(`select has_column_privilege('authenticated','public.app_settings','master_password_hash','SELECT')::text`), 'false');
check('audit_log: readable, never writable',
  psql(`select has_table_privilege('authenticated','public.audit_log','INSERT')::text`), 'false');

/* ------------------------------------------------------------------ part 4 */

console.log('\n--- anything acting for a caller scopes itself ---');

const NO_SCOPE_NEEDED = new Map([
  ['routes/settings.ts', 'reads a fixed public column list; writes are superadmin-only'],
  ['routes/storage.ts', 'admin-only route clearing image paths, which are not member ids'],
  ['services/authService.ts', 'staff accounts are faculty-wide; branch scope does not apply'],
  ['services/profileService.ts', "every statement is pinned to the caller's own id"],
  ['services/attendanceService.ts', "acts only on the caller's own membership"],
  ['routes/health.ts', 'reads the pool, touches no data'],
  ['routes/time.ts', "reads frozen_at for the caller's OWN member row"],
  ['db/context.ts', 'defines asService — a false positive by construction'],
  ['auth/plugin.ts', "reads the caller's OWN role by claims.sub; nothing caller-supplied"],
  ['storage/objects.ts', 'enforces domain/access/attachment.ts on every caller-supplied path'],
]);

const SCOPE_HELPER = /\b(require(Member|Branch|Unit|Filter)|scopeOf|coversUnit|mayTouchAttachment)\b/;

function walk(dir, prefix = '') {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(join(dir, entry.name), rel));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) out.push(rel);
  }
  return out;
}

const offenders = [];
let usingService = 0;
for (const rel of walk(SRC)) {
  const body = readFileSync(join(SRC, rel), 'utf8');
  if (!/\basService\s*\(/.test(body)) continue;
  usingService++;
  if (SCOPE_HELPER.test(body)) continue;
  if (NO_SCOPE_NEEDED.has(rel.replace(/\\/g, '/'))) continue;
  offenders.push(rel);
}

for (const f of offenders) console.log(`       ${f} uses asService with no scope check and no stated reason`);
check(`all ${usingService} files using asService either scope or say why not`, offenders.length, 0);

process.exit(report() ? 0 : 1);
