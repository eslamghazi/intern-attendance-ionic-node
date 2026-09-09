# aaPanel Node Project Deployment Guide

This guide walks you through deploying the unified Intern Attendance system (React/Ionic Frontend + Node.js/Fastify Backend) using **aaPanel's Node Project Manager**.

---

## What is Ready

A complete, pre-built production package has been created:
- **Zip Archive**: `deploy-aapanel.zip` (~32 MB, located in the project root)
- **Deployment Folder**: `deploy-aapanel/`

This package contains:
- `dist/`: Compiled Node.js backend
- `public/`: Pre-built Ionic/React frontend (including wasm AI models, assets, and service worker)
- `scripts/`: Superadmin seeding and utility scripts
- `package.json`: Production dependencies
- `.env.example` & `.env`: Environment configuration

---

## Step-by-Step Deployment in aaPanel

### 1. Upload the Package to aaPanel
1. Log into your aaPanel dashboard.
2. In the left menu, click **Files**.
3. Navigate to `/www/wwwroot/`.
4. Click **Upload** and upload `deploy-aapanel.zip`.
5. Once uploaded, click **Unzip** (or right-click `deploy-aapanel.zip` → **Unzip**).
6. Extract it to a folder, for example: `/www/wwwroot/intern-attendance`.

---

### 2. Configure the Environment (.env)
1. In aaPanel **Files**, enter `/www/wwwroot/intern-attendance`.
2. Locate the `.env` file (if hidden, toggle "Show hidden files" or edit `.env.example` and rename to `.env`).
3. Double-click `.env` to edit:
   ```ini
   # Access & Storage Signing Secrets (already generated or paste your own)
   APP_JWT_SECRET=175bEAg4BpRo3bd2cCKkyYq5IH9pVc1b_Ia0ssrjGmg
   STORAGE_URL_SECRET=S1MPQPB0YmPLmW75NQopKpAE4rng0jpFiQOnaABWvvU

   # Database Connection (point to your Postgres database):
   DATABASE_URL=postgres://attendance:YOUR_POSTGRES_PASSWORD@127.0.0.1:5432/attendance
   POSTGRES_PASSWORD=YOUR_POSTGRES_PASSWORD

   # Port configuration (matches aaPanel Node project port)
   NODE_ENV=production
   PORT=8080
   WEB_PORT=8080

   # Capacitor/Mobile origins (for iOS/Android apps)
   CORS_ORIGINS=https://localhost,capacitor://localhost
   ```
4. Click **Save**.

---

### 3. Ensure Node.js Version is Installed in aaPanel
1. In aaPanel, go to **App Store** (or **Website** → **Node project**).
2. Ensure **Node.js Version Manager** is installed.
3. In Node.js Version Manager, install **Node v20.x** or **Node v22.x** (set it as command-line version).

---

### 4. Create the Node Project in aaPanel
1. Go to **Website** → **Node project** tab.
2. Click **Add Node project**.
3. Fill in the fields:
   - **Path**: `/www/wwwroot/intern-attendance`
   - **Project Name**: `intern-attendance`
   - **Run Opt**: `start` (or `npm run start`)
   - **Start File/Command**: `dist/index.js` (or leave default if using Run Opt `start`)
   - **Node Version**: Select `v20.x` or `v22.x`
   - **Port**: `8080`
   - **Run User**: `www`
   - **Domain / Web Service**: Enter your domain (e.g., `attendance.yourdomain.com`). aaPanel will automatically create the Nginx reverse proxy configuration pointing to `127.0.0.1:8080`!
4. Click **Submit**.

---

### 5. Install Dependencies & Start the Application
1. In the **Node project** list, find your `intern-attendance` project.
2. Under the project settings or actions column:
   - Click **Install dependencies** (or open aaPanel terminal inside `/www/wwwroot/intern-attendance` and run `npm install --omit=dev`).
   - Wait ~15 seconds until installation completes.
3. In the project row, click **Start** (or toggle the status switch to ON).
4. Check **Project Logs** to verify:
   ```
   {"level":30,"msg":"serving frontend static assets"}
   {"level":30,"msg":"Server listening at http://127.0.0.1:8080"}
   ```

---

### 6. SSL / HTTPS Setup
1. In aaPanel, go to **Website** → **Node project** (or **Website** → **PHP project** / Nginx sites where the domain is listed).
2. Click on your domain → **SSL** → **Let's Encrypt**.
3. Select your domain, click **Apply**, and turn on **Force HTTPS**.
4. In **Config File** (Nginx configuration), make sure `client_max_body_size` is at least `20m` so face enrollment uploads succeed:
   ```nginx
   client_max_body_size 20m;
   ```

---

### 7. Seed Initial Superadmin (One-Time)
On a fresh database, open the aaPanel **Terminal** (or SSH) and run:
```bash
cd /www/wwwroot/intern-attendance
SUPERADMIN_NATIONAL_ID=30110281500751 \
SUPERADMIN_NAME='Super Admin' \
SUPERADMIN_PASSWORD='YourStrongPasswordHere' \
node scripts/seed-superadmin.mjs
```

---

## Verification
1. Visit `https://attendance.yourdomain.com/` in your browser:
   - The React/Ionic attendance application will load.
2. Visit `https://attendance.yourdomain.com/api/v1/health`:
   - Returns `{"ok":true}`.
3. Log in with your Superadmin credentials to test the dashboard.
