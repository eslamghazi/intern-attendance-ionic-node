# Node API — the Supabase replacement

Replaces PostgREST, GoTrue, Storage and the 17 Edge Functions. **It does not
replace Postgres.** The schema, its 36 SQL functions and its 51 RLS policies are
carried over untouched, because they are the tested, working authorization
model — reimplementing them in TypeScript is the single most dangerous thing
this migration could do.

## The one idea that makes this work

PostgREST's whole trick is: open a transaction, `SET ROLE`, publish the verified
JWT into a GUC, run the query, commit. The policies do the rest. `src/db/rls.ts`
does exactly that:

```ts
await withRls(req.claims, async (tx) => {
  // inside here the session IS the caller — every policy applies
});
```

So authorization stays in the database and cannot drift from it. Two rules in
that file are load-bearing and must never be "simplified":

- `set_config(..., is_local => true)` — a plain `SET` would outlive the
  transaction and leak one user's role onto the next request sharing that
  pooled connection.
- claims are **bound as a parameter**, never string-interpolated.

`withService()` is the old service-role path (RLS bypassed, because the
connection user owns the tables). Every call there is a place where *you* own
the authorization check.

## How the schema is built

Model-first, in four phases (`npm run migrate`):

| | |
| --- | --- |
| `db/prelude.sql` | extensions, roles, the `auth`/`storage` schemas. Idempotent. |
| `db/functions/010` | the functions **unvalidated** (`check_function_bodies = off`) |
| `db/migrations/*` | generated from the models. Applied once each. |
| `db/functions/*` | policies, functions, triggers, jobs, grants, seed — re-applied every run |

Phase 2 exists because of a real cycle: the policies call `auth.uid()` and
`current_app_role()`, while those functions read tables phase 3 has not created
yet. Postgres solves it the way `pg_dump` does — create the bodies unvalidated,
then create them properly once the tables exist.

Phase 4 running *every* time is the point. A migration that renames a column
leaves the function reading it stale; re-applying repairs it in the same run
rather than at the next incident.

### What the models own, and what they cannot

`src/db/schema` owns tables, columns, indexes, foreign keys, views and enums.

**RLS policies are NOT in the models.** drizzle-kit can express `pgPolicy`, but
it cannot round-trip one: introspecting this schema returned **32 of 47**
policies with their `USING` and `WITH CHECK` expressions dropped. A policy with
no `USING` means `USING (true)` — it permits everything to everyone holding the
role. That is the authorization model silently inverted, so policies live in
`db/functions/015_no_rls.sql`, which drops them.

**Table grants are authored, not extracted** (`db/functions/040_grants.sql`).
The 72 Supabase migrations grant almost nothing: `authenticated` has no SELECT
on `branches`, `members` or `attendance`. Supabase granted those when it
*provisioned the project*, before any migration ran — so a database rebuilt from
the migrations alone answers every request with `permission denied for table
branches`. Which is exactly what happened the first time the API met a database
it had built itself.

`npm run verify:schema` proves a model-built database matches one built from the
archived migrations, across every column, constraint, index, policy expression,
function body, trigger, grant and seed row.

## The ORM does not own the schema

Drizzle is used **database-first**. The entity definitions in `src/db/schema`
are GENERATED from the live database by `npm run db:pull`, and the SQL files in
`db/` are the only thing that changes it.

`drizzle-kit generate` and `drizzle-kit push` are deliberately shadowed by npm
scripts that refuse to run. They diff the entities against the database and emit
whatever makes the database match the code — and the entities cannot describe
the 51 RLS policies, the 36 SQL functions, the triggers that maintain data
(`assign_member_code`, `sync_attendance_with_roster`), the PostGIS and pgvector
columns, or the two pg_cron jobs. A generated migration would drop all of it.

To change the schema: add a `.sql` file to `db/forward`, run `npm run migrate`,
then `npm run db:pull` to bring the entities back in step.

```bash
docker compose up -d db
npm run migrate     # SQL builds the schema
npm run db:pull     # the schema is read back into entities
```

Column types drizzle-kit cannot introspect — `geography(Point,4326)`,
`vector(512)` and plain `date` — are defined by hand in
[src/db/schema/types.ts](src/db/schema/types.ts), with a note on each about how
its value has to be written.

## Layout

```
src/
  domain/      the rules, as data and pure functions. No HTTP, no SQL.
    attendance/  gates · slot · windows · types
    report/      rate — what "attendance rate" means
    roster/      bulk — add / remove / replace, and the day range
    qr/          token validity and minting
    identity/    role · nationalId
    member/      filter — the shared grid predicate
    clock        Africa/Cairo, DST included
  data/        SQL. Every function takes an OPEN transaction.
  services/    use cases: own the transaction, call domain, call data
  routes/      HTTP only — parse, authorize, delegate, respond
  db/          pool · context (asCaller / asService) · schema
```

The split earns its keep in one place above all: the check-in gate chain used to
be inline in a 470-line handler and could not be tested at all. It is now pure
functions with 30 tests covering things like "a location bypass skips mock GPS,
accuracy AND the geofence together, but not the face gate".


```
db/
  compat.sql     Supabase-platform surface on plain Postgres: the anon /
                 authenticated / service_role roles, auth.uid(), auth.users,
                 the storage schema. Lets all 72 legacy files run unchanged.
  legacy/        the original 72 migrations, verbatim. The REFERENCE lineage —
                 what production already runs, therefore the definition of
                 correct. Do not edit.
  baseline/      the squashed schema. GENERATED (see below), empty until then.
  forward/       new migrations from here on.
src/
  env.ts         validated config; fails at boot, not on first request
  db/pool.ts     pg pool + Kysely; owner connection (RLS-exempt)
  db/rls.ts      withRls / withService / callRpc
  auth/jwt.ts    HS256 sign+verify — same claims the Edge Function minted
  auth/plugin.ts resolves req.caller / req.claims once per request
  routes/        one file per client api module
scripts/
  migrate.mjs           replaces `supabase db push`
  analyze-migrations.mjs what the 72 files actually contribute
  squash.mjs            generates db/baseline from a replayed database
  verify-squash.mjs     PROVES baseline == legacy before you delete anything
```

## Setup

Postgres must ship **postgis**, **pgvector** and **pg_cron** — the app schema
uses all three (geofencing, face embeddings, two scheduled jobs). pg_cron also
needs `shared_preload_libraries = 'pg_cron'` and `cron.database_name` set, then
a restart. The stock `postgres:16` image has none of them; `postgis/postgis:16`
plus pgvector, or `supabase/postgres`, do.

```bash
cp .env.example .env      # set DATABASE_URL and APP_JWT_SECRET
npm install
npm run migrate           # applies compat.sql + all 72 legacy files
npm run db:types          # regenerate src/db/types.ts from the live schema
npm run dev
curl localhost:8787/api/v1/time/now
```

`APP_JWT_SECRET` must be the **same value the old Supabase project used**.
Tokens already on members' phones are valid for 30 days; reusing the secret
means nobody is logged out at cutover. Changing it logs everyone out.

## Moving the live data across

The schema comes from the migrations; the ROWS come from the hosted project.
Face embeddings in particular cannot be recreated — losing them means every
student re-enrolls their face.

```bash
# 1. rows. Dry-run first: it prints a source/target row count table and writes
#    nothing.
SOURCE_DATABASE_URL='postgres://postgres:…@db.<ref>.supabase.co:5432/postgres' \
  npm run import:data -- --dry-run
SOURCE_DATABASE_URL='…' npm run import:data

# 2. the image files, which live in Supabase Storage rather than in Postgres
SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=… \
  npm run import:storage
```

Two things the copy has to get right, and both are handled:

- **Triggers are disabled during the restore.** `assign_member_code` would
  reissue every student code on insert — codes that are printed on rosters and
  are meant never to change — and `sync_attendance_with_roster` would create and
  delete attendance rows as the roster lands.
- **The target must be empty.** Importing on top of existing rows duplicates
  every student, so a non-empty target is refused unless you pass `--force`.

Both scripts verify and report rather than claiming success: the row script
compares every table plus the embedding count and exits non-zero on any
mismatch; the storage script names the objects the database knows about but
Supabase no longer has.

**Not yet exercised against a real project.** Dry-run first, and keep the hosted
project until a real member has signed in and checked in against the new stack.

## Squashing the 72 migrations

The history is heavily rewritten — `app_settings` is altered 20 times, the
member directory view is recreated 17 times, `server_now` has 5 definitions,
and three tables were renamed wholesale. A squash is worth doing.

It is **generated, never hand-merged**. With 50 policies in play, a hand-merge
that drops one produces no error at all — just a table a member can suddenly
read. So:

```bash
# 1. build the baseline from a database that replayed all 72 files
SQUASH_DATABASE_URL=postgres://…/scratch_squash node scripts/squash.mjs

# 2. prove it — builds two fresh databases and diffs every column, constraint,
#    index, policy expression, function body, view, trigger, grant and seed row
LEGACY_DATABASE_URL=postgres://…/verify_legacy \
BASELINE_DATABASE_URL=postgres://…/verify_baseline \
node scripts/verify-squash.mjs
```

`migrate.mjs` switches to the baseline lineage automatically once `db/baseline`
has files, and refuses to mix lineages in one database.

**Keep `db/legacy/` until `verify-squash` prints `identical`.** After that it is
archive material, and new changes go in `db/forward/`.

`node scripts/analyze-migrations.mjs` prints the redundancy report if you want
to see what the squash is collapsing.

## Porting status

**Complete.** There is no Supabase dependency left in `ClientApp/package.json`,
no PostgREST call anywhere in the client, and no `auth` or `storage` table in
the database. All 17 Edge Functions, GoTrue, Supabase Storage and PostgREST are
gone.

| Area | Endpoints | Replaced |
| --- | --- | --- |
| time | `GET /time/now` | `rpc('server_now')` |
| auth | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/logout-all`, `/auth/password{,/initial}`, `/auth/staff*`, `/auth/members/reset-password` | GoTrue + 7 Edge Functions |
| catalog | institutions, branches, groups, shifts | `api/catalog.ts` |
| settings | `GET`/`PATCH /settings`, `/settings/branding`, master password | `api/settings.ts` |
| departments | CRUD + monthly member assignment | `api/departments.ts` |
| admins | staff list, assignments, permissions | `api/admins.ts` |
| members | directory, paging, bulk import, bulk flags | `create-member` + direct PostgREST |
| profile | `mark-enrolled`, `mark-password-changed`, `PATCH /profile/me`, `member-code` | `api/profile.ts` |
| storage | upload / signed URL / **download** / delete | Supabase Storage |
| face | enrol, reset, lookup, templates | `enroll-photo`, `reset-face`, `member-face-tool` |
| qr | `POST /qr`, `POST /qr/redeem` | `create-qr`, `qr-bypass` |
| presence | spot-checks and confirmations | `presence-check`, `presence-confirm` |
| attendance | `POST /attendance/record`, `/attendance/set`, the whole report surface | `record-attendance`, `set-attendance` + direct PostgREST |

The two biggest client modules shrank rather than moved: `attendance.ts` went
from 1060 lines to 428 and `members.ts` from 773 to 488, because the joins and
the set arithmetic they were doing in JavaScript are now one SQL statement each.

### The six phases after the functional port

0. **Row-level security removed.** 54 policies and the nine helper functions
   that served them, replaced by `domain/access` with unit tests — after the
   suite was proven to pass with RLS already disabled. `db/functions/` went from
   eleven files to nine, and the project's function count from 33 to 16.
1. **Client-era RPCs, part 1.** `custom_access_token_hook`, `public_branding`,
   `my_member_code`, `clear_image_paths` — each a `SECURITY DEFINER` wrapper that
   existed only because a browser was talking to Postgres.
2. **Authentication into Node.** Six password functions became
   `services/authService.ts`; `auth.users` was folded into
   `profiles.password_hash` and dropped. One password store instead of two.
3. **Storage into Node.** `storage.objects` and `storage.buckets` became
   `public.attachments`; the `storage` schema is gone. Buckets and which of them
   is public are constants in code, not rows anyone can flip.
4. **Authorization into `domain/access/`.** The admin-reach rule now exists in
   Node as well as in SQL, because six admin surfaces bypass RLS entirely.
5. **Sessions.** The 30-day unrevocable JWT became a 15-minute access token plus
   a rotating, revocable refresh token with reuse detection.
6. **Deployment.** `deploy/` — production compose overrides, a preflighted
   deploy script, backup and restore, an aaPanel vhost, and a local aaPanel
   sandbox to practise on.

Function count in `public` + `auth`: **16**, down from 33. The RLS helpers are
gone with the policies; what remains is genuine computation —
`geofence_check` (PostGIS), `slot_concluded`, `time_minutes`, `server_now`,
`roster_maker_data`, the lifecycle triggers, and `auth.uid()`, which the last
two still read.

## Bugs found while porting

Every one pre-existing. The pattern worth noting: static reading found the
obvious ones, running the app found more, running it against real Postgres found
more again, and building the database *from empty* found the last few. Each
round of "look again" was cheaper than the round before and still found things.

**Features that could never have worked**

- **`reset-member-password`** called GoTrue's `updateUserById()`, but members
  have no `auth.users` row — the call could only ever fail.
- **Creating a spot-check** passed a JS array straight into `${targets}::uuid[]`.
  drizzle expands arrays into separate parameters, so every attempt raised
  `malformed array literal`.
- **Bulk roster assignment** had the identical binding in
  `unnest(${dates}::date[])`.
- **No route served stored images.** `openObject()` was written and never wired
  up, so every signed URL and every avatar URL pointed at an endpoint that did
  not exist — no stored image rendered anywhere in the app.
- **Deleting an admin who had ever created an account** failed on
  `profiles.created_by → auth.users(id)`, which had no delete rule.

**Silently wrong**

- **`toApiError` never matched a Postgres error.** drizzle wraps the driver
  error in `DrizzleQueryError.cause`, so `err.code` was always undefined and the
  whole SQLSTATE table was dead: duplicates, foreign-key violations, check
  violations and RLS refusals all returned 500 — which the client renders as a
  full-screen "server is down".
- **Writes made just before a refusal were rolled back.** The master-password
  audit row and the refresh-token family revocation were both written inside the
  transaction that then threw. The most alarming event in the system was never
  recorded, and reuse detection revoked nothing.
- **`member_directory` lost `security_invoker`**, making every student's
  national ID, phone and email readable by every other student. Proven on a
  legacy-only database.
- **The sign-in rate limiter keyed on an unparsed body**, falling back to the
  shared campus IP — ten fumbled logins would have locked out the faculty.
- **`REPORT_PAGE_SIZE = 5000` against a `.max(500)` schema** meant all five
  exports returned 400.
- **Master-password logins were never audited**: `audit_event` had no
  `'master_login'` value and the insert was wrapped in a bare catch. Three more
  enum values were missing for the same reason.

**Privilege boundaries that were not enforced**

Six admin surfaces ran as the service role, so RLS was not in the path and
`requireRole('admin')` was the whole check. An admin assigned to one branch could
open a spot-check against another, mint a check-in QR for it, set or clear any
member's attendance, clear any member's face enrolment (two ways), and upload
members into any branch. The rule existed — in SQL, where those requests never
went.

**The schema the migrations described was not the schema in production**

Discovered three separate times: `attendance_status` never gained `left_work`
though three migrations used it; the table grants existed only because Supabase
applied them at provisioning; and `auth_admin_read_profiles` named a role that a
fresh build does not create, so the policy file failed part-way through.

## Still outstanding

- **The old Supabase keys are not rotated.** `ClientApp/.env` was committed with
  a live service-role key, an account-wide `sbp_` management token, the JWT
  secret and a plaintext superadmin password. The file is untracked now; the
  values remain in git history. Rotating them is what closes it.
- **`import-from-supabase.mjs` and `import-storage.mjs` have never run against
  real data.** Both are dry-runnable and neither writes to the source.
- Report *values* are verified for shape, not for arithmetic against a
  populated database.

## Tests

```bash
npm test                 # 172 unit tests — the domain, pure, no database
npm run test:e2e         # 139 checks against a RUNNING stack, api on :8787
npm run test:e2e:prod    # the same, through nginx on :8080 — production's path
```

The end-to-end suites are in `test/e2e/` and matter more than their count
suggests: every bug found late in this port was invisible to the unit tests and
to reading the code. Signed image URLs pointing at a route that did not exist,
every Postgres error arriving as a 500, a revoked token family rolled back by
the throw that followed it, six admin endpoints with no scope check — all of
them needed a real request against a real database.

Run the `:prod` variant before a deploy. In production the API publishes no port
at all, so a suite pointed at `:8787` exercises a path production does not have;
the signed-URL checks in particular are the ones most likely to break behind a
reverse proxy.
