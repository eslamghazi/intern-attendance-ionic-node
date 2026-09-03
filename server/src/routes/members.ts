// Member accounts. Replaces the create-member Edge Function and the member
// lookups in ClientApp/src/lib/api/admin.ts.
//
// Members are standalone profiles — no auth.users row. They sign in with their
// national ID through /auth/login, which checks profiles.password_hash.
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { asCaller, asService, qualified, query, type DbContext } from '../db/context.js';
import { requireMember, scopeOf } from '../services/accessService.js';
import { coversUnit } from '../domain/access/scope.js';
import { parseNationalId } from '../domain/identity/nationalId.js';
import {
  directoryWhere,
  filteredMemberIds,
  filteredProfileIds,
  MAX_PAGE_SIZE,
  type MemberFilters,
} from '../domain/member/filter.js';
import { badRequest, notFound } from '../http/errors.js';

/* ------------------------------------------------------------------ shapes */

/** Query params shared by every filtered endpoint. Booleans arrive as strings. */
const bool = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((v) => v === true || v === 'true');

export const filterQuery = z.object({
  branchId: z.string().uuid().nullish(),
  search: z.string().default(''),
  field: z.enum(['name', 'national_id', 'code']).default('name'),
  bypass_face: bool.optional(),
  bypass_location: bool.optional(),
  frozen: bool.optional(),
  has_face: bool.optional(),
  is_active: bool.optional(),
  departmentId: z.string().uuid().nullish(),
  year: z.coerce.number().int().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
});

const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  // See MAX_PAGE_SIZE: the cap must clear the client's export page size, or
  // every export fails validation instead of downloading.
  page_size: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
});

interface DirectoryRow {
  member_id: string;
  profile_id: string;
  group_id: string;
  branch_id: string;
  is_active: boolean;
  bypass_face: boolean;
  bypass_location: boolean;
  bypass_checkout_window: boolean;
  frozen_at: string | null;
  can_generate_qr: boolean;
  can_make_roster: boolean;
  can_reset_face: boolean;
  has_face: boolean;
  member_code: string | null;
  full_name: string;
  national_id: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  group_name: string | null;
  branch_name: string | null;
}

interface MemberPageItem {
  member_id: string;
  full_name: string;
  national_id: string;
  member_code: string | null;
}

/** Flat directory columns -> the nested row the grid renders. */
function toMemberRow(r: DirectoryRow) {
  return {
    id: r.member_id,
    profile_id: r.profile_id,
    group_id: r.group_id,
    branch_id: r.branch_id,
    is_active: r.is_active,
    bypass_face: r.bypass_face,
    bypass_location: r.bypass_location,
    bypass_checkout_window: r.bypass_checkout_window,
    frozen_at: r.frozen_at,
    can_generate_qr: r.can_generate_qr,
    can_make_roster: r.can_make_roster,
    can_reset_face: r.can_reset_face,
    enrolled: r.has_face,
    member_code: r.member_code,
    avatar_url: r.avatar_url,
    profile: {
      full_name: r.full_name,
      national_id: r.national_id,
      phone: r.phone,
      email: r.email,
    },
    group: r.group_name ? { name: r.group_name } : null,
    branch: r.branch_name ? { name: r.branch_name } : null,
  };
}

/** Columns of `members` a single-member edit may write. */
const MEMBER_COLUMNS = [
  'group_id',
  'branch_id',
  'is_active',
  'bypass_face',
  'bypass_location',
  'bypass_checkout_window',
  'frozen_at',
  'can_generate_qr',
  'can_make_roster',
  'can_reset_face',
] as const;

const updateSchema = z.object({
  profile_id: z.string().uuid(),
  full_name: z.string().trim().min(1),
  national_id: z.string().trim().min(1),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  avatar_url: z.string().nullish(),
  group_id: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
  bypass_face: z.boolean().optional(),
  bypass_location: z.boolean().optional(),
  bypass_checkout_window: z.boolean().optional(),
  frozen_at: z.string().nullable().optional(),
  can_generate_qr: z.boolean().optional(),
  can_make_roster: z.boolean().optional(),
  can_reset_face: z.boolean().optional(),
});

async function updateColumns(
  tx: DbContext,
  table: 'profiles' | 'members',
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const assignments = sql.join(
    Object.entries(patch).map(([k, v]) => sql`${sql.identifier(k)} = ${v}`),
    sql`, `,
  );
  const rows = await query<{ id: string }>(tx, sql`
    update ${qualified(table)} set ${assignments} where id = ${id} returning id
  `);
  // Zero rows means no such id, or a policy hid it. Either way the caller may
  // only be told "not found".
  if (!rows[0]) throw notFound();
}

const memberInput = z.object({
  national_id: z.string().trim(),
  full_name: z.string().trim(),
  phone: z.string().nullish(),
  email: z.string().nullish(),
  group_id: z.string().uuid(),
  branch_id: z.string().uuid(),
});

type MemberInput = z.infer<typeof memberInput>;

interface ItemResult {
  national_id: string;
  ok: boolean;
  /** True when an existing member was edited rather than created. */
  updated?: boolean;
  error?: string;
}

/**
 * Upsert one member by national ID. Returns a per-row result instead of
 * throwing: a spreadsheet import of 300 rows must not be abandoned because row
 * 12 has a typo.
 */
async function upsertMember(tx: DbContext, callerId: string, input: MemberInput): Promise<ItemResult> {
  const nid = input.national_id;
  if (!parseNationalId(nid).valid) {
    return { national_id: nid, ok: false, error: 'invalid_national_id' };
  }
  if (!input.full_name) return { national_id: nid, ok: false, error: 'missing_name' };

  const existing = await query<{ id: string; role: string }>(tx, sql`
    select id, role from public.profiles where national_id = ${nid} limit 1
  `);

  if (existing[0]) {
    if (existing[0].role !== 'member') {
      return { national_id: nid, ok: false, error: 'national_id_belongs_to_staff' };
    }
    await tx.execute(sql`
      update public.profiles
         set full_name = ${input.full_name},
             phone = ${input.phone ?? null},
             email = ${input.email ?? null}
       where id = ${existing[0].id}
    `);
    await tx.execute(sql`
      update public.members
         set group_id = ${input.group_id}, branch_id = ${input.branch_id}
       where profile_id = ${existing[0].id}
    `);
    return { national_id: nid, ok: true, updated: true };
  }

  const created = await query<{ id: string }>(tx, sql`
    insert into public.profiles
      (role, full_name, national_id, phone, email, must_change_password, created_by)
    values ('member', ${input.full_name}, ${nid}, ${input.phone ?? null},
            ${input.email ?? null}, false, ${callerId})
    returning id
  `);

  await tx.execute(sql`
    insert into public.members (profile_id, group_id, branch_id)
    values (${created[0]!.id}, ${input.group_id}, ${input.branch_id})
  `);

  return { national_id: nid, ok: true };
}

export const memberRoutes: FastifyPluginAsync = async (app) => {
  /** Create or update one or many members. */
  app.post(
    '/members',
    { preHandler: app.requireRole('admin', 'superadmin') },
    async (req) => {
      const body = z
        .union([z.object({ members: z.array(memberInput) }), memberInput])
        .safeParse(req.body);
      if (!body.success) throw badRequest('invalid', 'invalid member payload');
      const items = 'members' in body.data ? body.data.members : [body.data];
      const callerId = req.caller!.id;

      // The uploader's reach, read ONCE.
      //
      // This used to sit inside the loop, so a 300-student roster made 300
      // identical queries against admin_assignments for something that cannot
      // change during a single request. Start of term is the heaviest thing
      // this system does and the one an administrator watches a spinner
      // through; it does not need to be 300 round trips slower than necessary.
      //
      // The per-row TRANSACTION stays — that is protecting something real.
      const scope = await asService((tx) => scopeOf(tx, req.caller!));

      const results: ItemResult[] = [];
      for (const item of items) {
        // Service role, so members_update_admin — the policy that says an
        // assigned admin only touches their own branches and groups — is not in
        // the path. Checked per row against the scope resolved above, so a
        // roster that strays outside the uploader's assignments reports which
        // rows were refused instead of failing whole.
        if (!coversUnit(scope, { branchId: item.branch_id, groupId: item.group_id })) {
          results.push({
            national_id: item.national_id,
            ok: false,
            error: 'outside your assignments',
          });
          continue;
        }

        // One transaction PER ROW: a failure must roll back only that member's
        // half-written profile, not the 299 rows already imported. The Edge
        // Function compensated by hand — deleting the orphan profile — and would
        // leave one behind if that delete also failed.
        try {
          results.push(await asService((tx) => upsertMember(tx, callerId, item)));
        } catch (err) {
          results.push({
            national_id: item.national_id,
            ok: false,
            error: (err as Error).message,
          });
        }
      }

      return {
        created: results.filter((r) => r.ok && !r.updated).length,
        updated: results.filter((r) => r.ok && r.updated).length,
        total: results.length,
        results,
      };
    },
  );

  /** Existing national IDs — the import screen uses these to preview conflicts. */
  app.get(
    '/members/national-ids',
    { preHandler: app.requireRole('admin', 'superadmin') },
    async (req) =>
      asCaller(req.claims, async (tx) => {
        const rows = await query<{ national_id: string }>(tx, sql`
          select national_id from public.profiles
           where role = 'member' and national_id is not null
           order by id
        `);
        return rows.map((r) => r.national_id);
      }),
  );

  /* ------------------------------------------------------------------ reads */

  /**
   * One page of full member rows for the admin grid. The response is already in
   * the nested shape the UI renders, so the client no longer reshapes 20 flat
   * directory columns by hand on every page turn.
   */
  app.get('/members', { preHandler: app.requireAuth }, async (req) => {
    const q = filterQuery.merge(pageQuery).safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'invalid query');
    const { page, page_size: pageSize, ...filters } = q.data;
    const offset = (page - 1) * pageSize;

    return asCaller(req.claims, async (tx) => {
      const where = directoryWhere(filters);
      // count(*) OVER () rides along with the page: one query where PostgREST
      // needed a separate exact-count request.
      const rows = await query<DirectoryRow & { total: string }>(tx, sql`
        select d.member_id, d.profile_id, d.group_id, d.branch_id, d.is_active,
               d.bypass_face, d.bypass_location, d.bypass_checkout_window, d.frozen_at,
               d.can_generate_qr, d.can_make_roster, d.can_reset_face, d.has_face,
               d.member_code, d.full_name, d.national_id, d.phone, d.email,
               d.avatar_url, d.group_name, d.branch_name,
               count(*) over () as total
          from public.member_directory d
         where ${where}
         order by d.full_name, d.member_id
         limit ${pageSize} offset ${offset}
      `);

      return {
        rows: rows.map(toMemberRow),
        total: rows.length ? Number(rows[0]!.total) : 0,
      };
    });
  });

  /** A lightweight page — id, name, national id, code — for the roster grids. */
  app.get('/members/page', { preHandler: app.requireAuth }, async (req) => {
    const q = filterQuery.merge(pageQuery).safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'invalid query');
    const { page, page_size: pageSize, ...filters } = q.data;
    const offset = (page - 1) * pageSize;

    return asCaller(req.claims, async (tx) => {
      const rows = await query<MemberPageItem & { total: string }>(tx, sql`
        select d.member_id, d.full_name, d.national_id, d.member_code,
               count(*) over () as total
          from public.member_directory d
         where ${directoryWhere(filters)}
         order by d.full_name, d.member_id
         limit ${pageSize} offset ${offset}
      `);
      return {
        items: rows.map(({ total: _total, ...item }) => item),
        total: rows.length ? Number(rows[0]!.total) : 0,
      };
    });
  });

  /** How many filtered members carry each flag — drives the bulk menu's state. */
  app.get('/members/flag-stats', { preHandler: app.requireAuth }, async (req) => {
    const q = filterQuery.safeParse(req.query);
    if (!q.success) throw badRequest('invalid', 'invalid query');

    return asCaller(req.claims, async (tx) => {
      // Four counts in one pass. The client fired four HEAD requests in
      // parallel; one scan answers all of them.
      const rows = await query<{
        total: string;
        bypass_face: string;
        bypass_location: string;
        frozen: string;
      }>(tx, sql`
        select count(*)                                          as total,
               count(*) filter (where d.bypass_face)             as bypass_face,
               count(*) filter (where d.bypass_location)         as bypass_location,
               count(*) filter (where d.frozen_at is not null)   as frozen
          from public.member_directory d
         where ${directoryWhere(q.data)}
      `);
      const r = rows[0]!;
      return {
        total: Number(r.total),
        bypass_face: Number(r.bypass_face),
        bypass_location: Number(r.bypass_location),
        frozen: Number(r.frozen),
      };
    });
  });

  app.get('/members/count-active', { preHandler: app.requireAuth }, async (req) =>
    asCaller(req.claims, async (tx) => {
      const rows = await query<{ count: string }>(tx, sql`
        select count(*) as count from public.members where is_active = true
      `);
      return { count: Number(rows[0]!.count) };
    }),
  );

  /** The signed-in member's own row id — the enrolment fallback path. */
  app.get('/members/by-profile/:profileId', { preHandler: app.requireAuth }, async (req) => {
    const { profileId } = req.params as { profileId: string };
    return asCaller(req.claims, async (tx) => {
      const rows = await query<{ id: string }>(tx, sql`
        select id from public.members where profile_id = ${profileId} limit 1
      `);
      return { id: rows[0]?.id ?? null };
    });
  });

  /* ----------------------------------------------------------------- writes */

  /** Edit one member: the profile half and the member half, atomically. */
  app.patch('/members/:id', { preHandler: app.requireAuth }, async (req) => {
    const body = updateSchema.safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid member payload');
    const { id } = req.params as { id: string };
    const b = body.data;

    return asCaller(req.claims, async (tx) => {
      // One transaction: the Edge-era code issued two independent updates, so a
      // failure on the second left the profile renamed but the member unmoved.
      const profileSet: Record<string, unknown> = {
        full_name: b.full_name,
        national_id: b.national_id,
        phone: b.phone || null,
        email: b.email || null,
      };
      if (b.avatar_url !== undefined) profileSet.avatar_url = b.avatar_url;
      await updateColumns(tx, 'profiles', b.profile_id, profileSet);

      const memberSet: Record<string, unknown> = {};
      for (const k of MEMBER_COLUMNS) if (b[k] !== undefined) memberSet[k] = b[k];
      if (Object.keys(memberSet).length) await updateColumns(tx, 'members', id, memberSet);

      return { ok: true };
    });
  });

  /**
   * Deleting the profile cascades to the member row, attendance and roster.
   *
   * Addressed by PROFILE id, not member id — and said so in the path, because
   * `/members/:id` already means the member id for PATCH and one path meaning
   * two different identifiers is how the wrong person gets deleted.
   */
  app.delete(
    '/members/by-profile/:profileId',
    { preHandler: app.requireRole('admin', 'superadmin') },
    async (req, reply) => {
    const { profileId } = req.params as { profileId: string };
    await asCaller(req.claims, async (tx) => {
      // The most destructive route in the API, and until now the check was
      // entirely in profiles_delete_member_by_admin. With RLS off, an admin
      // scoped to one branch erased a member of another — proven, not argued.
      const member = await query<{ id: string }>(tx, sql`
        select id from public.members where profile_id = ${profileId} limit 1
      `);
      if (member[0]) await requireMember(tx, req.caller!, member[0].id);
      const rows = await query<{ id: string }>(tx, sql`
        delete from public.profiles where id = ${profileId} returning id
      `);
      if (!rows[0]) throw notFound();
      });
      reply.code(204);
    },
  );

  /* ------------------------------------------------------------ bulk actions */

  /**
   * Apply to every member the filter matches. All three of these were, on
   * PostgREST, "download every matching id, then send it back in chunks of N" —
   * two round trips per chunk and a window where the set could change under
   * you. Here the filter is a subquery, so it is one statement.
   */
  const bulkUpdate = async (
    claims: Parameters<typeof asCaller>[0],
    filters: MemberFilters,
    patch: Record<string, unknown>,
  ) =>
    asCaller(claims, async (tx) => {
      if (!Object.keys(patch).length) return { affected: 0 };
      const assignments = sql.join(
        Object.entries(patch).map(([k, v]) => sql`${sql.identifier(k)} = ${v}`),
        sql`, `,
      );
      const rows = await query<{ id: string }>(tx, sql`
        update public.members set ${assignments}
         where id in ${filteredMemberIds(filters)}
        returning id
      `);
      return { affected: rows.length };
    });

  app.post('/members/bulk/flag', { preHandler: app.requireAuth }, async (req) => {
    const body = filterQuery
      .extend({
        flag: z.enum(['bypass_face', 'bypass_location']),
        value: z.boolean(),
      })
      .safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid bulk payload');
    const { flag, value, ...filters } = body.data;
    return bulkUpdate(req.claims, filters, { [flag]: value });
  });

  app.post('/members/bulk/frozen', { preHandler: app.requireAuth }, async (req) => {
    const body = filterQuery
      .extend({ frozen_at: z.string().nullable() })
      .safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid bulk payload');
    const { frozen_at: frozenAt, ...filters } = body.data;
    return bulkUpdate(req.claims, filters, { frozen_at: frozenAt });
  });

  app.post('/members/bulk/update', { preHandler: app.requireAuth }, async (req) => {
    const body = filterQuery
      .extend({
        group_id: z.string().uuid().optional(),
        branch_id: z.string().uuid().optional(),
        is_active: z.boolean().optional(),
      })
      .safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid bulk payload');
    const { group_id: groupId, branch_id: branchId, is_active: isActive, ...filters } = body.data;
    const patch: Record<string, unknown> = {};
    if (groupId) patch.group_id = groupId;
    if (branchId) patch.branch_id = branchId;
    if (isActive !== undefined) patch.is_active = isActive;
    return bulkUpdate(req.claims, filters, patch);
  });

  app.post(
    '/members/bulk/delete',
    { preHandler: app.requireRole('admin', 'superadmin') },
    async (req) => {
      const body = filterQuery.safeParse(req.body);
      if (!body.success) throw badRequest('invalid', 'invalid bulk payload');
      return asCaller(req.claims, async (tx) => {
        const rows = await query<{ id: string }>(tx, sql`
          delete from public.profiles
           where id in ${filteredProfileIds(body.data)}
          returning id
        `);
        return { affected: rows.length };
      });
    },
  );
};
