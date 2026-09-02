import { buildApp } from './app.js';
import { env } from './env.js';
import { closeDb } from './db/pool.js';
import { ensureBuckets } from './storage/objects.js';

const app = await buildApp();

// Mirror the buckets the migrations declare into the object store. Safe to
// repeat, and it means a fresh deployment needs no manual MinIO setup.
try {
  await ensureBuckets();
} catch (err) {
  // Storage being down must not stop the API: attendance recording degrades to
  // "no probe image", which is far better than refusing every check-in.
  app.log.error({ err }, 'could not reach object storage — uploads will fail');
}

// Drain in-flight requests before dropping the pool. This service records
// attendance: killing a request mid-transaction during a deploy is the one
// failure a student cannot work around.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info(`${signal} received, shutting down`);
    app
      .close()
      .then(closeDb)
      .then(() => process.exit(0))
      .catch((err) => {
        app.log.error({ err }, 'shutdown failed');
        process.exit(1);
      });
  });
}

await app.listen({ port: env.PORT, host: env.HOST });
