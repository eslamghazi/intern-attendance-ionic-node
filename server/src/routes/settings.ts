// App-wide settings (the single app_settings row, id = 1). Replaces
// ClientApp/src/lib/api/settings.ts.
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import { asCaller, asService, query } from '../db/context.js';
import * as auth from '../services/authService.js';
import { badRequest } from '../http/errors.js';

/**
 * The only columns a client may write. This mirrors EDITABLE_FIELDS in the
 * client module — but here it is enforced, not merely intended: app_settings
 * also holds the master password hash and the shift defaults the recorder
 * trusts, and none of those may be reachable from a request body.
 */
const EDITABLE = [
  'face_match_threshold',
  'liveness_required',
  'liveness_mode',
  'default_radius_meters',
  'max_accuracy_meters',
  'late_grace_minutes',
  'require_play_integrity',
  'bypass_face',
  'bypass_location',
  'store_face_images',
  'store_probe_images',
  'qr_requires_member',
  'qr_allow_image',
  'qr_validity_seconds',
  'qr_bypass_minutes',
  'enforce_shift_window',
  'auto_leave_work',
  'bypass_checkout_window',
  'capture_hold_seconds',
  'org_name',
  'org_logo_url',
  'terminology',
  'member_photos',
  'show_out_of_range_map',
  'block_dev_options',
  'location_ip_max_km',
  'web_detect_frozen_gps',
  'checkin_method',
] as const;

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/settings', async (req) =>
    asCaller(req.claims, async (tx) => {
      // Zero rows is a legitimate answer, not an error: an unauthenticated
      // request is filtered by RLS and the client falls back to its defaults.
      const rows = await query(tx, sql`select * from public.app_settings where id = 1`);
      return rows[0] ?? null;
    }),
  );

  /** Branding shown before sign-in, exposed to `anon` by the SQL function. */
  /**
   * The organisation's name and logo, shown on the sign-in screen before anyone
   * has a session.
   *
   * Read with asService and a fixed column list, not through RLS. `app_settings`
   * holds the master password hash and the shift defaults the recorder trusts,
   * so it is not readable by `anon` — and the old schema worked around that with
   * a SECURITY DEFINER function whose only job was to expose four columns.
   *
   * Deciding what is public is the API's job, and saying so here is plainer than
   * a database function nobody reads.
   */
  app.get('/settings/branding', async () =>
    asService(async (tx) => {
      const rows = await query<{
        org_name: string | null;
        org_logo_url: string | null;
        terminology: string | null;
        member_photos: boolean | null;
      }>(
        tx,
        sql`select org_name, org_logo_url, terminology, member_photos
              from public.app_settings where id = 1`,
      );
      return rows[0] ?? null;
    }),
  );

  app.patch('/settings', { preHandler: app.requireRole('superadmin', 'admin') }, async (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const present = EDITABLE.filter((k) => body[k] !== undefined);
    if (!present.length) throw badRequest('empty', 'nothing to update');

    return asCaller(req.claims, async (tx) => {
      const assignments = sql.join(
        present.map((k) => sql`${sql.identifier(k)} = ${body[k] ?? null}`),
        sql`, `,
      );
      await tx.execute(sql`update public.app_settings set ${assignments} where id = 1`);
      return { ok: true };
    });
  });

  /** Is a master password configured? (Never reveals the hash.) */
  app.get('/settings/master-password', { preHandler: app.requireAuth }, async () => ({
    configured: await auth.masterPasswordIsSet(),
  }));

  /**
   * Set it, or clear it with an empty string.
   *
   * set_master_password() was SECURITY DEFINER and began by re-checking
   * is_superadmin(), because a client could call it directly. requireRole has
   * already answered that, so the check is not repeated.
   */
  app.put(
    '/settings/master-password',
    { preHandler: app.requireRole('superadmin') },
    async (req) => {
      const body = z.object({ password: z.string() }).safeParse(req.body);
      if (!body.success) throw badRequest('invalid', 'password is required');
      await auth.setMasterPassword(body.data.password);
      return { ok: true };
    },
  );
};
