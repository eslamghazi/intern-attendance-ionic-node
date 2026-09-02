// Liveness + readiness.
//
// The client's serverStatus store decides whether to show the "server
// unreachable" screen, so this must be cheap, unauthenticated, and must fail
// only when the API genuinely cannot serve traffic — a flaky single query is
// not an outage.
import type { FastifyPluginAsync } from 'fastify';
import { pool } from '../db/pool.js';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => ({ ok: true }));

  app.get('/health/ready', async (_req, reply) => {
    try {
      // Straight to the pool: readiness asks whether a connection can be had at
      // all, which is a different question from whether a transaction succeeds.
      await pool.query('select 1');
      return { ok: true, db: true };
    } catch {
      return reply.code(503).send({ ok: false, db: false });
    }
  });
};
