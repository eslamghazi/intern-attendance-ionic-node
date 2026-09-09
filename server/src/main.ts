import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppModule } from './app.module.js';
import { env } from './env.js';

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

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set('trust proxy', true);

  // Redact & Body limit
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ limit: '15mb', extended: true }));

  // Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );

  // Rate Limiting
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      max: 300,
      keyGenerator: (req: any) => req.caller?.id ?? req.ip,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // CORS
  const corsOrigins = env.corsOrigins.includes('*') ? true : env.corsOrigins;
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['authorization', 'content-type', 'x-client-info'],
  });

  // Header hook for Cache-Control on API & health routes
  app.use((req: any, res: any, next: any) => {
    if (req.url.startsWith('/api/v1') || req.url.startsWith('/health')) {
      res.setHeader('Cache-Control', 'no-store');
    }
    next();
  });

  // Serve static assets & SPA history fallback
  const clientDist = findClientDist();
  if (clientDist) {
    app.useStaticAssets(clientDist, {
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

    expressApp.get('*', (req: any, res: any, next: any) => {
      if (req.url.startsWith('/api/v1') || req.url.startsWith('/health')) {
        return next();
      }
      res.sendFile(join(clientDist, 'index.html'));
    });
  }

  const port = env.PORT || 3000;
  await app.listen(port);
  console.log(`[NestJS] Server listening on port ${port}`);
}

bootstrap();
