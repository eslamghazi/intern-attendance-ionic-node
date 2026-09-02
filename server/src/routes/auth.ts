// Authentication endpoints. Replaces GoTrue plus seven Edge Functions:
//   member-login, master-login, change-member-password, reset-member-password,
//   reset-staff-password, create-staff, delete-staff
//
// The client used to run a three-step dance on every sign-in: try member-login,
// fall back to GoTrue signInWithPassword, fall back to master-login. All three
// are server-side facts, so they collapse into ONE endpoint here.
//
// There is nothing but HTTP in this file — parse, delegate, shape the reply.
// The rules are in services/authService.ts and domain/identity.
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { asCaller, query } from '../db/context.js';
import * as auth from '../services/authService.js';
import { badRequest } from '../http/errors.js';

const loginBody = z.object({
  national_id: z.string().trim().min(1),
  password: z.string().default(''),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/auth/login',
    {
      // 10 attempts a minute per national ID — enough for a fumbled password,
      // far too few to walk the date-of-birth space of a default password.
      //
      // `hook: 'preHandler'` is load-bearing: rate-limit's default is
      // onRequest, which runs BEFORE the body is parsed, so the key would
      // silently fall back to the IP. Every student on campus shares one public
      // IP, so ten fumbled logins by one of them would lock out the faculty.
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          hook: 'preHandler',
          keyGenerator: (req: { body?: unknown; ip: string }) => {
            const nid = (req.body as { national_id?: string } | undefined)?.national_id;
            return nid ? `nid:${nid}` : `ip:${req.ip}`;
          },
        },
      },
    },
    async (req) => {
      const parsed = loginBody.safeParse(req.body);
      if (!parsed.success) throw badRequest('invalid_body', 'national_id is required');
      return auth.login(
        parsed.data.national_id,
        parsed.data.password,
        req.headers['user-agent'] ?? null,
      );
    },
  );


  /**
   * Exchange a refresh token for a new pair.
   *
   * Unauthenticated on purpose: the access token this renews has usually just
   * expired, so requiring one would make the endpoint useless exactly when it
   * is needed. The refresh token IS the credential.
   */
  app.post(
    '/auth/refresh',
    {
      // Renewal is cheap and legitimate clients do it every 15 minutes; this is
      // here so a stolen-token guessing loop cannot run flat out. Keyed by IP,
      // because there is no national ID in the body to key on.
      config: { rateLimit: { max: 60, timeWindow: '1 minute', hook: 'preHandler' } },
    },
    async (req) => {
      const body = z.object({ refresh_token: z.string().min(1) }).safeParse(req.body);
      if (!body.success) throw badRequest('invalid', 'refresh_token is required');
      return auth.refresh(body.data.refresh_token, req.headers['user-agent'] ?? null);
    },
  );

  /**
   * Sign out this device. Unauthenticated for the same reason as refresh: a
   * client whose access token has expired must still be able to end its
   * session, and the refresh token proves which session to end.
   */
  app.post('/auth/logout', async (req) => {
    const body = z.object({ refresh_token: z.string().nullish() }).safeParse(req.body ?? {});
    await auth.logout(body.success ? (body.data.refresh_token ?? null) : null);
    return { ok: true };
  });

  /** Sign out everywhere — the answer to a lost phone. */
  app.post('/auth/logout-all', { preHandler: app.requireAuth }, async (req) => {
    const { revoked } = await auth.logoutEverywhere(req.caller!);
    return { ok: true, revoked };
  });

  /**
   * Everything the app needs about the signed-in user, in one request.
   *
   * The client used to assemble this from three or four separate queries at
   * every bootstrap, with a fallback for when the member embed came back empty.
   * One join cannot half-succeed, so that fallback is gone.
   */
  app.get('/auth/me', { preHandler: app.requireAuth }, async (req) => {
    const caller = req.caller!;
    return asCaller(req.claims, async (tx) => {
      const profiles = await query(tx, sql`
        select * from public.profiles where id = ${caller.id} limit 1
      `);
      const profile = profiles[0] ?? null;
      if (!profile) return { profile: null, member: null, is_enrolled: false };

      if (caller.role !== 'member') {
        return { profile, member: null, is_enrolled: false };
      }

      const members = await query(tx, sql`
        select m.*,
               case when b.id is null then null else to_jsonb(b) end as branch,
               case when g.id is null then null
                    else to_jsonb(g) || jsonb_build_object(
                      'institution', case when i.id is null then null
                                          else jsonb_build_object('name', i.name) end)
               end as "group",
               -- The TRUE enrolled signal is an actual template row: the
               -- enrollment_status flag can drift (seeded 'enrolled' with no
               -- template), and check-in gating depends on getting this right.
               exists (select 1 from public.face_templates ft where ft.member_id = m.id)
                 as is_enrolled
          from public.members m
          left join public.branches b on b.id = m.branch_id
          left join public.groups   g on g.id = m.group_id
          left join public.institutions i on i.id = g.institution_id
         where m.profile_id = ${caller.id}
         limit 1
      `);

      const member = (members[0] ?? null) as ({ is_enrolled: boolean } & Record<string, unknown>) | null;
      return { profile, member, is_enrolled: Boolean(member?.is_enrolled) };
    });
  });

  /** Change your own password, proving the current one. */
  app.post('/auth/password', { preHandler: app.requireAuth }, async (req) => {
    const body = z
      .object({ current: z.string().trim().min(1), new: z.string().trim().min(6) })
      .safeParse(req.body);
    if (!body.success) {
      throw badRequest('invalid', 'current is required and the new password must be 6+ chars');
    }
    // Returns a fresh pair: the change revokes every session for this account,
    // including the one making the request.
    const pair = await auth.changeOwnPassword(
      req.caller!,
      body.data.current,
      body.data.new,
      req.headers['user-agent'] ?? null,
    );
    return { ok: true, ...pair };
  });

  /** The forced first change: no current password, gated on must_change_password. */
  app.post('/auth/password/initial', { preHandler: app.requireAuth }, async (req) => {
    const body = z.object({ new: z.string().trim().min(6) }).safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'the new password must be 6+ chars');
    const pair = await auth.setInitialPassword(
      req.caller!,
      body.data.new,
      req.headers['user-agent'] ?? null,
    );
    return { ok: true, ...pair };
  });

  /** Reset a MEMBER's password back to their date of birth. */
  app.post(
    '/auth/members/reset-password',
    { preHandler: app.requireRole('admin', 'superadmin') },
    async (req) => {
      const body = z
        .object({
          profile_id: z.string().uuid().optional(),
          national_id: z.string().trim().optional(),
          password: z.string().trim().optional(),
        })
        .refine((b) => b.profile_id || b.national_id, { message: 'profile_id or national_id' })
        .safeParse(req.body);
      if (!body.success) throw badRequest('missing', 'profile_id or national_id is required');

      const { password } = await auth.resetPassword(req.caller!, {
        profileId: body.data.profile_id,
        nationalId: body.data.national_id,
        expect: 'member',
        password: body.data.password,
      });
      return { ok: true, password };
    },
  );

  /** Reset a STAFF password back to their date of birth. */
  app.post(
    '/auth/staff/reset-password',
    { preHandler: app.requireRole('admin', 'superadmin') },
    async (req) => {
      const body = z
        .object({ profile_id: z.string().uuid(), password: z.string().trim().optional() })
        .safeParse(req.body);
      if (!body.success) throw badRequest('missing', 'profile_id is required');

      const { password } = await auth.resetPassword(req.caller!, {
        profileId: body.data.profile_id,
        expect: 'staff',
        password: body.data.password,
      });
      return { ok: true, password };
    },
  );

  /** Create an admin account. Replaces create-staff. */
  app.post('/auth/staff', { preHandler: app.requireRole('superadmin') }, async (req, reply) => {
    const body = z
      .object({
        national_id: z.string().trim(),
        full_name: z.string().trim().min(1),
        phone: z.string().nullish(),
        password: z.string().trim().optional(),
        // public.role is an enum of exactly ('superadmin', 'admin', 'member').
        // There is no 'manager', even though the old create-staff Edge Function
        // accepted one — inserting it always raised
        // invalid_text_representation, so it is rejected up front here.
        role: z.enum(['admin']).default('admin'),
        assignments: z
          .array(z.object({ group_id: z.string().nullish(), branch_id: z.string().nullish() }))
          .default([]),
      })
      .safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid staff payload');

    const created = await auth.createStaff(req.caller!, body.data);
    reply.code(201);
    return { ok: true, id: created.id, password: created.password };
  });

  /** Delete an admin account. Replaces delete-staff. */
  app.delete('/auth/staff/:id', { preHandler: app.requireRole('superadmin') }, async (req) => {
    const { id } = req.params as { id: string };
    await auth.deleteStaff(req.caller!, id);
    return { ok: true };
  });
};
