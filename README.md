# Intern Attendance — Faculty of Nursing, Kafr El Sheikh University

نظام تسجيل حضور طلاب الامتياز. An Ionic + React + Capacitor app with its own Node
API over Postgres. Members check in/out **only** when they are inside their
branch's geofence, the GPS is real (no mock location), and a live **face match**
passes. Admins manage groups, branches, members and the roster, and review
attendance from a responsive web dashboard.

## Layout

```
ClientApp/   Ionic 8 + React 19 + Vite + Capacitor (TypeScript), Arabic-first, ar/en
server/      Fastify + Kysely API over Postgres — see server/README.md
docker-compose.yml   Postgres (PostGIS + pgvector + pg_cron), MinIO, the API
```

## Architecture

The backend was Supabase (PostgREST, GoTrue, Storage, Edge Functions). It is now
a Node API — but **the database was not rewritten**. The schema, its 36 SQL
functions and its 51 RLS policies are carried over untouched, and the API
reproduces what PostgREST did: open a transaction, `SET ROLE`, publish the
verified JWT into `request.jwt.claims`, run the query. Authorization therefore
still lives in the database and cannot drift from it. See
[server/src/db/rls.ts](server/src/db/rls.ts).

- **Auth** — one `POST /auth/login` covers the member password, the staff
  password and the master-password override. Tokens are HS256, signed with the
  same secret the old Edge Functions used.
- **Storage** — MinIO (any S3). Object metadata stays in `storage.objects`, so
  the bucket policies from the migrations still decide who may read a file.
- **Device** — Capacitor Geolocation, `@capgo/capacitor-mock-location-detector`,
  ML Kit face detection (liveness), ONNX Runtime Web (MobileFaceNet embeddings).

## Prerequisites

- Docker (Postgres needs **postgis**, **pgvector** and **pg_cron**; the compose
  file builds an image with all three)
- Node 20+ and npm, for working on the code outside containers
- Android builds: Android Studio + JDK 17

## Run the whole stack

```bash
cp .env.example .env          # set APP_JWT_SECRET
docker compose up -d --build
```

That is the app on <http://localhost:8080>, the API behind it, the database, and
a one-shot `migrate` container that builds the schema before the API starts.
Then create the first account:

```bash
docker compose exec -e SUPERADMIN_NATIONAL_ID=29001011234567 \
  -e SUPERADMIN_NAME='Super Admin' -e SUPERADMIN_PASSWORD='change-me' \
  api node scripts/seed-superadmin.mjs
```

nginx serves the bundle and proxies `/api` to the API, so **the app and the API
share one origin**. That removes CORS from the web path and is what makes the
signed image URLs work: they are relative and go straight into an `<img src>`,
which cannot send an Authorization header.

## Work on the code

```bash
docker compose up -d db        # just the database

cd server && cp .env.example .env && npm install
npm run migrate && npm run dev # http://localhost:8787

cd ../ClientApp && cp .env.example .env && npm install
npm run dev                    # http://localhost:5173
```

`.env` in ClientApp then needs the absolute API URL
(`VITE_API_URL=http://localhost:8787/api/v1`), and that origin must appear in
the API's `CORS_ORIGINS` — the two are no longer same-origin in this mode.

Android (mock-location and ML Kit liveness need a real device or emulator):

```bash
cd ClientApp
npm run build && npx cap sync android && npx cap run android
```

The WebView's origin is `https://localhost`, so it must appear in the API's
`CORS_ORIGINS`, and `VITE_API_URL` is baked in at build time — a new backend URL
means a new APK.

## Face model

A 112×112 MobileFaceNet/ArcFace ONNX model (output dim **512**) at
`ClientApp/public/models/mobilefacenet.onnx`, or set `VITE_MODEL_BASE_URL` to a
CDN copy. Without it, login and admin work but enrollment and check-in report
"model not available".

## Verify end to end

- **Admin:** sign in as superadmin → create a group, a branch (drop the pin and
  radius on the map), and a member → bulk-import a CSV → build a roster.
- **Member (device):** sign in with the national ID and the default password
  (date of birth `ddmmyyyy`) → forced password change → enroll a face → check in.
  - Inside the geofence succeeds; outside is blocked, with the distance shown.
  - A mock-GPS app blocks the check-in and writes an `audit_log` row.
  - A different person's face fails the match; the enrolled member passes.
  - Check out later; a second check-in for the same shift is rejected.

## Security model

`attendance` is **not** client-writable. The only writer is
`POST /attendance/record`, which re-checks mock GPS, accuracy, the geofence
(server-side PostGIS `ST_DWithin`), liveness and the face score, and can require
Play Integrity / App Attest. Biometric images are private and reachable only
through short-lived signed URLs.

**Sessions.** Signing in returns a 15-minute access token plus a refresh token
that is rotated on every use and stored hashed. Reusing a rotated token revokes
the whole family — the standard reuse-detection rule — and changing or resetting
a password revokes every session for that account. The role is re-read from
`profiles` on each request, so a demotion takes effect on the next request
rather than at renewal.

**Authorization sits in two places, and both are load-bearing:**

- **RLS** on most tables, 46 policies. It applies to statements run under the
  caller's context (`asCaller`).
- **`domain/access/`** in the API, for the paths RLS cannot reach. Six admin
  endpoints run as the service role and so bypass RLS entirely — opening a
  spot-check, minting a QR, overriding attendance, clearing a face enrolment
  (two ways) and uploading a roster. Each now goes through an explicit scope
  check. Without it, `requireRole('admin')` was the only barrier and an admin
  assigned to one branch reached the whole faculty.

`presence_checks`, `presence_confirmations` and `qr_tokens` arrived from
Supabase with RLS enabled and *no policies at all* — deny-all, which is why
those routes must use the service role in the first place. They have policies
now (`db/functions/016_service_only_policies.sql`), so the database states their
reach as plainly as it states everything else's, and a read endpoint added with
`asCaller` is scoped rather than silently empty.

## Status

The port is complete and runs. The schema builds from an empty volume through
five migrations, and **172 unit tests plus 139 end-to-end checks** pass against
the stack in Docker — including through the nginx proxy, which is the only path
production uses.

```bash
cd server
npm test                 # the domain, pure
npm run test:e2e:prod    # against the running stack, through nginx
```

**Production data has not been migrated.** `import-from-supabase.mjs` and
`import-storage.mjs` are written and dry-runnable but have never been run
against the real project.

To deploy: **[deploy/DEPLOY.md](deploy/DEPLOY.md)** (Hostinger VPS + aaPanel),
and **[deploy/RESTORE.md](deploy/RESTORE.md)** before you need it.

Open items and the full porting log are in
[server/README.md](server/README.md).
