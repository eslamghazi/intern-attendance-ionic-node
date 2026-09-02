# Restoring from a backup

Read this before you need it. A backup that has never been restored is a
hypothesis, and the moment you find out otherwise is the worst one available.

Both halves go back together. Attendance rows reference face photos by path, so
a database restored beside an empty storage volume is a system where nobody is
enrolled and every check-in fails the face gate.

---

## Practise it

On any machine with Docker, against a throwaway stack — not the server:

```bash
git clone <repo> restore-test && cd restore-test
cp .env.example .env && node server/scripts/generate-secrets.mjs   # paste them in
```

Then follow the steps below pointing at a copy of the backup files. Do this
once. It takes twenty minutes and it is the only way to know the files are what
you think they are.

---

## 1. Stop the app, leave the database up

```bash
cd /home/attendance/intern-attendance
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

$COMPOSE stop api web
```

The API must be down: restoring under a live writer produces a database that is
neither the backup nor the current state.

## 2. The database

`pg_restore --clean` drops each object before recreating it, so this replaces
the contents rather than merging into them. Merging is what produces duplicate
students.

```bash
$COMPOSE exec -T db pg_restore \
  --username=attendance --dbname=attendance \
  --clean --if-exists --no-owner --no-privileges \
  < backups/db-YYYYMMDD-HHMMSS.dump
```

Some errors are expected and harmless: `--clean` tries to drop objects that a
fresh database does not have yet. What is **not** harmless is anything
mentioning a table failing to load. Read the output; do not just watch it go by.

## 3. The images

```bash
docker run --rm \
  -v intern-attendance_storage-data:/data \
  -v "$(pwd)/backups":/backup:ro \
  alpine:3 sh -c 'rm -rf /data/* && tar -xzf /backup/storage-YYYYMMDD-HHMMSS.tar.gz -C /data'
```

The `rm -rf` is deliberate: leaving the current files in place mixes two
generations of photos, and the surplus ones belong to enrolments the restored
database no longer knows about.

## 4. Re-apply the schema layer, then start

```bash
$COMPOSE run --rm migrate
$COMPOSE up -d
```

The migration runner is idempotent. It re-applies the policies, functions,
grants and cron jobs on every run, which is exactly what a restored database
needs — a dump carries the schema but this is what proves it matches the code
you are about to run.

## 5. Check it before telling anyone it is back

```bash
# Row counts in the ballpark you expect
$COMPOSE exec -T db psql -U attendance -d attendance -c \
  "select 'profiles' t, count(*) from profiles
   union all select 'members', count(*) from members
   union all select 'attendance', count(*) from attendance
   union all select 'face_templates', count(*) from face_templates
   union all select 'attachments', count(*) from attachments"

# Every attachment row still has its file
$COMPOSE exec -T api node -e "
const {readdirSync} = require('fs');
console.log('faces on disk:', readdirSync('/data/storage/faces').length);
"
```

Then sign in as a real member and open the face-enrolment screen. If the photo
renders, both halves came back and agree with each other.

---

## What a restore does to sessions

Nothing good, and that is correct. `refresh_tokens` is in the dump, so sessions
issued before the backup work again and anything issued after it is gone —
those tokens are not in the restored table, so a renewal is refused and the app
returns to the sign-in screen. Nobody loses an account; some people sign in
again.

If the restore is because of a compromise, end everything deliberately instead
of relying on that:

```bash
$COMPOSE exec -T db psql -U attendance -d attendance -c \
  "update public.refresh_tokens set revoked_at = now() where revoked_at is null"
```

Changing `APP_JWT_SECRET` on top of that invalidates the access tokens too —
the 15-minute window the revocation above does not cover.
