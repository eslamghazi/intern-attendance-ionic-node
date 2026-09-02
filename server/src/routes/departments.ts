// Departments catalog + the per-member MONTHLY department assignment.
// Replaces ClientApp/src/lib/api/departments.ts.
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { asCaller, query } from '../db/context.js';
import { badRequest, notFound } from '../http/errors.js';

export const departmentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/departments', async (req) =>
    asCaller(req.claims, async (tx) => {
      // The branch name is joined here rather than reshaped on the client, so
      // the response is already the flat { branch_name } the UI wants.
      const rows = await query(tx, sql`
        select d.id, d.name, d.branch_id, b.name as branch_name
          from public.departments d
          left join public.branches b on b.id = d.branch_id
         order by d.name, d.id
      `);
      return rows;
    }),
  );

  app.get('/departments/options', async (req) => {
    const { branch_id: branchId } = req.query as { branch_id?: string };
    return asCaller(req.claims, async (tx) => {
      const rows = await query(tx, sql`
        select id, name from public.departments
         where (${branchId ?? null}::uuid is null or branch_id = ${branchId ?? null})
         order by name, id
      `);
      return rows;
    });
  });

  app.put('/departments', { preHandler: app.requireAuth }, async (req) => {
    const body = z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1),
        branch_id: z.string().uuid().nullable(),
      })
      .safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid department payload');
    const d = body.data;

    return asCaller(req.claims, async (tx) => {
      const { rows } = d.id
        ? await tx.execute<{ id: string }>(sql`
            insert into public.departments (id, name, branch_id)
            values (${d.id}, ${d.name}, ${d.branch_id})
            on conflict (id) do update
              set name = excluded.name, branch_id = excluded.branch_id
            returning id
          `)
        : await tx.execute<{ id: string }>(sql`
            insert into public.departments (name, branch_id)
            values (${d.name}, ${d.branch_id})
            returning id
          `);
      return rows[0];
    });
  });

  app.delete('/departments/:id', { preHandler: app.requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await asCaller(req.claims, async (tx) => {
      const rows = await query<{ id: string }>(tx, sql`
        delete from public.departments where id = ${id} returning id
      `);
      if (!rows[0]) throw notFound();
    });
    reply.code(204);
  });

  /** Every member's department for one month, as { member_id: department_id }. */
  app.get('/member-departments', async (req) => {
    const q = z
      .object({ year: z.coerce.number().int(), month: z.coerce.number().int().min(1).max(12) })
      .safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'year and month are required');

    return asCaller(req.claims, async (tx) => {
      const rows = await query<{ member_id: string; department_id: string }>(tx, sql`
        select member_id, department_id from public.member_departments
         where year = ${q.data.year} and month = ${q.data.month}
         order by member_id
      `);
      return Object.fromEntries(rows.map((r) => [r.member_id, r.department_id]));
    });
  });

  /** Set, or clear when department_id is null, one member's month. */
  app.put('/member-departments', { preHandler: app.requireAuth }, async (req) => {
    const body = z
      .object({
        member_id: z.string().uuid(),
        year: z.coerce.number().int(),
        month: z.coerce.number().int().min(1).max(12),
        department_id: z.string().uuid().nullable(),
      })
      .safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid assignment payload');
    const b = body.data;

    return asCaller(req.claims, async (tx) => {
      if (!b.department_id) {
        await tx.execute(sql`
          delete from public.member_departments
           where member_id = ${b.member_id} and year = ${b.year} and month = ${b.month}
        `);
        return { ok: true, cleared: true };
      }
      await tx.execute(sql`
        insert into public.member_departments (member_id, year, month, department_id)
        values (${b.member_id}, ${b.year}, ${b.month}, ${b.department_id})
        on conflict (member_id, year, month) do update
          set department_id = excluded.department_id
      `);
      return { ok: true };
    });
  });
};
