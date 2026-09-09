# Deploying to a Hostinger VPS with aaPanel

The stack runs with Postgres and a unified fullstack Node application container (which serves both the frontend and the API) behind an Nginx vhost. aaPanel's job here is
narrow: it terminates TLS, renews the certificate, and proxies to the app. It
does **not** run the database, PHP, or anything else this project needs — those
are in Docker, which is what makes the deployment reproducible and the rollback
a `git checkout` away.

---

## 1. The server

A Hostinger VPS running **Ubuntu 22.04**. Size it for Postgres with pgvector
and PostGIS, not for a static site:

| | minimum | comfortable |
|---|---|---|
| RAM | 4 GB | 8 GB |
| disk | 50 GB | 100 GB |
| vCPU | 2 | 4 |

The face embeddings are 512-dimensional vectors and the images are on disk;
storage grows with enrolments, not with attendance rows.

**Before anything else**, from your own machine:

```bash
ssh root@<server-ip>
```

Then, on the server:

```bash
# A non-root user to run the app. Docker still needs root, but nothing else
# should have it.
adduser attendance
usermod -aG sudo attendance

# Keys, not passwords — then turn password login off.
mkdir -p /home/attendance/.ssh
cp ~/.ssh/authorized_keys /home/attendance/.ssh/
chown -R attendance:attendance /home/attendance/.ssh
chmod 700 /home/attendance/.ssh && chmod 600 /home/attendance/.ssh/authorized_keys

sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
systemctl restart ssh
```

Open a **second** terminal and confirm `ssh attendance@<server-ip>` works before
you close the first one. Locking yourself out of a fresh VPS is recoverable
through Hostinger's console; it is still an hour you did not need to spend.

---

## 2. aaPanel

```bash
# On the server, as root:
URL=https://www.aapanel.com/script/install_7.0_en.sh
curl -fsSL -o install.sh "$URL"
less install.sh          # read it. It is ~200 KB of shell that will run as root.
bash install.sh aapanel
```

It prints a URL, an entry-point path, a username and a password. **Change the
password immediately** and note the entry point — that random path is most of
what stops the panel being found by a scanner.

In the panel:

- **Security → Panel SSL**: on.
- **Security → Authorized IP**: your own address, if it is static. This is the
  single most effective thing you can do to a control panel.
- Install **Nginx** only. Not Apache, not MySQL, not PHP — nothing here uses
  them, and each is a service to patch.

### Firewall

In aaPanel's firewall, allow **22, 80, 443** and the panel port. Nothing else.
In particular do **not** open 8080 or 5432:

- `8080` is the app, and it is bound to `127.0.0.1` precisely so nginx is the
  only way in.
- `5432` is Postgres, which in production publishes no port at all.

---

## 3. Docker

```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker attendance      # log out and back in for this to take
docker compose version             # v2, must be present
```

---

## 4. The app

```bash
su - attendance
git clone <your-repo-url> /home/attendance/intern-attendance
cd /home/attendance/intern-attendance

cp .env.example .env
node server/scripts/generate-secrets.mjs   # or: docker run --rm node:22-alpine …
```

Paste the three generated values into `.env`, then set:

```ini
WEB_PORT=8080
# The NATIVE app origins. The web app is same-origin and needs no entry.
CORS_ORIGINS=https://localhost,capacitor://localhost
```

Deploy:

```bash
./deploy/deploy.sh
```

It refuses to start on a missing or placeholder secret rather than coming up
with a default password, builds, runs the migration as a one-shot container,
and waits for the API to report healthy.

> **`POSTGRES_PASSWORD` is fixed at first boot.** Postgres applies it only when
> it initialises its data directory. Change it in `.env` afterwards and the
> value in the file and the one in the volume diverge — you are locked out of
> your own database with `password authentication failed`, which reads like a
> typo rather than what it is. The migration runner prints the fix when it hits
> this. Decide the password before the first deploy.

> **`docker compose down` is safe; `down -v` is not.** The `-v` removes the
> named volumes, which is the database and every enrolment photo. It is also
> project-wide even when you pass `--profile something`, so it takes more than
> whatever you were aiming at. There is almost never a reason to type it on the
> server.

Create the first superadmin — once, on a fresh database:

```bash
SUPERADMIN_NATIONAL_ID=30110281500751 \
SUPERADMIN_NAME='Super Admin' \
SUPERADMIN_PASSWORD='<a long one>' \
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  exec -T api node scripts/seed-superadmin.mjs
```

---

## 5. The site and TLS

In aaPanel: **Website → Add site**, with your domain. Skip PHP and the database
— the site directory stays empty, because the app is served by a container.

Then **SSL → Let's Encrypt**, issue, and turn on **Force HTTPS**. Sessions and
signed image URLs both travel in the clear without it, and a refresh token read
off the wire is a month of access.

Finally, **Config File**, and paste the `location` blocks from
`deploy/aapanel-nginx.conf` — replacing aaPanel's own `location /`, not sitting
beside it. The file explains what each directive is for; the two that are not
optional are `client_max_body_size 20m` (a face capture is base64 JSON, which
inflates by a third — the 1 MB default rejects a normal enrolment with a bare
413) and `X-Forwarded-For` (without it the API sees nginx's address for every
request and the sign-in rate limit throttles the whole faculty as one client).

Verify, **from another machine**:

```bash
curl -sI https://your-domain/api/v1/health     # 200
curl -m 5 http://<server-ip>:8080/             # must FAIL to connect
```

The second one is the important one.

---

## 6. Moving the live data across

Only if you are migrating from the old Supabase project. Both scripts are
dry-runnable and neither writes to the source.

```bash
cd /home/attendance/intern-attendance/server

# Rows. Prints a source/target row-count table and writes nothing.
SOURCE_DATABASE_URL='postgres://…supabase…' \
DATABASE_URL='postgres://attendance:…@127.0.0.1:5432/attendance' \
  node scripts/import-from-supabase.mjs --dry-run

# Then for real, then the images:
… node scripts/import-from-supabase.mjs
… node scripts/import-storage.mjs
```

The import verifies every table's row count, the face embeddings, and that no
staff account arrived without a password — a staff row with no hash cannot sign
in at all, and finding that out at cutover is the worst possible moment.

**Neither script has been run against real data yet.** Take a Supabase backup
first, and do the dry run.

---

## 7. Backups

```bash
crontab -e
20 2 * * * cd /home/attendance/intern-attendance && ./deploy/backup.sh >> /var/log/attendance-backup.log 2>&1
```

`deploy/backup.sh` takes the database **and** the images, because either alone
is not a restore: attendance rows reference face photos by path, and a database
restored beside an empty storage volume is a system where nobody is enrolled.

Copy them off the machine. A backup on the same disk survives a mistake but not
a dead disk, and only one of those is rare.

---

## 8. Updating

```bash
cd /home/attendance/intern-attendance
git pull
./deploy/deploy.sh
```

Migrations are applied by a one-shot container the API waits on, so a deploy
cannot race a half-applied schema. An applied migration is checksummed and the
runner refuses to start if one changed underneath it.

**Rolling back** a code change is `git checkout <tag> && ./deploy/deploy.sh`.
Rolling back a *migration* is a restore from backup — there are no down
migrations, deliberately: a down migration that has never been run is a guess,
and running one on a schema it does not fit destroys the data it was meant to
save.

---

## What has been verified, and how

The production compose in this repo was run end to end before it was written
down — not just built:

- the schema builds from an **empty** volume through all five migrations;
- `docker compose ps` shows the api and db with **no host binding at all**, and
  the web container bound to `127.0.0.1` only. Confirmed from the host: ports
  8787 and 5432 refuse connections, 8080 accepts;
- the SPA, `/api/v1/health`, sign-in, and token refresh all answer **through the
  nginx proxy**, which is the only path production uses;
- all seven end-to-end suites — 217 checks: token 36, auth 40, storage 23,
  access 82, attendance 5, reports 19, guards 12 — pass against that proxied
  path, including the signed-image URLs, which are the part most likely to break
  behind a reverse proxy. `reports` is the one that checks report *values*
  rather than shape, against a month whose answer is known by hand;
  `attendance` fires two simultaneous check-ins and requires that exactly one
  lands.

What has NOT been verified is TLS, Let's Encrypt, and aaPanel's own vhost — none
of which exist on a laptop. Section 5 is the part to walk through carefully.

## What is still outstanding

- **The old Supabase keys are not rotated.** `ClientApp/.env` held a live
  service-role key, an account-wide `sbp_` management token, the JWT secret and
  a plaintext superadmin password. It is not in this repository's history — that
  was checked — but the values existed in a working file for months and a
  service-role key keeps working until revoked. Revoke the `sbp_` token and
  rotate the project keys in the Supabase dashboard, or delete the project once
  the import is done.
- `import-from-supabase.mjs` and `import-storage.mjs` have never been run
  against the real project.
