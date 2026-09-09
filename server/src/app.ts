import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';
import { authPlugin } from './auth/plugin.js';
import { toApiError } from './http/errors.js';
import { healthRoutes } from './routes/health.js';
import { timeRoutes } from './routes/time.js';
import { authRoutes } from './routes/auth.js';
import { catalogRoutes } from './routes/catalog.js';
import { profileRoutes } from './routes/profile.js';
import { settingsRoutes } from './routes/settings.js';
import { departmentRoutes } from './routes/departments.js';
import { adminRoutes } from './routes/admins.js';
import { memberRoutes } from './routes/members.js';
import { storageRoutes } from './routes/storage.js';
import { faceRoutes } from './routes/face.js';
import { qrRoutes } from './routes/qr.js';
import { presenceRoutes } from './routes/presence.js';
import { attendanceRoutes } from './routes/attendance.js';
import { rosterRoutes } from './routes/roster.js';
import { reportRoutes } from './routes/reports.js';

export const API_PREFIX = '/api/v1';

const __dirname = dirname(fileURLToPath(import.meta.url));

function findClientDist(): string | null {
  const candidates = [
    env.CLIENT_DIST_PATH,
    resolve(__dirname, '../../ClientApp/dist'),
    resolve(__dirname, '../public'),
    resolve(__dirname, './public'),
    resolve(process.cwd(), 'ClientApp/dist'),
    resolve(process.cwd(), 'public'),
    resolve(process.cwd(), '../ClientApp/dist'),
    resolve(process.cwd(), 'server/public'),
  ].filter((p): p is string => Boolean(p));

  for (const candidate of candidates) {
    if (existsSync(candidate) && existsSync(join(candidate, 'index.html'))) {
      return candidate;
    }
  }
  return null;
}

export async function buildApp(): Promise<FastifyInstance> {
  // Anything that could carry a student identifier or a credential, gone
  // before a line is written.
  //
  // `err.params` is the one that matters. drizzle throws a DrizzleQueryError
  // carrying the statement AND its bound parameters, and the 5xx branch below
  // logs the raw error — so a failing write on `profiles` would put a national
  // id in the log, and a failing storePasswordHash would put a bcrypt hash
  // there. Observed in this project's own logs before this was added.
  //
  // The rest is cheap insurance on paths that should never log a body anyway.
  const redact = {
    paths: [
      'err.params', 'err.query',
      'req.headers.authorization', 'req.headers.cookie',
      'req.body.password', 'req.body.current', 'req.body.new',
      'req.body.refresh_token', 'req.body.content_base64',
    ],
    remove: true,
  };

  const app = Fastify({
    logger: env.isProd
      ? { level: 'info', redact }
      : { level: 'debug', redact, transport: { target: 'pino-pretty' } },
    trustProxy: true, // sits behind nginx; needed for real client IPs in the audit log
    bodyLimit: 15 * 1024 * 1024, // face captures are posted as base64 JPEG
  });

  await app.register(helmet, {
    // The API serves JSON only; the CSP defaults would just add noise to
    // responses no browser renders.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
  });

  // Brute-force protection. The old backend had none, and it needs it: national
  // IDs are semi-public and the default password is derived from the date of
  // birth, so an unthrottled /auth/login is guessable. Global here, with a much
  // tighter per-route limit on sign-in.
  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    // A shared campus NAT would otherwise throttle everyone at once, so an
    // authenticated caller is bucketed by identity instead of address.
    keyGenerator: (req) => req.caller?.id ?? req.ip,
  });

  await app.register(cors, {
    origin: env.corsOrigins.includes('*') ? true : env.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-client-info'],
  });

  await app.register(authPlugin);

  // The client sets cache:'no-store' on reads for a reason: an export taken
  // right after an edit must never return pre-edit rows. Say it on the server
  // too, so no proxy in between decides otherwise.
  // Apply only to API & health endpoints so static frontend assets can be cached.
  app.addHook('onSend', async (req, reply, payload) => {
    if (req.url.startsWith(API_PREFIX) || req.url.startsWith('/health')) {
      reply.header('Cache-Control', 'no-store');
    }
    return payload;
  });

  app.setErrorHandler((err, req, reply) => {
    const api = toApiError(err);
    // 5xx is ours to fix — log the original. 4xx is the caller's, log quietly.
    if (api.status >= 500) req.log.error({ err }, 'unhandled error');
    else req.log.debug({ err: api }, 'request rejected');

    // Attendance refusals answer with their own `{ reason }` body — the client
    // switches on it to choose the message the student sees.
    if (api.payload) return reply.code(api.status).send(api.payload);

    reply.code(api.status).send({
      error: {
        code: api.code,
        message: api.status >= 500 && env.isProd ? 'internal server error' : api.message,
        ...(api.details ? { details: api.details } : {}),
        // The client's describeDbError() turns a constraint violation into
        // "can't delete, it's still linked to members". It reads the SQLSTATE
        // and the table name — and nothing else, so nothing else is sent.
        //
        // `message` and `detail` are deliberately withheld: Postgres embeds the
        // offending values in them, so a duplicate-key error would answer with
        // `Key (national_id)=(29001011234567) already exists`. They stay in the
        // server log, where they are useful and not public.
        ...(api.pg ? { pg: { code: api.pg.code, table: api.pg.table } } : {}),
      },
    });
  });

  await app.register(
    async (api) => {
      await api.register(healthRoutes);
      await api.register(timeRoutes);
      await api.register(authRoutes);
      await api.register(catalogRoutes);
      await api.register(profileRoutes);
      await api.register(settingsRoutes);
      await api.register(departmentRoutes);
      await api.register(adminRoutes);
      await api.register(memberRoutes);
      await api.register(storageRoutes);
      await api.register(faceRoutes);
      await api.register(qrRoutes);
      await api.register(presenceRoutes);
      await api.register(attendanceRoutes);
      await api.register(rosterRoutes);
      await api.register(reportRoutes);
    },
    { prefix: API_PREFIX },
  );

  // Keep /health reachable without the prefix too — uptime probes are simpler.
  await app.register(healthRoutes);

  // Frontend static assets (if client dist directory exists)
  const clientDist = findClientDist();
  if (clientDist) {
    app.log.info({ clientDist }, 'serving frontend static assets');
    await app.register(fastifyStatic, {
      root: clientDist,
      prefix: '/',
      wildcard: false,
      setHeaders: (res, pathName) => {
        if (pathName.includes('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (
          pathName.endsWith('index.html') ||
          pathName.endsWith('sw.js') ||
          pathName.endsWith('manifest.webmanifest')
        ) {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    });
  } else {
    app.log.warn('no frontend client dist found; running API only');
  }

  app.setNotFoundHandler((req, reply) => {
    // SPA history fallback: serve index.html for non-API, non-health GET requests
    if (
      clientDist &&
      req.method === 'GET' &&
      !req.url.startsWith(API_PREFIX) &&
      !req.url.startsWith('/health')
    ) {
      return reply.sendFile('index.html');
    }

    reply.code(404).send({ error: { code: 'not_found', message: `no route for ${req.url}` } });
  });

  return app;
}
