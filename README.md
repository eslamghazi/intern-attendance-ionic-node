# Intern Attendance — Faculty of Nursing, Kafr El Sheikh University

نظام تسجيل حضور طلاب الامتياز — كلية التمريض، جامعة كفر الشيخ.  
An Ionic + React + Capacitor app with a modular monolith **NestJS + Fastify** Node API over **Postgres** (PostGIS + pgvector + pg_cron).

Members check in/out **only** when they are inside their assigned branch's geofence, the GPS is verified (no mock location), and a live **face biometric match** passes. Administrators manage groups, branches, members, and rosters from a responsive, bilingual (Arabic-first) web dashboard.

---

## 🏗️ Architecture & Stack

```
ClientApp/            Ionic 8 + React 19 + Vite + Capacitor (TypeScript), Arabic-first (ar/en)
server/               NestJS 12 + Fastify 5 + Drizzle ORM + Umzug API over Postgres
deploy/               Deployment guides (aaPanel & Docker), nginx config, backup/restore
deploy-aapanel/       Ready-to-run production package folder (generated)
deploy-aapanel.zip    Ready-to-upload production archive (~34 MB)
docker-compose.yml    Postgres (PostGIS + pgvector + pg_cron) and API stack
```

- **Backend**: NestJS with Fastify HTTP adapter, Drizzle ORM, Umzug migrations, and native Postgres driver (`pg`).
- **Database**: PostgreSQL with `postgis`, `pgvector` (512-dim face embeddings), and `pg_cron` for automated attendance concluding.
- **Frontend**: Ionic React with Vite, PWA elements, Tailwind-free vanilla CSS, and offline asset caching.
- **Biometrics & Security**: Capacitor Geolocation, Mock Location Detector, MediaPipe / ML Kit face liveness, and ONNX Runtime Web (MobileFaceNet).
- **Single-Origin Deployment**: In production, the Node server serves both the built frontend static assets (`/`) and the API (`/api/v1`), removing CORS hurdles and enabling secure signed media URLs.

---

## ⚡ Quick CLI Commands

Use these convenient root commands for daily development and deployment:

| Command | Description |
| :--- | :--- |
| `npm run setup` | Install all dependencies for both `server` and `ClientApp` |
| `npm run dev` | Start backend server in development mode (`tsx watch`) |
| `npm run dev:client` | Start frontend client in development mode (Vite dev server) |
| `npm run build` | Full clean build (client + server + static assets sync) |
| `npm start` | Start compiled production server (`dist/main.js`) |
| `npm run clean` | Clean all build artifacts, caches, and temp files |
| `npm run package` | Generate aaPanel production archive (`deploy-aapanel.zip`) |
| `npm run branch:prod` | Update isolated `production` branch with fresh build artifacts |
| `npm run save [msg]` | Stage, commit, and push changes to `main` branch |
| `npm run ship` | Build, update `production` branch, and push directly to GitHub |
| `npm run db:migrate` | Run database migrations via Umzug |
| `npm run db:seed` | Seed default superadmin account |

---

## 🚀 Running the Full Stack (Docker)

```bash
# 1. Prepare environment
cp .env.example .env

# 2. Start PostgreSQL, migrations, and unified Node server
docker compose up -d --build

# 3. Create initial Superadmin
docker compose exec -e SUPERADMIN_NATIONAL_ID=30110281500751 \
  -e SUPERADMIN_NAME='Super Admin' -e SUPERADMIN_PASSWORD='YourStrongPassword' \
  api node scripts/seed-superadmin.mjs
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

- **Anti-Spoofing & Geofence**: Server validates GPS coords with PostGIS `ST_DWithin`, verifies accuracy, and rejects mock locations.
- **Biometrics**: Face images and probe logs are kept outside the web root (`./storage-data`) and only accessible via time-limited HMAC-signed URLs.
- **Token Security**: Dual-token architecture (15-minute access tokens + rotating refresh tokens stored hashed in Postgres).
