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
    await app.register(fastifyStatic as any, {
      root: clientDist,
      prefix: '/',
      decorateReply: true,
      setHeaders: (res: any, pathName: string) => {
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

    fastifyInstance.setNotFoundHandler((req: any, reply: any) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/health')) {
        reply.status(404).send({
          ok: false,
          error: { code: 'not_found', message: 'Route not found' },
        });
        return;
      }
      reply.sendFile('index.html');
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

  const port = env.PORT || 8787;
  const host = env.HOST || '0.0.0.0';
  await app.listen(port, host);
  console.log(`[NestJS + Fastify] Server listening on http://${host}:${port}`);
  console.log(`[Swagger] OpenAPI Docs available at http://${host}:${port}/api/docs`);
}

bootstrap();
