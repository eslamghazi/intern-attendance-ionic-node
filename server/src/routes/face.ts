// Face enrolment and reset. Replaces the enroll-photo, reset-face and
// member-face-tool Edge Functions.
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { arrayOf, asCaller, asService, query, type DbContext } from '../db/context.js';
import { BUCKETS, decodeBase64Image, putObject, removeObjects } from '../storage/objects.js';
import { requireMember } from '../services/accessService.js';
import { isStaff } from '../domain/identity/role.js';
import { badRequest, forbidden, notFound } from '../http/errors.js';

/** Storage keys must be ASCII — Arabic group names otherwise produce "Invalid
 *  key". Keep letters/digits/_/- and collapse the rest. */
function sanitize(s: string): string {
  return String(s ?? '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'x';
}

/**
 * Clear a member's enrolment: embedding row, status flag, and both the legacy
 * uid-scoped photo and the organised group/code one. Shared by the admin reset
 * and the member-operated face tool, which had drifted into two near-copies.
 */
async function clearEnrolment(tx: DbContext, memberId: string, profileId: string): Promise<void> {
  const rows = await query<{ photo_path: string | null }>(tx, sql`
    select photo_path from public.face_templates where member_id = ${memberId} limit 1
  `);

  await tx.execute(sql`delete from public.face_templates where member_id = ${memberId}`);
  await tx.execute(sql`
    update public.members set enrollment_status = 'pending' where id = ${memberId}
  `);

  const paths = [`${profileId}/reference.jpg`];
  if (rows[0]?.photo_path) paths.push(rows[0].photo_path);
  // Same transaction: a nested one would hold a second pool connection.
  await removeObjects(BUCKETS.faces, paths, tx);
}

export const faceRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Store a member's enrolment photo under an admin-browsable path —
   * `faces/<group year>/<member code>.jpg`. A member cannot write that path
   * themselves (the bucket policy scopes them to their own uid folder), so this
   * is one of the few deliberate service-role writes.
   */
  app.post('/face/enroll-photo', { preHandler: app.requireRole('member') }, async (req) => {
    const body = z.object({ image_base64: z.string() }).safeParse(req.body);
    if (!body.success) throw badRequest('missing_image', 'image_base64 is required');

    const bytes = decodeBase64Image(body.data.image_base64);
    if (!bytes) throw badRequest('bad_base64', 'could not decode the image');
    const callerId = req.caller!.id;

    return asService(async (tx) => {
      // Respect the admin toggle: only keep enrolment images when enabled.
      const settings = await query<{ store_face_images: boolean | null }>(tx, sql`
        select store_face_images from public.app_settings where id = 1
      `);
      if (!settings[0]?.store_face_images) return { ok: true, skipped: true };

      const dir = await query<{
        member_id: string;
        group_year: number | null;
        member_code: string | null;
        national_id: string;
      }>(tx, sql`
        select member_id, group_year, member_code, national_id
          from public.member_directory where profile_id = ${callerId} limit 1
      `);
      const member = dir[0];
      if (!member) throw notFound('member_not_found');

      const folder = member.group_year ? String(member.group_year) : 'group';
      const path = `${folder}/${sanitize(member.member_code ?? member.national_id)}.jpg`;

      await putObject({
        bucket: BUCKETS.faces,
        path,
        body: bytes,
        contentType: 'image/jpeg',
        owner: callerId,
        tx,
      });

      await tx.execute(sql`
        update public.face_templates set photo_path = ${path}
         where member_id = ${member.member_id}
      `);

      return { ok: true, path };
    });
  });

  /** Admin/superadmin clears an enrolled face so the member re-captures. */
  app.post(
    '/face/reset',
    { preHandler: app.requireRole('admin', 'superadmin') },
    async (req) => {
      const body = z.object({ member_id: z.string().uuid() }).safeParse(req.body);
      if (!body.success) throw badRequest('missing', 'member_id is required');

      return asService(async (tx) => {
        // Service role, so face_delete_superadmin and the rest are not in the
        // path: requireRole alone let any admin un-enrol any member in the
        // faculty, and re-enrolment needs the person physically present.
        await requireMember(tx, req.caller!, body.data.member_id);

        const rows = await query<{ profile_id: string }>(tx, sql`
          select profile_id from public.members where id = ${body.data.member_id} limit 1
        `);
        if (!rows[0]) throw notFound('member_not_found');
        await clearEnrolment(tx, body.data.member_id, rows[0].profile_id);
        return { ok: true };
      });
    },
  );

  /**
   * The member-operated face tool: staff, or a member granted `can_reset_face`,
   * looks a student up by member code and can clear their face. A member caller
   * is hard-locked to their own branch.
   */
  const resolveScope = async (
    tx: DbContext,
    caller: { id: string; role: string },
  ): Promise<{ branchId: string | null }> => {
    if (caller.role === 'admin' || caller.role === 'superadmin') return { branchId: null };
    if (caller.role !== 'member') throw forbidden();
    const rows = await query<{ branch_id: string; can_reset_face: boolean | null }>(tx, sql`
      select branch_id, can_reset_face from public.members
       where profile_id = ${caller.id} limit 1
    `);
    if (!rows[0]?.can_reset_face) throw forbidden();
    return { branchId: rows[0].branch_id };
  };

  app.post('/face/lookup', { preHandler: app.requireAuth }, async (req) => {
    const body = z.object({ code: z.string().trim().min(1) }).safeParse(req.body);
    if (!body.success) throw badRequest('missing', 'code is required');
    const caller = req.caller!;

    return asService(async (tx) => {
      const { branchId } = await resolveScope(tx, caller);
      const rows = await query<{
        member_id: string;
        member_code: string;
        full_name: string;
        has_face: boolean;
      }>(tx, sql`
        select member_id, member_code, full_name, has_face
          from public.member_directory
         where member_code = ${body.data.code}
           and (${branchId}::uuid is null or branch_id = ${branchId})
         limit 1
      `);
      const row = rows[0];
      if (!row) return { found: false };
      return {
        found: true,
        member_id: row.member_id,
        member_code: row.member_code,
        full_name: row.full_name,
        enrolled: Boolean(row.has_face),
      };
    });
  });

  /* ------------------------------------------------------------- templates */

  /** The member's enrolled embedding, for on-device matching. */
  app.get('/face/templates/:memberId', { preHandler: app.requireAuth }, async (req) => {
    const { memberId } = req.params as { memberId: string };
    return asCaller(req.claims, async (tx) => {
      const rows = await query<{ embedding: unknown }>(tx, sql`
        select embedding from public.face_templates where member_id = ${memberId} limit 1
      `);
      return { embedding: rows[0]?.embedding ?? null };
    });
  });

  /** Store an embedding. pgvector's literal form is built on the client, which
   *  is where the vector is produced; it is bound as a parameter here. */
  app.put('/face/templates/:memberId', { preHandler: app.requireAuth }, async (req) => {
    const { memberId } = req.params as { memberId: string };
    const body = z
      .object({
        embedding: z.string().min(3),
        photo_path: z.string().nullish(),
        quality_score: z.number().nullish(),
      })
      .safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'invalid template payload');
    const b = body.data;

    return asCaller(req.claims, async (tx) => {
      await tx.execute(sql`
        insert into public.face_templates (member_id, embedding, photo_path, quality_score)
        values (${memberId}, ${b.embedding}::vector, ${b.photo_path ?? null},
                ${b.quality_score ?? null})
        on conflict (member_id) do update
          set embedding = excluded.embedding,
              photo_path = excluded.photo_path,
              quality_score = excluded.quality_score
      `);
      return { ok: true };
    });
  });

  /** The stored enrolment photo of each given member (admins only, per RLS). */
  app.post('/face/templates/photos', { preHandler: app.requireAuth }, async (req) => {
    const body = z.object({ member_ids: z.array(z.string().uuid()) }).safeParse(req.body);
    if (!body.success) throw badRequest('invalid', 'member_ids is required');
    if (!body.data.member_ids.length) return [];

    return asCaller(req.claims, async (tx) => {
      const rows = await query(tx, sql`
        select member_id, photo_path, created_at
          from public.face_templates
         where member_id = any(${arrayOf(body.data.member_ids)}::uuid[])
      `);
      return rows;
    });
  });

  /** Every stored enrolment-photo path (admins only, per RLS). */
  app.get(
    '/face/templates/photo-paths',
    { preHandler: app.requireRole('admin', 'superadmin') },
    async (req) =>
      asCaller(req.claims, async (tx) => {
        const rows = await query<{ photo_path: string }>(tx, sql`
          select photo_path from public.face_templates where photo_path is not null
        `);
        return rows.map((r) => r.photo_path);
      }),
  );

  app.post('/face/tool-reset', { preHandler: app.requireAuth }, async (req) => {
    const body = z.object({ member_id: z.string().uuid() }).safeParse(req.body);
    if (!body.success) throw badRequest('missing', 'member_id is required');
    const caller = req.caller!;

    return asService(async (tx) => {
      const { branchId } = await resolveScope(tx, caller);
      const rows = await query<{ profile_id: string; branch_id: string }>(tx, sql`
        select profile_id, branch_id from public.members
         where id = ${body.data.member_id} limit 1
      `);
      const member = rows[0];
      if (!member) throw notFound('member_not_found');
      // A MEMBER granted can_reset_face is pinned to their own branch by
      // privilegeScope above. Staff got no restriction at all, so an admin
      // assigned to one branch could clear enrolments across the faculty.
      if (branchId && member.branch_id !== branchId) throw forbidden();
      if (isStaff(caller.role)) await requireMember(tx, caller, body.data.member_id);

      await clearEnrolment(tx, body.data.member_id, member.profile_id);
      return { ok: true };
    });
  });
};
