import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyStatic from '@fastify/static';
import fastifyHelmet from '@fastify/helmet';
import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';
import { IndexPageService } from './infrastructure/web/index-page.service.js';

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
  const adapter = new FastifyAdapter({
    bodyLimit: 15 * 1024 * 1024,
    trustProxy: true,
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter);

  // Helmet Security Headers
  await app.register(fastifyHelmet as any, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
  });

  // CORS Configuration
  const corsOrigins = env.corsOrigins.includes('*') ? true : env.corsOrigins;
  await app.register(fastifyCors as any, {
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'authorization',
      'content-type',
      'x-client-info',
      'accept-language',
      'x-language',
      'x-lang',
    ],
  });

  // Rate Limiting
  await app.register(fastifyRateLimit as any, {
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (req: any) => req.raw?.caller?.id ?? req.caller?.id ?? req.ip,
  });

  // Global Input Validation & Transformation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Cache-Control Hook on API & Health routes
  const fastifyInstance = app.getHttpAdapter().getInstance();
  fastifyInstance.addHook('onSend', async (req: any, reply: any) => {
    if (req.url.startsWith('/api/v1') || req.url.startsWith('/health')) {
      reply.header('Cache-Control', 'no-store');
    }
  });

  // Serve static client assets & SPA fallback
  const clientDist = findClientDist();
  if (clientDist) {
    // index.html is NOT served by the static plugin. It goes through
    // IndexPageService, which rewrites its preview tags with the organisation's
    // name and logo and the request's origin — see infrastructure/web/. The
    // SPA fallback in ApiExceptionFilter does the same.
    const indexPage = app.get(IndexPageService);
    indexPage.load(clientDist);
    // NOT `await reply.header(...)`: a Fastify reply is a thenable that
    // resolves when the response has been SENT, so awaiting it before send()
    // waits forever.
    app.getHttpAdapter().getInstance().get('/', async (req, reply) => {
      const html = await indexPage.render({ protocol: req.protocol, host: req.host });
      return reply.header('content-type', 'text/html; charset=utf-8').header('cache-control', 'no-cache').send(html);
    });

    await app.register(fastifyStatic as any, {
      root: clientDist,
      prefix: '/',
      index: false,
      decorateReply: true,
      setHeaders: (res: any, pathName: string) => {
        const setHeader = (name: string, value: string) => {
          if (typeof res.header === 'function') {
            res.header(name, value);
          } else if (res.raw && typeof res.raw.setHeader === 'function') {
            res.raw.setHeader(name, value);
          } else if (typeof res.setHeader === 'function') {
            res.setHeader(name, value);
          }
        };

        if (pathName.includes('/assets/')) {
          setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (
          pathName.endsWith('index.html') ||
          pathName.endsWith('sw.js') ||
          pathName.endsWith('manifest.webmanifest')
        ) {
          setHeader('Cache-Control', 'no-cache');
        }
      },
    });
  }

  // Swagger Documentation Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Intern Attendance API')
    .setDescription('Production-grade modular monolith API for intern attendance')
    .setVersion('2.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  // SIGTERM ends the process; this makes it end in order. Without it Nest
  // registers no signal handler at all, so onApplicationShutdown never fires —
  // the scheduler's timers were never cleared and the connection pool was never
  // drained, on every `docker compose down` and every deploy.
  app.enableShutdownHooks();

  const port = env.PORT || 8787;
  const host = env.HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`[NestJS + Fastify] Server listening on http://${host}:${port}`);
  console.log(`[Swagger] OpenAPI Docs available at http://${host}:${port}/api/docs`);
}

bootstrap();
