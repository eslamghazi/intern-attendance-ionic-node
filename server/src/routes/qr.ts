// Location-bypass QR codes. Replaces the create-qr and qr-bypass Edge Functions.
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { asService, query, type DbContext } from '../db/context.js';
import { requireBranch } from '../services/accessService.js';
import { cairoNow } from '../domain/clock.js';
import {
  bypassMinutes,
  checkinBlocked,
  mintToken,
  planMint,
  qrAllowed,
  validitySeconds,
  type CheckinMethod,
  type QrSettings as QrRules,
} from '../domain/qr/token.js';
import { badRequest, forbidden, ApiError } from '../http/errors.js';

interface QrSettings {
  qr_requires_member: boolean | null;
  qr_validity_seconds: number | null;
  qr_bypass_minutes: number | null;
  checkin_method: string | null;
}

async function qrSettings(tx: DbContext): Promise<QrSettings> {
  const rows = await query<QrSettings>(tx, sql`
    select qr_requires_member, qr_validity_seconds, qr_bypass_minutes, checkin_method
      from public.app_settings where id = 1
  `);
  return rows[0] ?? {
    qr_requires_member: null,
    qr_validity_seconds: null,
    qr_bypass_minutes: null,
    checkin_method: null,
  };
}

/** The settings row, in the shape the domain reasons about. */
function rules(s: QrSettings): QrRules {
  return {
    checkinMethod: (s.checkin_method as CheckinMethod) || 'both',
    qrRequiresMember: Boolean(s.qr_requires_member),
    qrValiditySeconds: s.qr_validity_seconds,
    qrBypassMinutes: s.qr_bypass_minutes,
  };
}

export const qrRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Mint a short-lived token for a branch/day. Staff may target one member;
   * a member granted `can_generate_qr` may only mint a branch-wide code, and
   * only for their OWN branch — any branch_id they send is ignored.
   */
  app.post('/qr', { preHandler: app.requireAuth }, async (req) => {
    const body = z
      .object({
        branch_id: z.string().uuid().optional(),
        date: z.string().trim().min(1),
        member_id: z.string().uuid().nullish(),
      })
      .safeParse(req.body);
    if (!body.success) throw badRequest('missing', 'date is required');
    const caller = req.caller!;

    return asService(async (tx) => {
      let branchId = body.data.branch_id ?? '';
      let memberIsGenerator = false;

      if (caller.role === 'member') {
        const rows = await query<{ branch_id: string; can_generate_qr: boolean | null }>(tx, sql`
          select branch_id, can_generate_qr from public.members
           where profile_id = ${caller.id} limit 1
        `);
        if (!rows[0]?.can_generate_qr) throw forbidden();
        branchId = rows[0].branch_id;
        memberIsGenerator = true;
      }
      if (!branchId) throw badRequest('missing', 'branch_id is required');

      // A QR token IS a check-in for that branch. A member reaches this only
      // through the can_generate_qr path above, which pins branchId to their
      // own; staff name whichever branch they like, so their reach is checked.
      if (!memberIsGenerator) await requireBranch(tx, caller, branchId);

      const settings = rules(await qrSettings(tx));
      const branch = await query<{ qr_enabled: boolean | null }>(tx, sql`
        select qr_enabled from public.branches where id = ${branchId} limit 1
      `);
      if (!qrAllowed(settings.checkinMethod, branch[0]?.qr_enabled ?? null)) {
        throw new ApiError(403, 'qr_disabled', 'QR check-in is not enabled here');
      }

      const planned = planMint(
        { byMember: memberIsGenerator, branchId, memberId: body.data.member_id ?? null },
        settings,
      );
      if (!planned.ok) {
        throw planned.reason === 'member_required'
          ? badRequest('member_required', 'this deployment requires a member-specific QR')
          : badRequest('missing', 'branch_id is required');
      }
      const plan = planned.plan;

      // Housekeeping: drop already-expired tokens so the table stays small.
      await tx.execute(sql`delete from public.qr_tokens where expires_at < now()`);

      const validity = validitySeconds(settings);
      const token = mintToken();

      await tx.execute(sql`
        insert into public.qr_tokens
          (token, branch_id, date, member_id, single_use, expires_at, created_by)
        values (${token}, ${plan.branchId}, ${body.data.date}, ${plan.memberId},
                ${plan.singleUse},
                now() + make_interval(secs => ${validity}), ${caller.id})
      `);

      return { ok: true, token, date: body.data.date, validity_seconds: validity };
    });
  });

  /**
   * Redeem a scanned token for a TIMED location bypass. The geofence skip is
   * enforced later, server-side, by the attendance recorder — this only stamps
   * members.location_bypass_until.
   */
  app.post('/qr/redeem', { preHandler: app.requireRole('member') }, async (req) => {
    const body = z.object({ token: z.string().trim().min(1) }).safeParse(req.body);
    if (!body.success) throw badRequest('missing_token', 'token is required');
    const caller = req.caller!;

    return asService(async (tx) => {
      const memberRows = await query<{
        id: string;
        branch_id: string;
        qr_enabled: boolean | null;
        block_checkin: boolean | null;
      }>(tx, sql`
        select m.id, m.branch_id, b.qr_enabled, b.block_checkin
          from public.members m
          left join public.branches b on b.id = m.branch_id
         where m.profile_id = ${caller.id} limit 1
      `);
      const member = memberRows[0];
      if (!member) throw forbidden('not_a_member');

      const settings = rules(await qrSettings(tx));
      if (checkinBlocked(settings.checkinMethod, member.block_checkin)) {
        throw new ApiError(403, 'branch_blocked', 'check-in is blocked for this branch');
      }
      if (!qrAllowed(settings.checkinMethod, member.qr_enabled)) {
        throw new ApiError(422, 'qr_disabled', 'QR check-in is not enabled here');
      }

      // Validity is decided in SQL so "now" is the database clock — the same
      // clock the token was minted against, and one a phone cannot influence.
      const tokenRows = await query<{ id: string; single_use: boolean }>(tx, sql`
        select q.id, q.single_use
          from public.qr_tokens q
         where q.token = ${body.data.token}
           and q.branch_id = ${member.branch_id}
           and q.date = ${cairoNow().date}
           and q.expires_at > now()
           and (not q.single_use or q.used_at is null)
           and (q.member_id is null or q.member_id = ${member.id})
           and (${settings.qrRequiresMember}::boolean = false or q.member_id is not null)
         limit 1
      `);
      const token = tokenRows[0];
      if (!token) throw new ApiError(422, 'qr_invalid', 'this QR is not valid');

      if (token.single_use) {
        await tx.execute(sql`update public.qr_tokens set used_at = now() where id = ${token.id}`);
      }

      const minutes = bypassMinutes(settings);
      const updated = await query<{ location_bypass_until: string }>(tx, sql`
        update public.members
           set location_bypass_until = now() + make_interval(mins => ${minutes})
         where id = ${member.id}
        returning location_bypass_until
      `);

      return { ok: true, until: updated[0]?.location_bypass_until, minutes };
    });
  });
};
