// Fastify auth: resolve the caller once per request and hang it off the
// request object. Port of `getCaller()` from supabase/functions/_shared/mod.ts.
//
// The role is re-read from `profiles` on every request rather than trusted from
// the token. Access tokens are 15 minutes now rather than 30 days, so the
// window this closes is far smaller than it was — but it is not zero, and
// demoting an admin or deactivating a member should take effect on the next
// request, not on the next renewal. It costs one indexed primary-key lookup.
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { asService, query } from '../db/context.js';
import type { JwtClaims } from '../db/context.js';
import { bearerToken, verifyToken, type AppRole } from './jwt.js';
import { unauthorized, forbidden } from '../http/errors.js';

export interface Caller {
  id: string;
  role: AppRole;
  nationalId?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Null for anonymous requests. */
    caller: Caller | null;
    /** Exactly what gets published into `request.jwt.claims`. Null = run as `anon`. */
    claims: JwtClaims | null;
  }
  interface FastifyInstance {
    /** preHandler: 401 unless a valid token resolved to an active profile. */
    requireAuth: (req: FastifyRequest) => Promise<void>;
    /** preHandler factory: 403 unless the caller holds one of `roles`. */
    requireRole: (...roles: AppRole[]) => (req: FastifyRequest) => Promise<void>;
  }
}

const plugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('caller', null);
  app.decorateRequest('claims', null);

  app.addHook('onRequest', async (req) => {
    const token = bearerToken(req.headers.authorization);
    if (!token) return;

    const claims = verifyToken(token);
    if (!claims) return; // invalid/expired token == anonymous, not an error yet

    const profile = await asService(async (tx) => {
      const rows = await query<{ role: AppRole; is_active: boolean | null }>(tx, sql`
        select role, is_active from public.profiles where id = ${claims.sub} limit 1
      `);
      return rows[0] ?? null;
    });

    // Deleted or deactivated profile: the token is worthless from this moment.
    if (!profile || profile.is_active === false) return;

    req.caller = { id: claims.sub, role: profile.role, nationalId: claims.national_id };
    // Re-issue the claims from the DB role so a stale `user_role` baked into an
    // old token can never out-rank the current one.
    req.claims = { ...claims, user_role: profile.role };
  });

  app.decorate('requireAuth', async (req: FastifyRequest) => {
    if (!req.caller) throw unauthorized();
  });

  app.decorate(
    'requireRole',
    (...roles: AppRole[]) =>
      async (req: FastifyRequest) => {
        if (!req.caller) throw unauthorized();
        if (!roles.includes(req.caller.role)) throw forbidden();
      },
  );
};

export const authPlugin = fp(plugin, { name: 'auth' });
