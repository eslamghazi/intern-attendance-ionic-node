// The authoritative server clock.
//
// This was the first endpoint ported off Supabase and the last piece of it to
// stop being SQL. It called server_now(), a SECURITY DEFINER function that read
// auth.uid() to find the caller's member row — the shape every client-era RPC
// had, and the last consumer of the `auth` schema.
//
// There is nothing here a database needs to do. The Cairo formatting already
// existed in domain/clock.ts and the function was duplicating it; all that was
// genuinely wanted from Postgres was one column.
//
// WHY A SERVER CLOCK AT ALL
//
// Check-in windows are decided against it, so a phone with a wrong or
// deliberately altered clock must not be able to argue about the time. The app
// never uses device time — see the note in ClientApp/src/lib/clock.ts.
//
// Replaces: supabase.rpc('server_now'), then public.server_now().
import { sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { asService, query } from '../db/context.js';
import { cairoDate, cairoTime } from '../domain/clock.js';

/** Mirrors ClientApp/src/lib/api/time.ts — do not change one without the other. */
export interface ServerNow {
  date: string; // yyyy-mm-dd — effective (possibly frozen) time
  time: string; // HH:mm:ss   — effective (possibly frozen) time
  frozen?: boolean;
  real_date?: string;
  real_time?: string;
}

export const timeRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Unauthenticated on purpose: the sign-in screen needs a trusted clock before
   * anyone has a token. Without a session there is no member to be frozen, so
   * an anonymous caller simply gets the real time.
   */
  app.get('/time/now', async (req): Promise<ServerNow> => {
    const real = new Date();

    // An admin can pin one member's clock — a support tool for reproducing a
    // window problem. The member is not told, which is the point, so this is
    // read for the CALLER only and never accepted as a parameter.
    let frozenAt: Date | null = null;
    if (req.caller) {
      const rows = await asService((tx) =>
        query<{ frozen_at: string | null }>(
          tx,
          sql`select frozen_at from public.members where profile_id = ${req.caller!.id} limit 1`,
        ),
      );
      const value = rows[0]?.frozen_at;
      if (value) frozenAt = new Date(value);
    }

    const effective = frozenAt ?? real;
    return {
      date: cairoDate(effective),
      time: cairoTime(effective),
      frozen: frozenAt !== null,
      real_date: cairoDate(real),
      real_time: cairoTime(real),
    };
  });
};
