// Admin staff and their group/branch assignments. Replaces
// ClientApp/src/lib/api/admins.ts. Account creation/deletion lives in
// routes/auth.ts, next to the password handling it needs.
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { asCaller, query } from '../db/context.js';
import { badRequest, notFound } from '../http/errors.js';

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // Staff administration. Listing is for staff; changing a staff account or
  // its assignments is superadmin — the same split profiles_update_superadmin
  // and assignments_write_superadmin make, said where the route is.
  app.get('/admins', { preHandler: app.requireRole('admin', 'superadmin') }, async (req) =>
    asCaller(req.claims, async (tx) => {
      const rows = await query(tx, sql`
        select id, full_name, national_id, phone, role, permissions
          from public.profiles
         where role in ('admin', 'superadmin')
         order by full_name, id
      `);
      return rows;
    }),
  );

  app.get('/admins/assignments', { preHandler: app.requireRole('admin', 'superadmin') }, async (req) =>
    asCaller(req.claims, async (tx) => {
      const rows = await query(tx, sql`
        select aa.id, aa.admin_id, aa.group_id, aa.branch_id,
               case when g.id is null then null
                    else jsonb_build_object('name', g.name) end as "group",
               case when b.id is null then null
                    else jsonb_build_object('name', b.name) end as branch
          from public.admin_assignments aa
          left join public.groups   g on g.id = aa.group_id
          left join public.branches b on b.id = aa.branch_id
         order by aa.id
      `);
      return rows;
    }),
  );

  app.patch('/admins/:id', { preHandler: app.requireRole('superadmin') }, async (req) => {
    const { id } = req.params as { id: string };
    const body = z
      .object({
        full_name: z.string().trim().min(1),
        national_id: z.string().trim().min(1),
        phone: z.string().nullish(),
        // `permissions` is jsonb and shaped by the client's Permissions type;
        // the policies decide who may write it at all.
        permissions: z.unknown().optional(),
      })
      .safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid admin payload');
    const b = body.data;

    return asCaller(req.claims, async (tx) => {
      const setPermissions = b.permissions !== undefined;
      const rows = await query<{ id: string }>(tx, sql`
        update public.profiles
           set full_name = ${b.full_name},
               national_id = ${b.national_id},
               phone = ${b.phone || null},
               permissions = case when ${setPermissions}::boolean
                                  then ${setPermissions ? JSON.stringify(b.permissions) : null}::jsonb
                                  else permissions end
         where id = ${id}
        returning id
      `);
      if (!rows[0]) throw notFound();
      return { ok: true };
    });
  });

  app.post('/admins/assignments', { preHandler: app.requireRole('superadmin') }, async (req, reply) => {
    const body = z
      .object({
        admin_id: z.string().uuid(),
        group_id: z.string().uuid().nullish(),
        branch_id: z.string().uuid().nullish(),
      })
      .safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid assignment payload');
    const b = body.data;

    const row = await asCaller(req.claims, async (tx) => {
      const rows = await query<{ id: string }>(tx, sql`
        insert into public.admin_assignments (admin_id, group_id, branch_id)
        values (${b.admin_id}, ${b.group_id ?? null}, ${b.branch_id ?? null})
        returning id
      `);
      return rows[0];
    });
    reply.code(201);
    return row;
  });

  app.delete('/admins/assignments/:id', { preHandler: app.requireRole('superadmin') }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await asCaller(req.claims, async (tx) => {
      const rows = await query<{ id: string }>(tx, sql`
        delete from public.admin_assignments where id = ${id} returning id
      `);
      if (!rows[0]) throw notFound();
    });
    reply.code(204);
  });
};
