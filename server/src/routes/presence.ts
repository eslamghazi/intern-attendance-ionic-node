// Surprise presence spot-checks. Replaces presence-check (admin) and
// presence-confirm (member).
//
// The admin opens a check against everyone currently on shift; targeted members
// get a polling banner and must confirm before the deadline. On resolve, anyone
// who did not confirm can be marked "left work", which also blocks their normal
// check-out (enforced in the attendance recorder).
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { arrayOf, asService, query, type DbContext } from '../db/context.js';
import { requireFilter } from '../services/accessService.js';
import { cairoNow } from '../domain/clock.js';
import { previousDate } from '../domain/attendance/windows.js';
import { ApiError, badRequest, forbidden, notFound } from '../http/errors.js';

/** Load a check and assert the caller created it. */
async function ownedCheck(tx: DbContext, checkId: string, callerId: string) {
  const rows = await query<{
    id: string;
    created_by: string;
    status: string;
    decision: string | null;
    date: string;
    shift_id: string | null;
    deadline: string;
    target_member_ids: string[] | null;
  }>(tx, sql`select * from public.presence_checks where id = ${checkId} limit 1`);
  const check = rows[0];
  if (!check || check.created_by !== callerId) throw forbidden();
  return check;
}

export const presenceRoutes: FastifyPluginAsync = async (app) => {
  const adminOnly = { preHandler: app.requireRole('admin', 'superadmin') };

  /** Open a spot-check against everyone on shift right now. */
  app.post('/presence/checks', adminOnly, async (req, reply) => {
    const body = z
      .object({
        branch_id: z.string().uuid().nullish(),
        group_id: z.string().uuid().nullish(),
        department_id: z.string().uuid().nullish(),
        shift_id: z.string().uuid().nullish(),
        deadline_minutes: z.coerce.number().int().default(10),
      })
      .safeParse(req.body ?? {});
    if (!body.success) throw badRequest('invalid', 'invalid spot-check payload');
    const b = body.data;
    const callerId = req.caller!.id;

    return asService(async (tx) => {
      // These filters come straight from the request body, and this runs as the
      // service role — so RLS is not in the path and `admin_can_access` never
      // sees them. Without this line an admin assigned to one branch could open
      // a spot-check against another branch's members and read back their names.
      await requireFilter(tx, req.caller!, {
        branchId: b.branch_id ?? null,
        groupId: b.group_id ?? null,
      });

      const today = cairoNow().date;
      const [year, month] = today.split('-').map(Number);

      // On shift = checked in and not yet out, today or (for overnight shifts)
      // yesterday. Filters are applied in SQL rather than in JS as before, so a
      // large roster no longer round-trips every open row.
      const targetRows = await query<{ member_id: string }>(tx, sql`
        select distinct a.member_id
          from public.attendance a
          join public.members m on m.id = a.member_id
         where a.date in (${today}, ${previousDate(today)})
           and a.check_in_at is not null
           and a.check_out_at is null
           and (${b.branch_id ?? null}::uuid is null or m.branch_id = ${b.branch_id ?? null})
           and (${b.group_id ?? null}::uuid is null or m.group_id = ${b.group_id ?? null})
           and (
             ${b.department_id ?? null}::uuid is null
             or exists (
               select 1 from public.member_departments md
                where md.member_id = a.member_id
                  and md.year = ${year} and md.month = ${month}
                  and md.department_id = ${b.department_id ?? null}
             )
           )
      `);

      const targets = targetRows.map((r) => r.member_id);
      if (!targets.length) throw new ApiError(422, 'no_targets', 'nobody is on shift right now');

      const minutes = Math.max(1, Math.min(240, b.deadline_minutes || 10));
      const rows = await query(tx, sql`
        insert into public.presence_checks
          (created_by, branch_id, group_id, department_id, shift_id, date, deadline,
           target_member_ids, status)
        values (${callerId}, ${b.branch_id ?? null}, ${b.group_id ?? null},
                ${b.department_id ?? null}, ${b.shift_id ?? null}, ${today},
                now() + make_interval(mins => ${minutes}), ${arrayOf(targets)}::uuid[], 'open')
        returning *
      `);

      reply.code(201);
      return { ok: true, check: rows[0], target_count: targets.length };
    });
  });

  /** The admin's recent checks, each with who is still pending (by name). */
  app.get('/presence/checks', adminOnly, async (req) => {
    const callerId = req.caller!.id;
    return asService(async (tx) => {
      // One query: unnest the target array, left-join confirmations and names,
      // and re-aggregate. The Edge Function did this in four round trips plus
      // JS set arithmetic.
      const rows = await query(tx, sql`
        with recent as (
          select * from public.presence_checks
           where created_by = ${callerId}
           order by created_at desc
           limit 20
        ),
        expanded as (
          select r.id as check_id,
                 t.member_id,
                 (c.member_id is not null) as confirmed,
                 p.full_name
            from recent r
            cross join lateral unnest(coalesce(r.target_member_ids, '{}')) as t(member_id)
            left join public.presence_confirmations c
                   on c.check_id = r.id and c.member_id = t.member_id
            left join public.members  m on m.id = t.member_id
            left join public.profiles p on p.id = m.profile_id
        )
        select r.*,
               coalesce(array_length(r.target_member_ids, 1), 0) as target_count,
               (select count(*) from expanded e
                 where e.check_id = r.id and e.confirmed)         as confirmed_count,
               coalesce((
                 select jsonb_agg(jsonb_build_object(
                          'member_id', e.member_id,
                          'full_name', coalesce(e.full_name, '')))
                   from expanded e
                  where e.check_id = r.id and not e.confirmed
               ), '[]'::jsonb)                                    as pending,
               (r.deadline < now())                               as past_deadline
          from recent r
         order by r.created_at desc
      `);
      return { checks: rows };
    });
  });

  app.delete('/presence/checks/:id', adminOnly, async (req, reply) => {
    const { id } = req.params as { id: string };
    await asService(async (tx) => {
      await ownedCheck(tx, id, req.caller!.id);
      // presence_confirmations cascade.
      await tx.execute(sql`delete from public.presence_checks where id = ${id}`);
    });
    reply.code(204);
  });

  /** The admin vouches for a member in person. */
  app.post('/presence/checks/:id/confirm', adminOnly, async (req) => {
    const { id } = req.params as { id: string };
    const body = z.object({ member_id: z.string().uuid() }).safeParse(req.body);
    if (!body.success) throw badRequest('missing', 'member_id is required');

    return asService(async (tx) => {
      const check = await ownedCheck(tx, id, req.caller!.id);
      if (check.status !== 'open') throw new ApiError(409, 'not_open', 'this check is closed');
      if (!(check.target_member_ids ?? []).includes(body.data.member_id)) {
        throw forbidden('not_targeted');
      }
      await tx.execute(sql`
        insert into public.presence_confirmations (check_id, member_id)
        values (${id}, ${body.data.member_id})
        on conflict (check_id, member_id) do nothing
      `);
      return { ok: true };
    });
  });

  /** Close the check; optionally mark everyone who never confirmed as left. */
  app.post('/presence/checks/:id/resolve', adminOnly, async (req) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({ decision: z.enum(['keep', 'left_work']).default('keep') })
      .safeParse(req.body ?? {});
    if (!body.success) throw badRequest('invalid', 'invalid decision');

    return asService(async (tx) => {
      const check = await ownedCheck(tx, id, req.caller!.id);
      if (check.status === 'resolved') {
        throw new ApiError(409, 'already_resolved', 'this check is already resolved');
      }

      if (body.data.decision === 'left_work') {
        // Mark non-confirmers on the CHECK-OUT dimension; the recorder then
        // refuses their check-out.
        await tx.execute(sql`
          update public.attendance a
             set checkout_status = 'left_work'
           where a.date = ${check.date}
             and a.check_out_at is null
             and (${check.shift_id}::uuid is null or a.shift_id = ${check.shift_id})
             and a.member_id = any(${arrayOf(check.target_member_ids ?? [])}::uuid[])
             and not exists (
               select 1 from public.presence_confirmations c
                where c.check_id = ${id} and c.member_id = a.member_id
             )
        `);
      }

      await tx.execute(sql`
        update public.presence_checks
           set status = 'resolved', decision = ${body.data.decision}, resolved_at = now()
         where id = ${id}
      `);
      return { ok: true, decision: body.data.decision };
    });
  });

  /* ------------------------------------------------------------- member side */

  /** Is a spot-check waiting for me? Drives the in-app polling banner. */
  app.get('/presence/pending', { preHandler: app.requireRole('member') }, async (req) => {
    const callerId = req.caller!.id;
    return asService(async (tx) => {
      const rows = await query<{ check_id: string; deadline: string }>(tx, sql`
        select pc.id as check_id, pc.deadline
          from public.presence_checks pc
          join public.members m on m.profile_id = ${callerId}
         where pc.status = 'open'
           and pc.deadline > now()
           and m.id = any(pc.target_member_ids)
           and not exists (
             select 1 from public.presence_confirmations c
              where c.check_id = pc.id and c.member_id = m.id
           )
         order by pc.deadline
         limit 1
      `);
      return { pending: rows[0] ?? null };
    });
  });

  /** "I'm here." */
  app.post('/presence/confirm', { preHandler: app.requireRole('member') }, async (req) => {
    const body = z.object({ check_id: z.string().uuid() }).safeParse(req.body);
    if (!body.success) throw badRequest('missing', 'check_id is required');
    const callerId = req.caller!.id;

    return asService(async (tx) => {
      const me = await query<{ id: string }>(tx, sql`
        select id from public.members where profile_id = ${callerId} limit 1
      `);
      if (!me[0]) throw forbidden('not_a_member');

      const rows = await query<{
        status: string;
        expired: boolean;
        targeted: boolean;
      }>(tx, sql`
        select status,
               deadline < now()                          as expired,
               ${me[0].id} = any(target_member_ids)      as targeted
          from public.presence_checks where id = ${body.data.check_id} limit 1
      `);
      const check = rows[0];
      if (!check) throw notFound();
      if (check.status !== 'open') throw new ApiError(409, 'not_open', 'this check is closed');
      if (check.expired) throw new ApiError(410, 'deadline_passed', 'the deadline has passed');
      if (!check.targeted) throw forbidden('not_targeted');

      await tx.execute(sql`
        insert into public.presence_confirmations (check_id, member_id)
        values (${body.data.check_id}, ${me[0].id})
        on conflict (check_id, member_id) do nothing
      `);
      return { ok: true };
    });
  });
};
