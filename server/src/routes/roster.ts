// The monthly roster: the grid, its totals, single-cell edits and the bulk
// range apply. Replaces the roster half of ClientApp/src/lib/api/members.ts.
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { arrayOf, asCaller, callFunction, callTableFunction, query } from '../db/context.js';
import { directoryWhere, MAX_PAGE_SIZE } from '../domain/member/filter.js';
import { monthBounds, planBulk, rangeDates } from '../domain/roster/bulk.js';
import { filterQuery } from './members.js';
import { badRequest } from '../http/errors.js';

const monthQuery = z.object({
  year: z.coerce.number().int(),
  month: z.coerce.number().int().min(1).max(12),
});

const dayInput = z.object({
  member_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  shift_id: z.string().uuid(),
});

export const rosterRoutes: FastifyPluginAsync = async (app) => {
  /**
   * One page of the roster grid: the members, plus every shift each has on each
   * day of the month, already grouped by day.
   *
   * The client used to fetch a page of members, then fetch their roster days in
   * id-chunks, then group them in JavaScript. Postgres groups better.
   */
  app.get('/roster/view', { preHandler: app.requireAuth }, async (req) => {
    const q = filterQuery
      .merge(monthQuery)
      .merge(
        z.object({
          page: z.coerce.number().int().min(1).default(1),
          page_size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
        }),
      )
      .safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'invalid query');
    const { page, page_size: pageSize, year, month, ...filters } = q.data;
    const { first, last } = monthBounds(year, month);
    const offset = (page - 1) * pageSize;

    return asCaller(req.claims, async (tx) => {
      const rows = await query<{
        member_id: string;
        national_id: string;
        member_code: string | null;
        full_name: string;
        days: Record<string, { shift_id: string; label: string }[]> | null;
        total: string;
      }>(tx, sql`
        with page as (
          select d.member_id, d.national_id, d.member_code, d.full_name,
                 count(*) over () as total
            from public.member_directory d
           where ${directoryWhere({ ...filters, year, month })}
           order by d.full_name, d.member_id
           limit ${pageSize} offset ${offset}
        ),
        cells as (
          select rd.member_id,
                 -- day-of-month as the grouping key
                 extract(day from rd.date)::int as day,
                 s.id as shift_id,
                 coalesce(nullif(s.key, ''), s.name, '') as label
            from public.roster_days rd
            join public.shifts s on s.id = rd.shift_id
           where rd.date between ${first} and ${last}
             and rd.member_id in (select member_id from page)
        ),
        by_day as (
          select member_id, day,
                 -- stable label order inside a cell
                 jsonb_agg(jsonb_build_object('shift_id', shift_id, 'label', label)
                           order by label, shift_id) as shifts
            from cells group by member_id, day
        )
        select p.member_id, p.national_id, p.member_code, p.full_name, p.total,
               coalesce(
                 (select jsonb_object_agg(b.day::text, b.shifts)
                    from by_day b where b.member_id = p.member_id),
                 '{}'::jsonb
               ) as days
          from page p
         order by p.full_name, p.member_id
      `);

      return {
        rows: rows.map(({ total: _total, ...r }) => ({ ...r, days: r.days ?? {} })),
        total: rows.length ? Number(rows[0]!.total) : 0,
      };
    });
  });

  /**
   * Day-by-day totals over EVERY member the filter matches — not just the page.
   * Counting the page would answer a different question than the row asks.
   */
  app.get('/roster/totals', { preHandler: app.requireAuth }, async (req) => {
    const q = filterQuery.merge(monthQuery).safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'invalid query');
    const o = q.data;

    return asCaller(req.claims, async (tx) => {
      const rows = await callTableFunction<{ day: number; shift_id: string | null; cnt: number }>(
        tx,
        'roster_day_totals',
        [o.year, o.month, o.branchId ?? null, (o.search ?? '').trim(), o.field, o.departmentId ?? null],
      );

      const perDay: Record<number, number> = {};
      const perDayShift: Record<number, Record<string, number>> = {};
      let total = 0;
      for (const r of rows) {
        const n = Number(r.cnt) || 0;
        perDay[r.day] = (perDay[r.day] ?? 0) + n;
        if (r.shift_id) (perDayShift[r.day] ??= {})[r.shift_id] = n;
        total += n;
      }
      return { perDay, perDayShift, total };
    });
  });

  /** Everything a privileged member needs to build their branch's roster. */
  app.get('/roster/maker-data', { preHandler: app.requireAuth }, async (req) => {
    const q = monthQuery.safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'year and month are required');
    return asCaller(req.claims, async (tx) => {
      const data = await callFunction<{ members: unknown[]; shifts: unknown[]; roster: unknown[] }>(
        tx,
        'roster_maker_data',
        [q.data.year, q.data.month],
      );
      return data ?? { members: [], shifts: [], roster: [] };
    });
  });

  /** Identity keys already present in a month — the import conflict preview. */
  app.post('/roster/existing-keys', { preHandler: app.requireAuth }, async (req) => {
    const body = monthQuery
      .extend({ member_ids: z.array(z.string().uuid()) })
      .safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid query');
    if (!body.data.member_ids.length) return [];
    const { first, last } = monthBounds(body.data.year, body.data.month);

    return asCaller(req.claims, async (tx) => {
      const rows = await query<{ key: string }>(tx, sql`
        select rd.member_id || '|' || rd.date || '|' || rd.shift_id as key
          from public.roster_days rd
         where rd.member_id = any(${arrayOf(body.data.member_ids)}::uuid[])
           and rd.date between ${first} and ${last}
         order by rd.id
      `);
      return rows.map((r) => r.key);
    });
  });

  /** Add one shift to one day. Idempotent per (member, date, shift). */
  app.post('/roster/days', { preHandler: app.requireAuth }, async (req) => {
    const body = z
      .union([dayInput, z.object({ days: z.array(dayInput) })])
      .safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid roster payload');
    const days = 'days' in body.data ? body.data.days : [body.data];
    if (!days.length) return { affected: 0 };

    return asCaller(req.claims, async (tx) => {
      // One multi-row insert instead of the client's chunked upserts: the whole
      // import either lands or it does not.
      const values = sql.join(
        days.map((d) => sql`(${d.member_id}::uuid, ${d.date}::date, ${d.shift_id}::uuid)`),
        sql`, `,
      );
      const rows = await query<{ id: string }>(tx, sql`
        insert into public.roster_days (member_id, date, shift_id)
        values ${values}
        on conflict (member_id, date, shift_id) do nothing
        returning id
      `);
      return { affected: rows.length };
    });
  });

  /** Remove ONE shift from a day. The sync trigger drops its attendance too. */
  app.delete('/roster/days', { preHandler: app.requireAuth }, async (req, reply) => {
    const body = dayInput.safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid roster payload');
    const d = body.data;
    await asCaller(req.claims, async (tx) => {
      await tx.execute(sql`
        delete from public.roster_days
         where member_id = ${d.member_id} and date = ${d.date} and shift_id = ${d.shift_id}
      `);
    });
    reply.code(204);
  });

  /**
   * Add / remove / replace one shift across a day range for every member the
   * filter matches.
   *
   * All three modes start from what is actually rostered in the range, so a
   * shift is never written twice on one day: `add` toggles an existing
   * assignment off, `replace` clears the other shifts, `remove` only deletes.
   *
   * The client did this with four chunked round trips and set arithmetic in
   * JavaScript, against a set that could change underneath it. It is one
   * transaction here.
   */
  app.post('/roster/bulk', { preHandler: app.requireAuth }, async (req) => {
    const body = filterQuery
      .merge(monthQuery)
      .extend({
        shift_id: z.string().uuid(),
        from_day: z.coerce.number().int().min(1).max(31),
        to_day: z.coerce.number().int().min(1).max(31),
        mode: z.enum(['add', 'remove', 'replace']),
      })
      .safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid bulk payload');
    const o = body.data;

    // The three modes and the day range are domain rules — see
    // domain/roster/bulk.ts. `add` in particular is a TOGGLE, which is the part
    // that disappears when this is written straight into SQL.
    const dates = rangeDates(o.year, o.month, o.from_day, o.to_day);
    const plan = planBulk(o.mode, o.shift_id);

    return asCaller(req.claims, async (tx) => {
      // The department is an OUTPUT here, not a filter: the picked members get
      // ASSIGNED to it below. Filtering targets by it would match only members
      // already in that department, so the first assignment of a month would
      // silently affect nobody.
      const where = directoryWhere({
        branchId: o.branchId,
        search: o.search,
        field: o.field,
      });
      const doInsert = plan.insert('', '', false);

      // Every CTE below reads the SAME snapshot, so `had` still sees the rows
      // `del` removes. That is what makes `add` a toggle: a day that already
      // carried the shift is deleted and then deliberately NOT re-inserted.
      const rows = await query<{ members: string; added: string; removed: string }>(tx, sql`
        with targets as (
          select d.member_id from public.member_directory d where ${where}
        ),
        days as (
          select d.date::date as date from unnest(${arrayOf(dates)}::date[]) as d(date)
        ),
        had as materialized (
          select rd.member_id, rd.date
            from public.roster_days rd
           where rd.member_id in (select member_id from targets)
             and rd.date in (select date from days)
             and rd.shift_id = ${o.shift_id}
        ),
        del as (
          delete from public.roster_days rd
           where rd.member_id in (select member_id from targets)
             and rd.date in (select date from days)
             and ${
               plan.remove({ memberId: '', date: '', shiftId: o.shift_id })
                 ? sql`rd.shift_id = ${o.shift_id}`
                 : sql`rd.shift_id <> ${o.shift_id}`
             }
          returning rd.id
        ),
        ins as (
          insert into public.roster_days (member_id, date, shift_id)
          select t.member_id, d.date, ${o.shift_id}
            from targets t cross join days d
           where ${doInsert}::boolean
             and not exists (
               select 1 from had h
                where h.member_id = t.member_id and h.date = d.date
             )
          on conflict (member_id, date, shift_id) do nothing
          returning id
        ),
        dept as (
          insert into public.member_departments (member_id, year, month, department_id)
          select t.member_id, ${o.year}, ${o.month}, ${o.departmentId ?? null}
            from targets t
           where ${Boolean(o.departmentId) && plan.assignDepartment}::boolean
          on conflict (member_id, year, month) do update
            set department_id = excluded.department_id
          returning member_id
        )
        select (select count(*) from targets) as members,
               (select count(*) from ins)     as added,
               (select count(*) from del)     as removed
      `);

      const r = rows[0]!;
      return { members: Number(r.members), added: Number(r.added), removed: Number(r.removed) };
    });
  });
};
