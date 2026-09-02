// Attendance reads: live presence, the review screen, a member's own history,
// the monthly matrix, the dashboard aggregate and the stored photo index.
// Replaces the read half of ClientApp/src/lib/api/attendance.ts.
//
// The common theme is that these all used to pull raw rows to the phone and
// assemble them there — a whole month of roster days and attendance rows, in
// id-chunks, to compute a percentage. Postgres does that work here, so the
// dashboard stops scaling with the size of the institution.
//
// "Is this slot an absence yet?" is `public.slot_concluded()` (see
// db/forward/20260901000002), which is the same rule the recorder enforces.
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { arrayOf, asCaller, query } from '../db/context.js';
import { directoryWhere, monthBounds, MAX_PAGE_SIZE } from '../domain/member/filter.js';
import { filterQuery } from './members.js';
import { monthStats } from '../domain/report/rate.js';
import { badRequest } from '../http/errors.js';

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** The window columns the client needs to reason about a shift locally. */
const SHIFT_JSON = sql`
  jsonb_build_object(
    'id', s.id, 'name', s.name, 'key', s.key,
    'start_time', s.start_time, 'end_time', s.end_time,
    'checkin_open', s.checkin_open, 'checkin_late', s.checkin_late,
    'checkin_close', s.checkin_close, 'checkout_open', s.checkout_open,
    'checkout_close', s.checkout_close)
`;

export const reportRoutes: FastifyPluginAsync = async (app) => {
  const auth = { preHandler: app.requireAuth };

  /**
   * Everyone ON shift right now: a check-in, no check-out. Pass today AND
   * yesterday so overnight shifts that started last night are included.
   */
  app.get('/attendance/present', auth, async (req) => {
    const q = z.object({ dates: z.string().min(1) }).safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'dates is required');
    const dates = q.data.dates.split(',').map((d) => d.trim()).filter(Boolean);

    return asCaller(req.claims, async (tx) => {
      const rows = await query(tx, sql`
        select a.member_id, a.date, a.shift_id, a.shift_name, a.status,
               a.checkout_status, a.check_in_at,
               p.full_name, p.national_id,
               m.branch_id, b.name as branch_name,
               m.group_id,  g.name as group_name
          from public.attendance a
          join public.members  m on m.id = a.member_id
          join public.profiles p on p.id = m.profile_id
          left join public.branches b on b.id = m.branch_id
          left join public.groups   g on g.id = m.group_id
         where a.date = any(${arrayOf(dates)}::date[])
           and a.check_in_at is not null
           and a.check_out_at is null
         order by a.check_in_at
      `);
      return rows;
    });
  });

  /** Every attendance row for a date, with the member's name. */
  app.get('/attendance/review', auth, async (req) => {
    const q = z
      .object({ date: dateStr, branch_id: z.string().uuid().nullish() })
      .safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'date is required');

    return asCaller(req.claims, async (tx) => {
      const rows = await query(tx, sql`
        select a.*,
               jsonb_build_object('profile', jsonb_build_object(
                 'full_name', p.full_name, 'national_id', p.national_id)) as member
          from public.attendance a
          join public.members  m on m.id = a.member_id
          join public.profiles p on p.id = m.profile_id
         where a.date = ${q.data.date}
           and (${q.data.branch_id ?? null}::uuid is null or a.branch_id = ${q.data.branch_id ?? null})
         order by a.check_in_at nulls last, a.id
      `);
      return rows;
    });
  });

  /** One member's full record for a date — the review detail modal. */
  app.get('/attendance/detail', auth, async (req) => {
    const q = z
      .object({
        member_id: z.string().uuid(),
        date: dateStr,
        shift_id: z.string().uuid().nullish(),
      })
      .safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'member_id and date are required');

    return asCaller(req.claims, async (tx) => {
      const rows = await query(tx, sql`
        select a.*,
               jsonb_build_object('profile', jsonb_build_object(
                 'full_name', p.full_name, 'national_id', p.national_id)) as member
          from public.attendance a
          join public.members  m on m.id = a.member_id
          join public.profiles p on p.id = m.profile_id
         where a.member_id = ${q.data.member_id} and a.date = ${q.data.date}
           and (${q.data.shift_id ?? null}::uuid is null or a.shift_id = ${q.data.shift_id ?? null})
         order by a.check_in_at desc nulls last
         limit 1
      `);
      return rows[0] ?? null;
    });
  });

  /**
   * A member's month, ROSTER-FIRST.
   *
   * Reading the attendance table alone shows nothing for a member who was
   * absent all month — there is no row to find. So this starts from what they
   * were rostered for and fills in what happened, which is the only way an
   * absence can appear at all. Upcoming days stay in the list as `pending`.
   */
  app.get('/attendance/history', auth, async (req) => {
    const q = z
      .object({
        member_id: z.string().uuid(),
        year: z.coerce.number().int().optional(),
        month: z.coerce.number().int().min(1).max(12).optional(),
      })
      .safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'member_id is required');
    const { member_id: memberId, year, month } = q.data;

    return asCaller(req.claims, async (tx) => {
      if (!year || !month) {
        const rows = await query(tx, sql`
          select a.id, a.date, a.shift_id, a.shift_name,
                 case when a.check_in_at is null then 'absent'
                      when a.status = 'late' then 'late' else 'present' end as status,
                 a.check_in_at, a.check_out_at, a.checkout_status
            from public.attendance a
           where a.member_id = ${memberId}
           order by a.date desc
           limit 100
        `);
        return rows;
      }

      const { first, last } = monthBounds(year, month);
      const rows = await query(tx, sql`
        with roster as (
          select rd.date, rd.shift_id, s.name as shift_name
            from public.roster_days rd
            left join public.shifts s on s.id = rd.shift_id
           where rd.member_id = ${memberId} and rd.date between ${first} and ${last}
        ),
        att as (
          select a.* from public.attendance a
           where a.member_id = ${memberId} and a.date between ${first} and ${last}
        )
        -- Rostered slots: what happened, or why it has not happened yet.
        select coalesce(a.id::text, 'roster:' || r.date || '|' || coalesce(r.shift_id::text, '')) as id,
               r.date, r.shift_id,
               coalesce(a.shift_name, r.shift_name) as shift_name,
               case when a.check_in_at is not null
                      then (case when a.status = 'late' then 'late' else 'present' end)
                    when public.slot_concluded(r.date, r.shift_id) then 'absent'
                    else 'pending' end as status,
               a.check_in_at, a.check_out_at, a.checkout_status
          from roster r
          left join att a
                 on a.date = r.date and a.shift_id is not distinct from r.shift_id
        union all
        -- Check-ins on days they were not rostered for still belong here.
        select a.id::text, a.date, a.shift_id, a.shift_name,
               case when a.check_in_at is null then 'absent'
                    when a.status = 'late' then 'late' else 'present' end,
               a.check_in_at, a.check_out_at, a.checkout_status
          from att a
         where not exists (
           select 1 from roster r
            where r.date = a.date and r.shift_id is not distinct from a.shift_id
         )
        order by date desc, shift_name
      `);
      return rows;
    });
  });

  /** The shifts rostered for a member on a day, plus what they recorded. */
  app.get('/attendance/day', auth, async (req) => {
    const q = z
      .object({ member_id: z.string().uuid(), date: dateStr })
      .safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'member_id and date are required');
    const { member_id: memberId, date } = q.data;

    return asCaller(req.claims, async (tx) => {
      const [shifts, attendance] = await Promise.all([
        tx.execute(sql`
          select ${SHIFT_JSON} as shift
            from public.roster_days rd
            join public.shifts s on s.id = rd.shift_id
           where rd.member_id = ${memberId} and rd.date = ${date}
           order by s.start_time
        `),
        tx.execute(sql`
          select a.id, a.date, a.shift_id, a.shift_name, a.status,
                 a.check_in_at, a.check_out_at,
                 case when s.id is null then null else ${SHIFT_JSON} end as shift
            from public.attendance a
            left join public.shifts s on s.id = a.shift_id
           where a.member_id = ${memberId} and a.date = ${date}
           order by a.check_in_at
        `),
      ]);
      return {
        shifts: (shifts.rows as { shift: unknown }[]).map((r) => r.shift),
        attendance: attendance.rows,
      };
    });
  });

  /**
   * Everyone expected on a date for a branch, merged with who actually came.
   * Ordered by the same present/late/early_leave/pending/absent rank the grid
   * shows, so the client no longer re-sorts.
   */
  app.get('/attendance/daily-roster', auth, async (req) => {
    const q = z
      .object({ date: dateStr, branch_id: z.string().uuid().nullish() })
      .safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'date is required');
    const { date, branch_id: branchId } = q.data;

    return asCaller(req.claims, async (tx) => {
      const rows = await query(tx, sql`
        with expected as (
          select rd.member_id, rd.shift_id,
                 jsonb_build_object('name', s.name, 'key', s.key,
                                    'start_time', s.start_time, 'end_time', s.end_time) as shift
            from public.roster_days rd
            join public.members m on m.id = rd.member_id
            left join public.shifts s on s.id = rd.shift_id
           where rd.date = ${date}
             and (${branchId ?? null}::uuid is null or m.branch_id = ${branchId ?? null})
        ),
        att as (
          select a.member_id, a.check_in_at, a.check_out_at, a.status
            from public.attendance a
           where a.date = ${date}
             and (${branchId ?? null}::uuid is null or a.branch_id = ${branchId ?? null})
        ),
        -- Rostered members first, then anyone who checked in unrostered.
        people as (
          select member_id, shift_id, shift from expected
          union
          select a.member_id, null::uuid, null::jsonb from att a
           where not exists (select 1 from expected e where e.member_id = a.member_id)
        )
        select pe.member_id, p.full_name, p.national_id, pe.shift,
               a.check_in_at, a.check_out_at,
               case when a.check_in_at is not null then coalesce(a.status::text, 'present')
                    when public.slot_concluded(${date}::date, pe.shift_id) then 'absent'
                    else 'pending' end as status
          from people pe
          join public.members  m on m.id = pe.member_id
          join public.profiles p on p.id = m.profile_id
          left join att a on a.member_id = pe.member_id
         order by case
                    when a.check_in_at is not null and coalesce(a.status::text,'present') = 'present' then 0
                    when a.check_in_at is not null and a.status::text = 'late' then 1
                    when a.check_in_at is not null and a.status::text = 'early_leave' then 2
                    when public.slot_concluded(${date}::date, pe.shift_id) then 4
                    else 3 end,
                  p.full_name
      `);
      return rows;
    });
  });

  /**
   * The whole-month matrix for one page of members: per day, one check-in
   * status per rostered or attended shift, plus the parallel check-out status.
   */
  app.get('/attendance/monthly', auth, async (req) => {
    const q = filterQuery
      .extend({
        year: z.coerce.number().int(),
        month: z.coerce.number().int().min(1).max(12),
        page: z.coerce.number().int().min(1).default(1),
        page_size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
      })
      .safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'invalid query');
    const { page, page_size: pageSize, year, month, ...filters } = q.data;
    const { first, last } = monthBounds(year, month);
    const offset = (page - 1) * pageSize;

    return asCaller(req.claims, async (tx) => {
      const { rows } = await tx.execute<{
        member_id: string;
        full_name: string;
        national_id: string;
        days: Record<string, string[]> | null;
        checkouts: Record<string, (string | null)[]> | null;
        total: string;
      }>(sql`
        with page as (
          select d.member_id, d.full_name, d.national_id, count(*) over () as total
            from public.member_directory d
           where ${directoryWhere({ ...filters, year, month })}
           order by d.full_name, d.member_id
           limit ${pageSize} offset ${offset}
        ),
        -- Every (member, date, shift) slot that should appear: rostered, plus
        -- check-ins on slots nobody rostered.
        slots as (
          select rd.member_id, rd.date, rd.shift_id from public.roster_days rd
           where rd.date between ${first} and ${last}
             and rd.member_id in (select member_id from page)
          union
          select a.member_id, a.date, a.shift_id from public.attendance a
           where a.date between ${first} and ${last}
             and a.check_in_at is not null
             and a.member_id in (select member_id from page)
        ),
        judged as (
          select sl.member_id,
                 extract(day from sl.date)::int as day,
                 case when a.check_in_at is not null
                        then (case when a.status::text = 'late' then 'late' else 'present' end)
                      when public.slot_concluded(sl.date, sl.shift_id) then 'absent'
                      else 'pending' end as in_status,
                 -- Defensive against legacy rows that kept the check-out
                 -- dimension in the status column.
                 coalesce(a.checkout_status::text,
                          case when a.status::text = 'left_work'   then 'left_work'
                               when a.status::text = 'early_leave' then 'early_leave'
                               else null end) as out_status,
                 sl.shift_id
            from slots sl
            left join public.attendance a
                   on a.member_id = sl.member_id and a.date = sl.date
                  and a.shift_id is not distinct from sl.shift_id
        ),
        per_day as (
          select member_id, day,
                 jsonb_agg(in_status order by shift_id)  as statuses,
                 jsonb_agg(out_status order by shift_id) as checkouts
            from judged group by member_id, day
        )
        select p.member_id, p.full_name, p.national_id, p.total,
               coalesce((select jsonb_object_agg(d.day::text, d.statuses)
                           from per_day d where d.member_id = p.member_id), '{}'::jsonb) as days,
               coalesce((select jsonb_object_agg(d.day::text, d.checkouts)
                           from per_day d where d.member_id = p.member_id), '{}'::jsonb) as checkouts
          from page p
         order by p.full_name, p.member_id
      `);

      return {
        rows: rows.map(({ total: _t, ...r }) => ({
          ...r,
          days: r.days ?? {},
          checkouts: r.checkouts ?? {},
        })),
        total: rows.length ? Number(rows[0]!.total) : 0,
      };
    });
  });

  /** Flat export rows for a date range. */
  app.get('/attendance/report', auth, async (req) => {
    const q = z
      .object({
        from: dateStr,
        to: dateStr,
        branch_id: z.string().uuid().nullish(),
        group_id: z.string().uuid().nullish(),
      })
      .safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'from and to are required');
    const o = q.data;

    return asCaller(req.claims, async (tx) => {
      const rows = await query(tx, sql`
        select a.date, a.status, a.check_in_at, a.check_out_at,
               jsonb_build_object(
                 'group_id', m.group_id,
                 'profile', jsonb_build_object('full_name', p.full_name,
                                               'national_id', p.national_id),
                 'group',  case when g.id is null then null
                                else jsonb_build_object('name', g.name) end,
                 'branch', case when b.id is null then null
                                else jsonb_build_object('name', b.name) end
               ) as member
          from public.attendance a
          join public.members  m on m.id = a.member_id
          join public.profiles p on p.id = m.profile_id
          left join public.groups   g on g.id = m.group_id
          left join public.branches b on b.id = m.branch_id
         where a.date between ${o.from} and ${o.to}
           and (${o.branch_id ?? null}::uuid is null or a.branch_id = ${o.branch_id ?? null})
           and (${o.group_id ?? null}::uuid is null or m.group_id = ${o.group_id ?? null})
         order by a.date desc, a.id
      `);
      return rows;
    });
  });

  /** Lightweight per-date statuses for the dashboard tiles. */
  app.get('/attendance/today', auth, async (req) => {
    const q = z.object({ date: dateStr }).safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'date is required');
    return asCaller(req.claims, async (tx) => {
      const rows = await query(tx, sql`
        select a.status, a.check_in_at, a.branch_id,
               jsonb_build_object('group_id', m.group_id) as member
          from public.attendance a
          join public.members m on m.id = a.member_id
         where a.date = ${q.data.date}
         order by a.id
      `);
      return rows;
    });
  });

  /* ------------------------------------------------------------ dashboard */

  /**
   * The dashboard aggregate.
   *
   * The rate is measured over SETTLED slots — a slot counts once its check-out
   * window has closed, either as attended or as absent. A shift still running is
   * neither: nobody is late for it yet. Two check-ins at 8am out of 400 shifts
   * rostered for today is not 100% attendance, and the other 398 are not
   * absences — they are pending, and reported as such.
   *
   * One exception, and it is what makes the filters useful: when the filtered
   * view contains NOTHING settled, the rate falls back to "how many of the
   * expected have arrived so far". The moment the view also holds finished
   * slots, the open ones drop out again, so an early arrival can never inflate
   * a real result.
   */
  app.get('/attendance/stats', auth, async (req) => {
    const q = z
      .object({
        year: z.coerce.number().int(),
        month: z.coerce.number().int().min(1).max(12),
        day: z.coerce.number().int().min(1).max(31).nullish(),
        branchId: z.string().uuid().nullish(),
        groupId: z.string().uuid().nullish(),
        shiftId: z.string().uuid().nullish(),
        departmentId: z.string().uuid().nullish(),
      })
      .safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'year and month are required');
    const f = q.data;
    const { first, last } = monthBounds(f.year, f.month);
    const daysInMonth = new Date(f.year, f.month, 0).getDate();

    return asCaller(req.claims, async (tx) => {
      // One pass over the month builds both sides: attendance rows (what
      // happened) and rostered slots (what was expected), each already filtered.
      const rows = await query<{
        attended: string;
        late: string;
        absent: string;
        pending: string;
        attended_open: string;
        attended_settled: string;
        per_branch: { branch_id: string; value: number }[] | null;
        per_group: { group_id: string; value: number }[] | null;
        per_shift: { shift_id: string; value: number }[] | null;
        per_branch_status:
          | { branch_id: string; present: number; late: number; absent: number }[]
          | null;
        per_day:
          | { day: number; attended: number; absent: number; pending: number; settled_att: number; open_att: number }[]
          | null;
      }>(tx, sql`
        with dept as (
          select md.member_id from public.member_departments md
           where ${f.departmentId ?? null}::uuid is not null
             and md.year = ${f.year} and md.month = ${f.month}
             and md.department_id = ${f.departmentId ?? null}
        ),
        att as (
          select a.member_id, a.date, a.shift_id, a.check_in_at, a.status::text as status,
                 a.branch_id, m.group_id
            from public.attendance a
            join public.members m on m.id = a.member_id
           where a.date between ${first} and ${last}
             and (${f.branchId ?? null}::uuid is null or a.branch_id = ${f.branchId ?? null})
             and (${f.groupId ?? null}::uuid is null or m.group_id = ${f.groupId ?? null})
             and (${f.shiftId ?? null}::uuid is null or a.shift_id = ${f.shiftId ?? null})
             and (${f.day ?? null}::int is null or extract(day from a.date)::int = ${f.day ?? null})
             and (${f.departmentId ?? null}::uuid is null
                  or a.member_id in (select member_id from dept))
        ),
        roster as (
          select rd.member_id, rd.date, rd.shift_id, m.branch_id, m.group_id,
                 public.slot_concluded(rd.date, rd.shift_id) as done
            from public.roster_days rd
            join public.members m on m.id = rd.member_id
           where rd.date between ${first} and ${last}
             and (${f.branchId ?? null}::uuid is null or m.branch_id = ${f.branchId ?? null})
             and (${f.groupId ?? null}::uuid is null or m.group_id = ${f.groupId ?? null})
             and (${f.shiftId ?? null}::uuid is null or rd.shift_id = ${f.shiftId ?? null})
             and (${f.day ?? null}::int is null or extract(day from rd.date)::int = ${f.day ?? null})
             and (${f.departmentId ?? null}::uuid is null
                  or rd.member_id in (select member_id from dept))
        ),
        judged as (
          select r.*, (a.check_in_at is not null) as came,
                 extract(day from r.date)::int as day
            from roster r
            left join att a
                   on a.member_id = r.member_id and a.date = r.date
                  and a.shift_id is not distinct from r.shift_id
        ),
        checkins as (
          select *, extract(day from date)::int as day
            from att where check_in_at is not null
        )
        select
          (select count(*) from checkins)                                    as attended,
          (select count(*) from checkins where status = 'late')              as late,
          (select count(*) from judged where done and not came)              as absent,
          (select count(*) from judged where not done and not came)          as pending,
          (select count(*) from judged where not done and came)              as attended_open,
          (select count(*) from judged where done and came)                  as attended_settled,
          (select jsonb_agg(x) from (
             select branch_id, count(*)::int as value from checkins
              where branch_id is not null group by branch_id) x)             as per_branch,
          (select jsonb_agg(x) from (
             select group_id, count(*)::int as value from checkins
              where group_id is not null group by group_id) x)               as per_group,
          (select jsonb_agg(x) from (
             select shift_id, count(*)::int as value from checkins
              where shift_id is not null group by shift_id) x)               as per_shift,
          (select jsonb_agg(x) from (
             select b.branch_id,
                    coalesce(sum(b.present), 0)::int as present,
                    coalesce(sum(b.late), 0)::int    as late,
                    coalesce(sum(b.absent), 0)::int  as absent
               from (
                 select branch_id,
                        count(*) filter (where status <> 'late') as present,
                        count(*) filter (where status = 'late')  as late,
                        0                                        as absent
                   from checkins where branch_id is not null group by branch_id
                 union all
                 select branch_id, 0, 0, count(*)
                   from judged where done and not came and branch_id is not null
                  group by branch_id
               ) b group by b.branch_id) x)                                  as per_branch_status,
          (select jsonb_agg(x order by x.day) from (
             select d.day,
               (select count(*)::int from checkins c where c.day = d.day)                        as attended,
               (select count(*)::int from judged j where j.day = d.day and j.done and not j.came) as absent,
               (select count(*)::int from judged j where j.day = d.day and not j.done and not j.came) as pending,
               (select count(*)::int from judged j where j.day = d.day and j.done and j.came)     as settled_att,
               (select count(*)::int from judged j where j.day = d.day and not j.done and j.came) as open_att
               from generate_series(1, ${daysInMonth}) as d(day)) x)         as per_day
      `);

      // The database counts; what the counts MEAN is domain/report/rate.ts,
      // where the settled-versus-open rule is stated once and tested.
      const r = rows[0]!;
      return monthStats({
        attended: Number(r.attended),
        late: Number(r.late),
        absent: Number(r.absent),
        pending: Number(r.pending),
        attendedOpen: Number(r.attended_open),
        attendedSettled: Number(r.attended_settled),
        perBranch: r.per_branch ?? [],
        perGroup: r.per_group ?? [],
        perShift: r.per_shift ?? [],
        perBranchStatus: r.per_branch_status ?? [],
        singleDay: Boolean(f.day),
        days: (r.per_day ?? []).map((d) => ({
          day: d.day,
          attended: d.attended,
          absent: d.absent,
          pending: d.pending,
          settledAttended: d.settled_att,
          openAttended: d.open_att,
        })),
      });
    });
  });

  /* --------------------------------------------------------- stored photos */

  /**
   * The stored check-in / check-out photos for a set of members over a range.
   * Paths come from the attendance rows themselves, never from guessing the
   * storage layout — the folder name is built from the member code, which can
   * change.
   */
  app.post('/attendance/probes', { preHandler: app.requireRole('admin', 'superadmin') }, async (req) => {
    const body = z
      .object({ member_ids: z.array(z.string().uuid()), from: dateStr, to: dateStr })
      .safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid query');
    if (!body.data.member_ids.length) return [];
    const o = body.data;

    return asCaller(req.claims, async (tx) => {
      // The two probe columns are unpivoted into one row per photo in SQL,
      // rather than looping in the client.
      const rows = await query(tx, sql`
        select member_id, date, shift_name, type, path, at, face_score from (
          select a.member_id, a.date, a.shift_name, 'check_in' as type,
                 a.check_in_probe_path as path, a.check_in_at as at,
                 a.check_in_face_score as face_score
            from public.attendance a
           where a.check_in_probe_path is not null
          union all
          select a.member_id, a.date, a.shift_name, 'check_out',
                 a.check_out_probe_path, a.check_out_at, a.check_out_face_score
            from public.attendance a
           where a.check_out_probe_path is not null
        ) p
         where p.member_id = any(${arrayOf(o.member_ids)}::uuid[])
           and p.date between ${o.from} and ${o.to}
         order by p.date desc, p.type
      `);
      return rows;
    });
  });

  /** Every stored photo path — what "empty all" works from. */
  app.get(
    '/attendance/probe-paths',
    { preHandler: app.requireRole('admin', 'superadmin') },
    async (req) =>
      asCaller(req.claims, async (tx) => {
        const rows = await query<{ path: string }>(tx, sql`
          select check_in_probe_path as path from public.attendance
           where check_in_probe_path is not null
          union all
          select check_out_probe_path from public.attendance
           where check_out_probe_path is not null
        `);
        return rows.map((r) => r.path);
      }),
  );
};
