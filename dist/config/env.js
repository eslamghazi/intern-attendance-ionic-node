// Validated, centralised environment access. Fail loudly at boot rather than
// with a confusing 500 on the first request — a missing APP_JWT_SECRET would
// otherwise reject every member token at runtime.
import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { z } from 'zod';
const __dirname = dirname(fileURLToPath(import.meta.url));
// ONE env file for the whole project, at the repo root. dotenv does not
// overwrite a name it has already seen, so these run most-specific first and
// the root is the last word rather than the first.
//   cwd/.env          how the API is started in production (aaPanel runs it
//                     from the project root, so this IS the root file)
//   server/.env       for someone running only the server
//   repo root/.env    development, shared with the client build — see
//                     ClientApp/vite.config.ts, which points envDir here
dotenv.config();
dotenv.config({ path: resolve(__dirname, '../../.env') });
dotenv.config({ path: resolve(__dirname, '../.env') });
dotenv.config({ path: resolve(__dirname, '../../../.env') });
// If DATABASE_URL is unset, automatically construct fallback from POSTGRES_PASSWORD
if (!process.env.DATABASE_URL && process.env.POSTGRES_PASSWORD) {
    const host = process.env.POSTGRES_HOST || '127.0.0.1';
    const port = process.env.POSTGRES_PORT || '5432';
    const user = process.env.POSTGRES_USER || 'attendance';
    const db = process.env.POSTGRES_DB || 'attendance';
    process.env.DATABASE_URL = `postgres://${user}:${process.env.POSTGRES_PASSWORD}@${host}:${port}/${db}`;
}
// Fallback PORT to WEB_PORT if specified (common in aaPanel/Docker setups)
if (!process.env.PORT && process.env.WEB_PORT) {
    process.env.PORT = process.env.WEB_PORT;
}
const schema = z.object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DATABASE_SSL: z.enum(['0', '1']).default('0'),
    APP_JWT_SECRET: z
        .string()
        .min(32, 'APP_JWT_SECRET must be at least 32 chars'),
    // Was JWT_TTL_DAYS=30 — one token, unrevocable, valid for a month. Split in
    // two: a short access token, and a refresh token the database can revoke.
    //
    // 15 minutes is the window in which a stolen access token is still worth
    // something. Longer trades that away for fewer renewals; shorter costs a
    // round trip on a phone that may be on hospital wifi.
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().positive().default(15),
    // How long someone stays signed in without typing a password. Rotated on
    // every use, so this is the idle limit, not a fixed lifetime.
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().positive().default(30),
    PORT: z.coerce.number().int().positive().default(8787),
    HOST: z.string().default('0.0.0.0'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    // The native apps are NOT web origins: Capacitor serves the bundle from a
    // local scheme, and that is the Origin the API sees. Android defaults to
    // `https://localhost` (CapConfig.androidScheme) and iOS to
    // `capacitor://localhost`. Leaving either out blocks the whole mobile app
    // with a CORS error on the very first request.
    CORS_ORIGINS: z
        .string()
        .default('http://localhost:5173,http://localhost:3000,http://localhost:8100,http://127.0.0.1:5173,http://127.0.0.1:8100,https://localhost,capacitor://localhost'),
    // Where the image files live. MUST NOT be inside a web root: these are
    // biometric images, and a directory nginx can serve directly makes every
    // kind policy decoration.
    STORAGE_DIR: z.string().default('./storage-data'),
    // Seconds a signed image URL stays valid.
    STORAGE_URL_TTL: z.coerce.number().int().positive().default(3600),
    // Separate from APP_JWT_SECRET on purpose: a leaked image URL must never be
    // a step towards forging a session. Falls back to a value DERIVED from the
    // JWT secret, so a deployment that never sets it is still not using a
    // guessable key.
    STORAGE_URL_SECRET: z.string().optional(),
    // Prefix the API is reachable under, so a signed URL a phone receives is
    // absolute enough to fetch. Empty when the app and API share an origin.
    API_PUBLIC_PATH: z.string().default('/api/v1'),
    // Optional path to the built frontend client assets (e.g. ClientApp/dist or public).
    CLIENT_DIST_PATH: z.string().optional(),
    // ===== Scheduled maintenance =====
    // The API runs its own jobs (src/infrastructure/scheduler). Set to 0 on an
    // instance that must not run them — a second replica, or a one-off process
    // started to debug something.
    SCHEDULER_ENABLED: z.enum(['0', '1']).default('1'),
    // How long the audit trail is kept. It records refusals and privileged acts,
    // so it is evidence: long enough to investigate a term's disputes, short
    // enough that it is not a permanent register of everyone's movements.
    AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
    // How long a check-in capture is kept. These are BIOMETRIC images, one per
    // check-in and one per check-out. The reason to keep one is to settle a
    // dispute about a specific day, and that reason expires.
    PROBE_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
    // ===== Start-up =====
    // Apply pending migrations when the API starts, so a deployment carries its
    // own schema. Set to 0 where something else owns that — a managed migration
    // step in CI, or a replica that must not touch the schema at all. The work is
    // taken under an advisory lock either way, so several replicas starting at
    // once cannot run it twice.
    AUTO_MIGRATE: z.enum(['0', '1']).default('1'),
    // There is deliberately NO superadmin configuration here. The first account is
    // created automatically when a database has none, with a generated password —
    // see SuperadminSeedService. Credentials in an environment file are a copy of
    // a secret that outlives its purpose and gets committed by accident.
});
const parsed = schema.safeParse(process.env);
if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    console.error(`[env] invalid configuration:\n${lines.join('\n')}`);
    process.exit(1);
}
const raw = parsed.data;
export const env = {
    ...raw,
    isProd: raw.NODE_ENV === 'production',
    databaseSsl: raw.DATABASE_SSL === '1',
    schedulerEnabled: raw.SCHEDULER_ENABLED === '1',
    apiPublicPath: raw.API_PUBLIC_PATH.replace(/\/$/, ''),
    STORAGE_URL_SECRET: raw.STORAGE_URL_SECRET ||
        createHash('sha256').update(`storage:${raw.APP_JWT_SECRET}`).digest('hex'),
    corsOrigins: raw.CORS_ORIGINS.split(',')
        .map((s) => s.trim())
        .filter(Boolean),
};
//# sourceMappingURL=env.js.map