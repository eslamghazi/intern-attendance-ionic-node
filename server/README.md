# Node API

NestJS over Fastify, Drizzle over plain PostgreSQL — **stock, with no
extensions**. It serves `/api/v1` and, in production, the built client at `/`.

Setup — a role, a database and one GRANT, and nothing else — is in the root
[README](../README.md), section **التشغيل على PostgreSQL عادي**.

---

## Authorization is in the API, and nowhere else

The database enforces nothing. The API connects as a single role that owns the
schema, so a query that reaches Postgres runs with full rights — every rule about
who may read or write what is applied *before* the query is built.

| | |
| --- | --- |
| `src/common/guards/` | who is calling, and whether this route is for them |
| `src/common/auth/access.service.ts` | the scope checks a handler runs per request |
| `src/domain/access/` | scope as pure functions: which branches, groups and members an admin runs |
| `src/domain/identity/role.ts` | what each role means |

This is a real trade. What it buys is one place to read the rules, written in the
same language as everything else, covered by tests that need no database. What it
costs is that a missing check has no second layer behind it — so two things make
the absence loud rather than silent:

**The guard fails closed.** A route with no `@Roles` and no `@Public` is
staff-only. The tempting default is "any signed-in caller", and it is wrong in a
specific way: forgetting a decorator would then serve every member in the
faculty, and nothing would report it. Closed, the same mistake denies a request,
which somebody notices the first time they try the feature.

**`src/common/guards/routes.spec.ts` fails the build** if any route relies on
that default. Every route says what it wants out loud, and the public list — 13
routes reachable with no token at all — is asserted explicitly, so adding one is
a reviewed act rather than a side effect.

Routes a member may call take the caller and scope to them: `requireSelfOrMember`
refuses a `member_id` that is not the caller's own, because several of those
routes — attendance history, a face template — take the id from the request.

---

## How the schema is built

Model-first, one phase — `npm run migrate`:

| | |
| --- | --- |
| `db/migrations/*` | applied once each, in order, checksummed |

That is the whole of it, because the database owns nothing but its schema: no
functions, no triggers, no scheduled jobs, no policies. Every one of those is
application code under test, so there is no second category of object to apply
and no re-apply pass to sequence against the migrations.

**No extensions, and no elevated rights.** An ordinary role and an empty database
are the entire prerequisite — there is no superuser step before `npm run migrate`
and none after it. Three things that would each have demanded one live in the
application instead:

| | |
| --- | --- |
| the geofence | `src/domain/attendance/geofence.ts` (21 tests) |
| scheduled jobs | `src/infrastructure/scheduler` (6 jobs, advisory-locked) |
| face matching | `src/domain/face/similarity.ts` (16 tests), over a `real[]` column |

If a statement in a migration ever needs more rights than the role that owns the
schema, the statement is wrong — not the role.

### Applied migrations are immutable

`migrate.mjs` stores a checksum of every applied file in `public._migrations` and
refuses to run if one has changed. To change the schema, add a **new** migration;
never edit one that has been applied — two environments silently disagreeing
about their schema is the failure this prevents.

```
db/migrations/
  0000_init.sql   generated from the models
  meta/           generated
```

There is no hand-written SQL in this project — no seed file, no trigger file,
nothing applied before or alongside the migrations. Everything the database has,
drizzle-kit put there from the models.

### What the models own, and what they cannot

`src/infrastructure/database/schema/` owns tables, columns, indexes, foreign
keys, check constraints, views and enums — and since nothing else exists in the
database, `drizzle-kit generate` describes the whole of it.

Every column is a type Drizzle ships out of the box, which is what lets that stay
true and what keeps the database free of extensions.

Two things a migration expresses that a model cannot, and both are deliberate:

* **CHECK constraints and partial-index predicates** are SQL expressions, by
  design — `check()` takes one, exactly as EF Core's `HasCheckConstraint` does.
* **The one view body.** A view is a query; there is no model form for it.

**`drizzle-kit push` is shadowed by an npm script that refuses to run it.** It
diffs against the *live* database rather than its own snapshot, which makes it a
tool for a schema somebody edits by hand — the opposite of this one.
`drizzle-kit generate` is the supported path: edit the models, generate, review
the SQL, commit it.

### A single row the schema cannot express

`app_settings` is pinned to one row by `CHECK (id = 1)` and every read assumes it
is there. It is inserted at boot by
`src/infrastructure/database/bootstrap.service.ts`, idempotently — not by a
migration, because it is not a schema change. It is an invariant the
*application* requires, so the application asserts it on every start.

---

## The audit trail

`audit_log` records every refusal, every privileged act, and every 5xx:
mock-location detections, face mismatches, master-password sign-ins, staff
deletions, face enrolments, server errors.

| | |
| --- | --- |
| `GET /api/v1/audit` | paged, newest first; filters by event, actor and date range |
| `GET /api/v1/audit/summary` | counts per event for the same filters |
| `ClientApp` → *Audit trail* | the admin screen, bilingual, security events highlighted |

There is **no write endpoint and there must never be one**: every row is written
by the server as a side effect of something it did itself, and a route that
accepted audit rows would let a caller forge the record of their own refusal.

**Who sees what.** A superadmin, and an admin with no assignments, see
everything. An assigned admin sees the events of MEMBERS in their branches and
groups — and deliberately *not* events by other staff, nor events with no
identified actor, because nothing connects those to an assignment. The rule is
one function: `AuditRepository.scopePredicate`.

`AuditRepository.record()` is the ONE writer, so "is this recorded?" has a single
answer and a new event cannot be added to one path and missed on another.

Retention is `AUDIT_RETENTION_DAYS` (default 365), applied by the scheduler in
bounded batches.

---

## Stored files

Everything is on disk under `STORAGE_DIR`, never in the database, and never
inside a web root — the images are biometric, and a directory nginx can serve
directly makes every signed URL decoration. Paths are built in ONE place,
[src/infrastructure/storage/paths.ts](src/infrastructure/storage/paths.ts).

```
storage-data/
  faces/                                    enrolment photo, one per member
    year-2026/branch-el-mabarra/group-nursing-a/member-2026010001/face.jpg
  probes/                                   check-in captures, retention applies
    year-2026/2026-09/2026-09-11/branch-el-mabarra/member-2026010001/
      check-in__07-58__morning-shift.jpg
      check-out__15-04__morning-shift.jpg
  avatars/                                  unsigned reads, flat
    <profile-id>.jpg
```

The tree is built to be read by a person over SFTP, because that is what actually
happens: a student disputes a record and somebody wants the photo for that member
on that day. So no raw UUIDs in a name, nothing repeated that the parent
directory already says, and the branch and group present. Probes nest by
year/month/day so each leaf stays small and "delete last spring" is a directory
operation.

Every segment is slugged: a branch named `../../etc` or `مستشفى المبرة` becomes
one safe, lower-cased segment. Arabic is kept rather than transliterated.

**Ownership is a column, not a path.** `attachments.subject_id` records who a file
is *about*, which is not who uploaded it — an admin enrols a member's face.
Deriving it by parsing the path would couple an access decision to a directory
layout: reorganise the tree for readability and the parse quietly stops matching
anyone, which fails closed and looks like an unreproducible permissions bug.
`pathOwner()` therefore applies to `avatars` only, where the path genuinely *is*
`<profile-id>.<ext>`.

---

## Scheduled maintenance

Six jobs, in `src/infrastructure/scheduler`:

| job | every | |
| --- | --- | --- |
| `cleanup-expired-qr` | 1 min | delete lapsed QR tokens |
| `mark-left-work` | 15 min | conclude attendance nobody checked out of |
| `cleanup-expired-refresh-tokens` | 24 h | delete refresh tokens a week past expiry |
| `prune-audit` | 24 h | `AUDIT_RETENTION_DAYS`, default 365 |
| `prune-probes` | 24 h | `PROBE_RETENTION_DAYS`, default 90 |
| `reconcile-attachments` | 24 h | rows vs files; reports, never deletes |

`prune-probes` matters more than it looks. A probe is the photo taken at the
moment of a check-in — one per check-in and one per check-out, for every member,
every day. Without a bound that is unbounded growth of *biometric images of
students*, a liability that grows on its own. Face templates and avatars are not
touched; only the captures, and only past their retention.

`reconcile-attachments` deliberately only counts. A file with no row is
unreachable and only takes disk, which makes deleting it tempting — and makes it
exactly the thing not to automate, because a bug that stopped writing rows would
turn the job into one that deletes every file the system just uploaded.

**Running once across N instances.** A plain `setInterval` in two instances runs
everything twice, so each job holds a Postgres advisory lock named after itself
for as long as it runs — session-scoped, not transaction-scoped, because a job
spans several transactions and the transaction-scoped form would release before
the work began. If the process dies, Postgres drops the lock with the connection,
so a crash cannot silently switch a job off forever.

The lock lives in `src/infrastructure/database/advisory-lock.service.ts`. It is
the ONE place in the API that talks to the `pg` driver rather than going through
Drizzle, because `pg_advisory_lock` is a call into Postgres's lock manager rather
than a query over data, and it needs a pinned connection outside any transaction.
It takes the pool by injection (`PG_POOL`), so it is the only component that can
do this and a grep proves it.

Set `SCHEDULER_ENABLED=0` on an instance that must not run them.

---

## Layout

```
src/
  main.ts          bootstrap, global pipes/filters, shutdown hooks
  app.module.ts
  config/env.ts    validated environment; the process refuses to start without it
  modules/         one folder per API area: controller · service · repository · dto
  domain/          the rules, as data and pure functions. No HTTP, no SQL.
    access/          scope — an admin's reach
    attendance/      gates · slot · windows · geofence
    face/            similarity — the biometric comparison
    report/          rate — what "attendance rate" means
    roster/          add / remove / replace, and the day range
    qr/              token validity and minting
    member/          code composition, directory filters
    identity/        role · nationalId · credentials
    clock.ts         Africa/Cairo, DST included
  common/
    guards/          auth · roles, both registered globally
    auth/            JWT minting, per-request scope checks
    errors.ts        one error envelope for the whole API
  infrastructure/
    database/        pool · context · schema · unit of work · repository bases
    storage/         files on disk, HMAC-signed URLs
    scheduler/       the six jobs
db/
  migrations/      generated, applied once each, checksummed. Do not edit.
scripts/
  migrate.mjs           the runner
  superadmin-password.mjs  set or generate the superadmin password
  superadmin-backup.mjs    save the superadmin accounts
  superadmin-restore.mjs   put them back
  generate-secrets.mjs  APP_JWT_SECRET and STORAGE_URL_SECRET
```

`domain/` holds no framework and no database: it is where a rule goes when being
able to test it exhaustively matters more than where it runs. The check-in gate
chain is the clearest case — "does a location bypass skip mock GPS, accuracy AND
the geofence, but not the face gate?" is a question you answer by reading one
file and running one test, not by tracing a request.

`infrastructure/` is everything that talks to the outside world, and `common/` is
the framework glue that has no business logic of its own.

---

## Setup

```bash
cp .env.example .env       # DATABASE_URL, APP_JWT_SECRET, STORAGE_URL_SECRET
node scripts/generate-secrets.mjs
npm install
npm run migrate
npm run superadmin:password
npm run dev
curl localhost:8787/api/v1/health
```

Changing `APP_JWT_SECRET` invalidates existing access tokens. That costs each
signed-in client one 401, which its HTTP layer answers by presenting the refresh
token — refresh does not require a valid access token, so nobody is signed out.

---

## Tests

```bash
npm test                 # unit tests — the domain, pure, no database
npm run test:e2e         # against a RUNNING stack, api on :8787
npm run test:e2e:prod    # the same, through nginx on :8080 — production's path
```

The unit tests cover the rules; the end-to-end suites cover the things no amount
of reading finds — a signed image URL pointing at a route that does not exist,
every Postgres error arriving as a 500, a revoked token family rolled back by the
throw that followed it. Those need a real request against a real database.

| suite | what it establishes |
|---|---|
| `token` | sign-in, access/refresh rotation, reuse detection |
| `auth` | password changes, master password, staff lifecycle |
| `storage` | upload, download, signed URLs, attachment ownership |
| `access` | scope — that an admin sees their branch and no more |
| `attendance` | two simultaneous check-ins; exactly one lands |
| `reports` | report *values*, against a month whose answer is known by hand |
| `guards` | that no route is reachable without a guard |

`reports` is worth a note. The others check shape and permission; this one checks
arithmetic, because "200 with a plausible body" is a weak claim for the screen a
faculty uses to decide whether a student passed a placement. It builds two months
— one over, one not yet begun — and the second is the one that matters: a slot
nobody could have attended yet must count as *pending*, never as an absence.

Run the `:prod` variant before a deploy. In production the API publishes no port
at all, so a suite pointed at `:8787` exercises a path production does not have;
the signed-URL checks in particular are the ones most likely to break behind a
reverse proxy.
