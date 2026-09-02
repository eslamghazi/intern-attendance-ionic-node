// An admin recording or clearing attendance by hand, bypassing the check-in
// flow. Separate from attendanceService because it shares none of its rules:
// no gates, no windows, no shift selection by clock — an admin says what
// happened and it is recorded.
import { sql } from 'drizzle-orm';
import { asService, query } from '../db/context.js';
import { requireMember } from './accessService.js';
import type { Caller } from '../domain/identity/role.js';
import { notFound } from '../http/errors.js';

export interface SetAttendanceInput {
  memberId: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'early_leave' | null;
  clear: boolean;
  /** Which shift, when the day holds more than one. */
  shiftId: string | null;
}

export async function setAttendanceManually(
  caller: Caller,
  input: SetAttendanceInput,
): Promise<{ ok: true; cleared?: true }> {
  return asService(async (tx) => {
    // Runs as the service role, so RLS is not in the path — `requireRole` alone
    // would let any admin rewrite any member's attendance, in any branch. The
    // clear path is checked too: deleting a record is as much an override as
    // writing one.
    await requireMember(tx, caller, input.memberId);

    if (input.clear) {
      // One shift when named, otherwise the whole day.
      await tx.execute(sql`
        delete from public.attendance
         where member_id = ${input.memberId} and date = ${input.date}
           and (${input.shiftId}::uuid is null or shift_id = ${input.shiftId})
      `);
      return { ok: true as const, cleared: true as const };
    }

    const member = await query<{ branch_id: string }>(tx, sql`
      select branch_id from public.members where id = ${input.memberId} limit 1
    `);
    if (!member[0]) throw notFound('member_not_found');

    // A day may hold several shifts. Resolve which one: the admin's choice,
    // else the shift already recorded that day, else the first rostered one.
    const resolved = await query<{ shift_id: string | null; shift_name: string | null }>(tx, sql`
      with pick as (
        select coalesce(
                 ${input.shiftId}::uuid,
                 (select a.shift_id from public.attendance a
                   where a.member_id = ${input.memberId} and a.date = ${input.date}
                   order by a.check_in_at nulls last limit 1),
                 (select rd.shift_id from public.roster_days rd
                   where rd.member_id = ${input.memberId} and rd.date = ${input.date}
                   limit 1)
               ) as shift_id
      )
      select p.shift_id, s.name as shift_name
        from pick p left join public.shifts s on s.id = p.shift_id
    `);

    const shiftId = resolved[0]?.shift_id ?? null;
    // An 'absent' row records that the member did not come, so it carries no
    // check-in instant; anything else did.
    const came = input.status !== 'absent';

    await tx.execute(sql`
      insert into public.attendance (
        member_id, branch_id, date, status, shift_id, shift_name,
        check_in_at, check_in_is_mock, check_in_liveness_passed
      ) values (
        ${input.memberId}, ${member[0].branch_id}, ${input.date},
        ${input.status}::public.attendance_status, ${shiftId},
        ${resolved[0]?.shift_name ?? null},
        ${came ? new Date().toISOString() : null}, false, ${came}
      )
      on conflict (member_id, date, shift_id) do update set
        status = excluded.status,
        shift_name = excluded.shift_name,
        check_in_at = excluded.check_in_at,
        check_in_is_mock = excluded.check_in_is_mock,
        check_in_liveness_passed = excluded.check_in_liveness_passed
    `);

    return { ok: true as const };
  });
}
