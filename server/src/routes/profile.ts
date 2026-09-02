// Profile lifecycle. HTTP only — the rules are in services/profileService.ts.
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { asCaller, query } from '../db/context.js';
import * as profile from '../services/profileService.js';
import { badRequest } from '../http/errors.js';

const updateBody = z.object({
  full_name: z.string().trim().min(1),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  national_id: z.string().trim(),
  avatar_url: z.string().nullish(),
});

export const profileRoutes: FastifyPluginAsync = async (app) => {
  app.post('/profile/mark-enrolled', { preHandler: app.requireAuth }, async (req) => {
    await profile.markEnrolled(req.caller!);
    return { ok: true };
  });

  app.post('/profile/mark-password-changed', { preHandler: app.requireAuth }, async (req) => {
    await profile.markPasswordChanged(req.caller!);
    return { ok: true };
  });

  app.patch('/profile/me', { preHandler: app.requireAuth }, async (req) => {
    const parsed = updateBody.safeParse(req.body);
    if (!parsed.success) throw badRequest('invalid', 'invalid profile payload');
    const p = parsed.data;
    // Empty strings, not nulls — see the note in profileService: '' means
    // "leave it" for the name and "clear it" for phone and email, and that is
    // what the client has always sent.
    await profile.updateOwnProfile(req.caller!, {
      fullName: p.full_name,
      phone: p.phone ?? '',
      email: p.email ?? '',
      nationalId: p.national_id,
      avatarUrl: p.avatar_url ?? null,
    });
    return { ok: true };
  });

  /**
   * The signed-in member's own student code.
   *
   * A plain SELECT scoped to the caller. The old `my_member_code()` was a
   * SECURITY DEFINER wrapper around exactly this — needed only because the
   * client queried Postgres directly and had to be handed its own id by the
   * database. The API already knows who is asking.
   */
  app.get('/profile/member-code', { preHandler: app.requireAuth }, async (req) =>
    asCaller(req.claims, async (tx) => {
      const rows = await query<{ member_code: string | null }>(
        tx,
        sql`select member_code from public.members
             where profile_id = ${req.caller!.id} limit 1`,
      );
      return { code: rows[0]?.member_code ?? null };
    }),
  );
};
