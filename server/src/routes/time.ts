// Authoritative server clock — the first endpoint ported off Supabase, and
// deliberately so: it exercises the whole chain (token -> claims -> RLS
// transaction -> SECURITY DEFINER function that reads auth.uid()). If this
// returns the right answer for a member with a frozen clock, the replacement
// model is sound and everything else is repetition.
//
// Replaces: supabase.rpc('server_now')
import type { FastifyPluginAsync } from 'fastify';
import { asCaller, callFunction } from '../db/context.js';

/** Mirrors ClientApp/src/lib/api/time.ts — do not change one without the other. */
export interface ServerNow {
  date: string; // yyyy-mm-dd — effective (possibly frozen) time
  time: string; // HH:mm:ss   — effective (possibly frozen) time
  frozen?: boolean;
  real_date?: string;
  real_time?: string;
}

export const timeRoutes: FastifyPluginAsync = async (app) => {
  // Granted to `anon` as well as `authenticated`: the client needs a trusted
  // clock on the login screen, before anyone has a token. An anonymous caller
  // has no auth.uid(), so it simply never gets a frozen time.
  app.get('/time/now', async (req) => {
    return asCaller(req.claims, (tx) => callFunction<ServerNow>(tx, 'server_now'));
  });
};
