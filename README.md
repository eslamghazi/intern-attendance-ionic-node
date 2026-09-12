# Intern Attendance — Faculty of Nursing, Kafr El Sheikh University

نظام تسجيل حضور طلاب الامتياز — كلية التمريض، جامعة كفر الشيخ.  
An Ionic + React + Capacitor app with a modular monolith **NestJS + Fastify** Node API over **plain PostgreSQL** — no extensions.

Members check in/out **only** when they are inside their assigned branch's geofence, the GPS is verified (no mock location), and a live **face biometric match** passes. Administrators manage groups, branches, members, and rosters from a responsive, bilingual (Arabic-first) web dashboard.

---

## 🏗️ Architecture & Stack

```
ClientApp/            Ionic 8 + React 19 + Vite + Capacitor (TypeScript), Arabic-first (ar/en)
server/               NestJS 12 + Fastify 5 + Drizzle ORM + Umzug API over Postgres
deploy/               Deployment guides (aaPanel & Docker), nginx config, backup/restore
deploy-aapanel/       Ready-to-run production package folder (generated)
deploy-aapanel.zip    Ready-to-upload production archive (~34 MB)
docker-compose.yml    Stock Postgres 16 and the API stack
```

- **Backend**: NestJS with Fastify HTTP adapter, Drizzle ORM, Umzug migrations, and native Postgres driver (`pg`).
- **Database**: stock PostgreSQL 15+, **with no extensions at all**. The geofence (distance, circle and polygon containment) is computed in `src/domain/attendance/geofence.ts` with tests; scheduled maintenance runs in `src/infrastructure/scheduler`, each job holding a Postgres advisory lock so N instances run it once; and the 512-dim face embeddings are a `real[]` column compared in `src/domain/face/similarity.ts`, because every comparison is against one member's own template rather than a nearest-neighbour search.
- **Frontend**: Ionic React with Vite, PWA elements, Tailwind-free vanilla CSS, and offline asset caching.
- **Biometrics & Security**: Capacitor Geolocation, Mock Location Detector, MediaPipe / ML Kit face liveness, and ONNX Runtime Web (MobileFaceNet).
- **Single-Origin Deployment**: In production, the Node server serves both the built frontend static assets (`/`) and the API (`/api/v1`), removing CORS hurdles and enabling secure signed media URLs.

---

## ⚡ الأوامر السريعة (Quick CLI Commands)

| الأمر (Command) | الوظيفة (Description) |
| :--- | :--- |
| `npm run dev:client` | تشغيل الواجهة الأمامية في وضع التطوير (Vite Dev Server) |
| `npm run dev:server` | تشغيل خادم الباك إند في وضع التطوير (`tsx watch`) |
| `npm run build` | بناء المشروع كاملاً (فرونت + باك + مزامنة ملفات العرض) |
| `npm start` | تشغيل السيرفر المترجم في وضع الإنتاج (`dist/main.js`) |
| `npm run save [msg]` | حفظ ورفع جميع التغييرات إلى GitHub على فرع `main` |
| `npm run package` | توليد حزمة الإنتاج المضغوطة للاستضافة (`deploy-aapanel.zip`) |
| `npm run ship` | تحديث فرع الإنتاج `production` ورفعه مباشرة إلى GitHub |
| `npm run clean` | تنظيف الكاش والملفات المؤقتة ومخرجات البناء |
| `npm run setup` | تثبيت معتمدات الفرونت والباك دفعة واحدة |

---

## 🐘 التشغيل على PostgreSQL عادي

النظام يعمل على PostgreSQL قياسي — لا يحتاج منصة مُدارة ولا Docker. يتصل
التطبيق **بمستخدم واحد ثابت يملك الجداول**، ولا يبدّل الدور في أي طلب، ولا
يعتمد على أي `GRANT`: صلاحياته ضمنية بحكم الملكية. لذلك لا يحتاج `SUPERUSER`
ولا `CREATEROLE` — لا عند الترحيل ولا بعده.

المتطلبات: PostgreSQL 15 أو أحدث. **بدون أي إضافات (extensions) إطلاقًا.**

### ١. خطوة واحدة بصلاحية superuser

تُنفَّذ مرة واحدة لكل قاعدة. كل ما بعدها يعمل بمستخدم عادي.

```bash
# أ) الدور والقاعدة — الدور مالك القاعدة، بلا أي صفة إضافية
sudo -u postgres psql -c "CREATE ROLE intern_app LOGIN PASSWORD 'ضع-كلمة-مرور-قوية';"
sudo -u postgres psql -c "CREATE DATABASE intern_atten OWNER intern_app;"

# ب) الكتابة في سكيما public — لم تعد ممنوحة تلقائيًا منذ PostgreSQL 15
sudo -u postgres psql -d intern_atten -c "GRANT CREATE, USAGE ON SCHEMA public TO intern_app;"
```

**ولا شيء غير ذلك.** لا `CREATE EXTENSION` ولا `shared_preload_libraries` ولا
إعادة تشغيل للخادم. التلات حاجات اللي كانت هتطلب إضافة، كلها في التطبيق:

| | |
| --- | --- |
| النطاق الجغرافي | `src/domain/attendance/geofence.ts` |
| المهام المجدولة | `src/infrastructure/scheduler` |
| مطابقة الوجه | `src/domain/face/similarity.ts`، فوق عمود `real[]` |

يعني لو عندك PostgreSQL شغّال بالفعل — أي نسخة قياسية 15 أو أحدث — يكفي إنشاء
الدور والقاعدة أعلاه. لا تحتاج صورة Docker خاصة ولا حزم إضافية.

### ٢. الإعداد والتشغيل — بمستخدم عادي

```bash
cp .env.example .env            # ثم عدّل DATABASE_URL والأسرار
node server/scripts/generate-secrets.mjs   # يولّد APP_JWT_SECRET و STORAGE_URL_SECRET

npm run setup                   # تثبيت معتمدات الواجهة والخادم
npm run migrate                 # إنشاء الجداول — ملف واحد مولَّد من الموديلز
npm run build                   # بناء الواجهة والخادم
npm start                       # التشغيل على PORT (افتراضيًا 8787)
```

`npm run migrate` **لا ينشئ أي دور ولا يمنح أي صلاحية**. إن نقص شيء من الخطوة
الأولى فسيتوقف فورًا برسالة تسمّي ما ينقص والأمر الذي يعالجه. وأي فشل لاحق يطبع
اسم الملف ورقم السطر ونص الاستعلام وكود خطأ Postgres ورسالته كاملة.

المهام المجدولة يشغّلها التطبيق (`src/infrastructure/scheduler`) لا قاعدة
البيانات، وتظهر في سجل التشغيل مسبوقة بـ `[scheduler]`. كل مهمة تأخذ قفلًا
استشاريًا باسمها، فتشغيل أكثر من نسخة لا يكرّر العمل.

### ٣. للتحقق

```bash
sudo bash deploy/verify-clean-install.sh 'كلمة-مرور-intern_app'
```

يبني قاعدة اختبار نظيفة، يشغّل الترحيل بمستخدم عادي، يفحص المخطط، ينشئ مشرفًا،
يشغّل الـ API ويطلب `/health` و`/auth/login` و`/settings`، ثم يهدم القاعدة.
لا يلمس الإنتاج.

---

## 🧪 End-to-end tests without Docker

The e2e suites talk to a real database and a real API. They can run against the
containers, or against a Postgres and an API on this machine — same suites,
same assertions, `--local` picks the plumbing.

```bash
# One-time: a Postgres 16 anywhere, and a role and database for it.
#   createuser attendance --pwprompt --createdb
#   createdb  attendance --owner attendance

cd server
export DATABASE_URL='postgres://attendance:PASSWORD@127.0.0.1:5433/attendance'
export APP_JWT_SECRET='at-least-32-characters-long-for-local-runs'
export SCHEDULER_ENABLED=0                  # the suites drive time themselves
export E2E_PSQL='/path/to/psql'             # only if psql is not on PATH

# The API migrates and seeds itself on boot, so an empty database is enough —
# test:e2e:local starts it with these in the environment.

npm run build && npm run test:e2e:local
```

`test:e2e:local` starts the API itself, restarts it between suites (the rate
limiter and every other piece of in-memory state lives in that process), and
stops it at the end. The superadmin's credentials are the two the suites sign in
with; override them with `E2E_SUPERADMIN_ID` / `E2E_SUPERADMIN_PW`.

On Windows, a no-installer Postgres is enough: unzip the EDB binaries, `initdb`
a data directory and `pg_ctl start` it on a spare port.

---

## ⚙️ What happens when the API starts

Before it accepts a request, the server brings itself up to date:

1. **Pending migrations are applied** — the same runner `npm run migrate` uses,
   so there is one implementation of the checksum rule and the ledger. The work
   is taken under a Postgres advisory lock and a second replica WAITS rather
   than skipping, so several instances starting together cannot race. A failure
   stops the boot: serving on a half-applied schema is worse than not serving.
   Set `AUTO_MIGRATE=0` where a separate step owns the schema.
2. **The `app_settings` row is ensured** — one row the whole schema assumes.
3. **The first superadmin is created**, if the database has no superadmin at
   all — with a password generated for this installation.

So an empty database plus a configured environment is a working system:

```bash
createdb attendance --owner attendance     # empty
npm start
#   [migrate] 3 pending
#     applying  0000_init.sql ... ok
#     ...
#   ====================================================================
#     FIRST SUPERADMIN CREATED — shown once, and never again
#       national id  30110281500753
#       password     <generated for this installation>
#   ====================================================================
#   Server listening on http://127.0.0.1:8787
```

The password is also written to `first-superadmin.txt` next to the app, 0600 —
a container's first log lines are easy to lose. Delete it once you are in.

**The trigger is "no superadmin exists", not "this account is missing"**, which
makes it a recovery path: a system that has lost every superadmin gets a way
back in on the next restart, and a system that has one is never touched.

There is deliberately **no superadmin in the environment**. An env file is a
copy of a secret that outlives the five minutes it was needed for — it gets
committed, pasted into tickets, and read by anything that can list a process's
environment. The password exists in two places only: the bcrypt hash in the
database, and one 0600 file you are told to delete.

### Losing and regaining access

```bash
npm run superadmin:password     # generate a strong one and print it
npm run superadmin:backup       # save the accounts (hashes included) to JSON
npm run superadmin:restore      # put them back; --force to overwrite a live one
```

`superadmin:backup` writes password *hashes*, so a restore brings accounts back
as they were rather than as new ones. Treat that file as a key and keep it off
the machine it protects. If you lose it too, delete every superadmin row and
restart — the seed above will make a fresh one.

---

## 🚀 Running the Full Stack (Docker)

```bash
# 1. Prepare environment
cp .env.example .env

# 2. Start PostgreSQL, migrations, and unified Node server
docker compose up -d --build

# 3. Create initial Superadmin (use a REAL national id and a strong password)
docker compose logs api | grep -A4 'FIRST SUPERADMIN'   # the generated password
```

The web dashboard and API will be live at `http://localhost:8080`.

---

## 💻 Local Development Workflow

```bash
# 1. Start database only
docker compose up -d db

# 2. Setup and run backend (listening on http://localhost:8787)
cd server && cp .env.example .env && npm install
npm run migrate
npm run dev

# 3. Setup and run frontend (listening on http://localhost:5173)
cd ../ClientApp && cp .env.example .env && npm install
npm run dev
```

> **Note**: When running client and server on separate ports in dev mode, set `VITE_API_URL=http://localhost:8787/api/v1` in `ClientApp/.env`.

---

## 📱 Mobile App (Android)

Mock-location detection and ML Kit liveness require a real device or Android emulator:

```bash
cd ClientApp
npm run build && npx cap sync android && npx cap run android
```

---

## 🌐 Production Hosting

### Method 1: aaPanel (Recommended)
Use the pre-built, light-weight package:
- **Zip package**: `deploy-aapanel.zip` (~34 MB)
- **Production branch**: `origin/production` (clean branch containing only runtime artifacts)
- Complete step-by-step setup: **[deploy/AAPANEL_NODE_GUIDE.md](deploy/AAPANEL_NODE_GUIDE.md)**

### Method 2: VPS with Docker Compose
- Hostinger / Ubuntu VPS with Docker & Nginx
- Step-by-step guide: **[deploy/DEPLOY.md](deploy/DEPLOY.md)**
- Disaster recovery & backup: **[deploy/RESTORE.md](deploy/RESTORE.md)**

---

## 🔒 Security Highlights

- **Anti-Spoofing & Geofence**: the server recomputes the distance from the branch row — never trusting a client-supplied one — supports both a radius and a drawn polygon, verifies GPS accuracy, and rejects mock locations.
- **Biometrics**: Face images and probe logs are kept outside the web root (`./storage-data`) and only accessible via time-limited HMAC-signed URLs.
- **Token Security**: Dual-token architecture (15-minute access tokens + rotating refresh tokens stored hashed in Postgres).
- **Authorization lives in the API, deliberately**: the database enforces nothing of its own. The API connects as a single role that owns the schema, so every rule about who may read or write what is applied by the NestJS guards (`src/common/guards`) and `src/domain/access` — with unit tests — before a query is built. Because there is no second layer behind them, the role guard **fails closed** (a route that declares nothing is staff-only) and `src/common/guards/routes.spec.ts` fails the build if any route relies on that default.
