// File upload and download URLs. Replaces supabase.storage on the client.
//
// The permission question is answered in domain/access/attachment.ts and
// enforced by storage/objects.ts, which checks every caller-supplied path
// before it touches the index or the disk.
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { FastifyPluginAsync } from 'fastify';
import {
  BUCKETS,
  isPublicBucket,
  openObject,
  signedUrl,
  signedUrls,
  putObject,
  removeObjects,
  type Bucket,
} from '../storage/objects.js';
import { verify } from '../storage/signing.js';
import { arrayOf, asService } from '../db/context.js';
import { ApiError, badRequest, notFound } from '../http/errors.js';

const bucketParam = z.enum([BUCKETS.faces, BUCKETS.probes, BUCKETS.avatars]);

/** Reject traversal and absolute paths before they reach the object store. */
const objectPath = z
  .string()
  .min(1)
  .max(512)
  .refine((p) => !p.startsWith('/') && !p.split('/').includes('..'), 'invalid path');

export const storageRoutes: FastifyPluginAsync = async (app) => {
  /**
   * Upload one object. The body is base64 rather than multipart because that is
   * what the capture pipeline already produces — a canvas data URL — so this
   * avoids a Blob round trip on the phone.
   */
  app.post('/storage/:bucket', { preHandler: app.requireAuth }, async (req, reply) => {
    const params = z.object({ bucket: bucketParam }).safeParse(req.params);
    const body = z
      .object({
        path: objectPath,
        content_base64: z.string().min(1),
        content_type: z.string().default('image/jpeg'),
      })
      .safeParse(req.body);
    if (!params.success || !body.success) throw badRequest('invalid', 'invalid upload');

    const bytes = Buffer.from(body.data.content_base64.split(',').pop() ?? '', 'base64');
    if (!bytes.length) throw badRequest('bad_base64', 'could not decode the payload');

    const result = await putObject({
      bucket: params.data.bucket as Bucket,
      path: body.data.path,
      body: bytes,
      contentType: body.data.content_type,
      owner: req.caller!.id,
      // Written under the caller's own RLS context: the bucket's INSERT policy
      // decides whether this path is theirs to write.
      claims: req.claims,
    });
    reply.code(201);
    return result;
  });

  /** A time-limited download URL, or a plain one for a public bucket. */
  app.get('/storage/:bucket/url', async (req) => {
    const params = z.object({ bucket: bucketParam }).safeParse(req.params);
    const query = z.object({ path: objectPath }).safeParse(req.query);
    if (!params.success || !query.success) throw badRequest('invalid', 'invalid request');
    return {
      url: await signedUrl(req.claims, params.data.bucket as Bucket, query.data.path),
    };
  });

  /**
   * Sign MANY paths in one round trip. The admin galleries would otherwise fire
   * one request per thumbnail. A path the caller may not see is simply absent
   * from the map — the same "deleted file" shape the client already handles.
   */
  app.post('/storage/:bucket/urls', async (req) => {
    const params = z.object({ bucket: bucketParam }).safeParse(req.params);
    const body = z
      .object({ paths: z.array(objectPath), expires_in: z.number().int().positive().optional() })
      .safeParse(req.body);
    if (!params.success || !body.success) throw badRequest('invalid', 'invalid request');

    // One query for the whole batch — see the note on signedUrls().
    return signedUrls(
      req.claims,
      params.data.bucket as Bucket,
      body.data.paths,
      body.data.expires_in,
    );
  });

  /**
   * Serve the bytes. The endpoint every URL from signedUrl()/signedUrls()
   * points at — and the one thing this module was missing: the URLs were being
   * minted and handed to the client, and nothing answered them, so no stored
   * image rendered anywhere in the app.
   *
   * DELIBERATELY UNAUTHENTICATED. The admin galleries put these straight into
   * `<img src>`, and an <img> cannot send an Authorization header, so the
   * permission travels in the URL instead — an HMAC over (bucket, path,
   * expiry). See storage/signing.ts.
   *
   * The signature is not a second opinion about permission: the URL is only
   * ever minted after the caller's own RLS context proved the row visible to
   * them. It is a bearer token for one file, for an hour.
   */
  app.get('/storage/:bucket/object', async (req, reply) => {
    const params = z.object({ bucket: bucketParam }).safeParse(req.params);
    const query = z
      .object({
        path: objectPath,
        expires: z.coerce.number().int().optional(),
        signature: z.string().optional(),
      })
      .safeParse(req.query);
    if (!params.success || !query.success) throw notFound('object not found');

    const bucket = params.data.bucket as Bucket;
    const { path, expires, signature } = query.data;

    if (!isPublicBucket(bucket)) {
      // 404 for a bad signature rather than 403: a caller holding a forged
      // token learns nothing about whether the file exists.
      if (expires === undefined || !signature) throw notFound('object not found');
      const result = verify(bucket, path, expires, signature);
      if (result === 'expired') {
        // Told apart from `invalid` on purpose — this one the client can fix by
        // asking for a fresh URL, and 410 is the answer that says so.
        throw new ApiError(410, 'url_expired', 'this link has expired');
      }
      if (result !== 'ok') throw notFound('object not found');
    }

    const object = await openObject(bucket, path);
    reply
      .header('content-type', object.contentType)
      .header('content-length', object.size)
      .header('content-disposition', 'inline')
      // A face capture must not sit in a shared proxy. The public avatars may,
      // briefly — they are shown next to a name in lists anyone can see.
      .header(
        'cache-control',
        isPublicBucket(bucket) ? 'public, max-age=300' : 'private, no-store',
      );
    return reply.send(object.stream);
  });

  /**
   * Bulk delete: the FILES, and then the columns that pointed at them, so no
   * row is left referencing something that is gone.
   *
   * The face EMBEDDING is deliberately untouched — removing a stored photo must
   * not un-enroll anyone. Clearing the columns goes through clear_image_paths()
   * because neither table is client-writable.
   */
  app.delete(
    '/storage/:bucket',
    { preHandler: app.requireRole('admin', 'superadmin') },
    async (req) => {
      const params = z.object({ bucket: bucketParam }).safeParse(req.params);
      const body = z.object({ paths: z.array(objectPath) }).safeParse(req.body);
      if (!params.success || !body.success) throw badRequest('invalid', 'invalid request');

      const paths = [...new Set(body.data.paths.filter(Boolean))];
      if (!paths.length) return { removed: 0 };

      await removeObjects(params.data.bucket as Bucket, paths);

      // Clearing the columns that pointed at the deleted files. This was a
      // SECURITY DEFINER function whose first line re-checked `is_admin()` —
      // it had to, because the client called it directly. The route's own
      // requireRole already answered that, so the check is not repeated.
      //
      // The face EMBEDDING is deliberately untouched: removing a stored photo
      // must not un-enroll anyone.
      await asService(async (tx) => {
        await tx.execute(sql`
          update public.face_templates set photo_path = null
           where photo_path = any(${arrayOf(paths)}::text[])
        `);
        await tx.execute(sql`
          update public.attendance set check_in_probe_path = null
           where check_in_probe_path = any(${arrayOf(paths)}::text[])
        `);
        await tx.execute(sql`
          update public.attendance set check_out_probe_path = null
           where check_out_probe_path = any(${arrayOf(paths)}::text[])
        `);
      });

      return { removed: paths.length };
    },
  );
};
