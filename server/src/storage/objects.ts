// Object storage — files on disk, index in Postgres.
//
// Two halves, kept in sync:
//   bytes -> STORAGE_DIR/<bucket>/<path>
//   index -> public.attachments, which the eleven bucket policies read. Keeping
//            the row means "may this caller see this object?" is still answered
//            by the database.
//
// So a download is: ask the DB under the caller's RLS context whether the row
// is visible; if it is, hand back a short-lived signed URL (see signing.ts).
// If a policy hides the row, no URL is ever minted.
//
// This used to be storage.objects and storage.buckets — Supabase Storage's own
// tables, for a service that is not running here. Nothing else about the shape
// changed; see migration 0004.
//
// The directory MUST NOT be inside a web root. These are biometric images; if
// nginx can serve them directly, every RLS policy above is decoration.
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../env.js';
import { asCaller, asService, type DbContext } from '../db/context.js';
import * as data from '../data/attachments.js';
import { mayTouchAttachment } from '../domain/access/attachment.js';
import type { Role } from '../domain/identity/role.js';
import type { JwtClaims } from '../db/context.js';
import { forbidden, notFound } from '../http/errors.js';
import { signedPath } from './signing.js';

export const BUCKETS = {
  faces: 'faces',
  probes: 'probes',
  avatars: 'avatars',
} as const;

export type Bucket = (typeof BUCKETS)[keyof typeof BUCKETS];

/**
 * Buckets served without a signed URL.
 *
 * This was a `public` column on storage.buckets — a value in a table any
 * migration could flip, guarding biometric images. It is a constant now, so
 * making the faces bucket world-readable takes a code change and a deploy
 * rather than one UPDATE. `avatars` is public because a profile picture is
 * shown beside a name in lists a signed-out caller can already see.
 */
const PUBLIC_BUCKETS: ReadonlySet<string> = new Set<string>([BUCKETS.avatars]);

/** Is this bucket served without a signature? */
export function isPublicBucket(bucket: string): boolean {
  return PUBLIC_BUCKETS.has(bucket);
}

/**
 * The caller, as domain/access/attachment.ts needs to see them.
 *
 * Read from the claims the auth plugin already re-issued from the database, so
 * `user_role` is the CURRENT role and not whatever an old token happens to
 * carry. Null claims mean an unauthenticated caller, who owns nothing.
 */
function callerOf(claims: JwtClaims | null): { callerId: string; role: Role } | null {
  if (!claims?.sub) return null;
  return { callerId: claims.sub, role: claims.user_role as Role };
}

const ROOT = resolve(env.STORAGE_DIR);

/**
 * Resolve an object to an absolute path, refusing anything that escapes its
 * bucket. The route validates the path too, but this is the last line: a
 * traversal here reads arbitrary files off the server.
 */
function locate(bucket: string, path: string): string {
  const full = resolve(join(ROOT, bucket, normalize(path)));
  const bucketRoot = resolve(join(ROOT, bucket));
  if (full !== bucketRoot && !full.startsWith(bucketRoot + sep)) {
    throw notFound('object not found');
  }
  return full;
}

/**
 * Create the bucket directories at start-up.
 *
 * This read the bucket list out of storage.buckets, which meant the API could
 * not start until the database answered — for three names that were never going
 * to be anything else.
 */
export async function ensureBuckets(): Promise<void> {
  for (const id of Object.values(BUCKETS)) await mkdir(join(ROOT, id), { recursive: true });
}

export interface PutOptions {
  bucket: Bucket;
  path: string;
  body: Buffer;
  contentType?: string;
  owner?: string | null;
  /**
   * Write under the caller's RLS context, so the bucket's INSERT/UPDATE policy
   * decides whether the path is theirs. Omit only for privileged server-side
   * writes (an enrolment photo lands on an admin-browsable path a member could
   * never write themselves).
   */
  claims?: JwtClaims | null;
  /**
   * An ALREADY-OPEN transaction. MUST be passed when calling from inside
   * asService/asCaller: opening a second one takes another connection out of
   * the pool while the first is held, which deadlocks at the 20th concurrent
   * check-in — precisely what a shift start looks like.
   */
  tx?: DbContext;
}

export async function putObject(opts: PutOptions): Promise<{ path: string }> {
  const contentType = opts.contentType ?? 'application/octet-stream';

  // A caller-supplied path is checked HERE, not only by the bucket policy.
  //
  // With RLS switched off, the end-to-end suite showed one student uploading
  // into another student's folder — because this function had no opinion and
  // simply asked the database. `opts.claims === undefined` is the privileged
  // server-side path (an admin enrolling a face into the member's folder),
  // which is deliberate and stays; a caller context means a caller-chosen path,
  // and that is the one to police.
  if (opts.claims !== undefined) {
    const caller = callerOf(opts.claims);
    if (
      !caller ||
      !mayTouchAttachment({
        bucket: opts.bucket,
        path: opts.path,
        action: 'write',
        callerId: caller.callerId,
        role: caller.role,
      })
    ) {
      throw forbidden('that path is not yours to write');
    }
  }

  // Metadata first: if a policy rejects the row, no bytes are written.
  const write = (tx: DbContext) =>
    data.upsert(tx, opts.bucket, opts.path, opts.owner ?? null, opts.body.length, contentType);
  if (opts.tx) await write(opts.tx);
  else if (opts.claims !== undefined) await asCaller(opts.claims, write);
  else await asService(write);

  const target = locate(opts.bucket, opts.path);
  await mkdir(dirname(target), { recursive: true });
  // Write to a temporary name and rename into place. rename is atomic on the
  // same filesystem, so a reader never sees a half-written image — which for a
  // face capture would look like a failed match rather than a partial file.
  const tmp = `${target}.${randomUUID()}.tmp`;
  try {
    await writeFile(tmp, opts.body);
    await rename(tmp, target);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
  return { path: opts.path };
}

/**
 * Sign many paths at once. ONE database round trip decides visibility for the
 * whole batch, then signing is local HMAC.
 *
 * Doing this per path would open one transaction each: an admin gallery asking
 * for a hundred thumbnails would try to hold a hundred pool connections against
 * a pool of twenty.
 *
 * A path the caller may not see is simply absent from the result.
 */
export async function signedUrls(
  claims: JwtClaims | null,
  bucket: Bucket,
  paths: string[],
  ttl = env.STORAGE_URL_TTL,
): Promise<Record<string, string>> {
  const wanted = [...new Set(paths.filter(Boolean))];
  if (!wanted.length) return {};

  // Filtered twice, on purpose. The API decides first — this is what stops a
  // member minting a URL for another member's face template, and it held when
  // RLS was switched off to test exactly that — and the query then runs under
  // the caller's context, so the policies get their say too.
  const caller = callerOf(claims);
  const permitted = wanted.filter(
    (path) =>
      caller !== null &&
      mayTouchAttachment({
        bucket,
        path,
        action: 'read',
        callerId: caller.callerId,
        role: caller.role,
      }),
  );
  // A public bucket needs no session at all: an avatar shows beside a name on
  // screens a signed-out caller already sees.
  const askable = isPublicBucket(bucket) ? wanted : permitted;
  if (!askable.length) return {};

  const visible = await asCaller(claims, (tx) => data.findVisible(tx, bucket, askable));

  // Was a join onto storage.buckets to read its `public` column. One less table
  // and one less join for a fact that is now a constant.
  const isPublic = PUBLIC_BUCKETS.has(bucket);
  const out: Record<string, string> = {};
  for (const row of visible) {
    // A public bucket (avatars) needs no token — the matching policy already
    // makes it readable by everyone.
    out[row.path] = isPublic
      ? `${env.apiPublicPath}/storage/${bucket}/object?path=${encodeURIComponent(row.path)}`
      : `${env.apiPublicPath}${signedPath(bucket, row.path, ttl)}`;
  }
  return out;
}

/** One object's URL, or a 404 when it is not visible to this caller. */
export async function signedUrl(
  claims: JwtClaims | null,
  bucket: Bucket,
  path: string,
  ttl = env.STORAGE_URL_TTL,
): Promise<string> {
  const urls = await signedUrls(claims, bucket, [path], ttl);
  const url = urls[path];
  if (!url) throw notFound('object not found');
  return url;
}

export interface ObjectStream {
  stream: ReadStream;
  size: number;
  contentType: string;
}

/** Open an object for streaming. Throws notFound when the file is gone. */
export async function openObject(bucket: Bucket, path: string): Promise<ObjectStream> {
  const target = locate(bucket, path);
  let size: number;
  try {
    size = (await stat(target)).size;
  } catch {
    throw notFound('object not found');
  }

  // A real column now, not a key fished out of a metadata blob.
  const row = await asService((tx) => data.findOne(tx, bucket, path));
  const contentType = row?.contentType ?? 'application/octet-stream';

  return { stream: createReadStream(target), size, contentType };
}

/**
 * Best-effort removal of both halves. Missing files are not an error.
 *
 * `tx` must be passed when calling from inside an open transaction — see the
 * note on PutOptions.tx.
 */
export async function removeObjects(bucket: Bucket, paths: string[], tx?: DbContext): Promise<void> {
  const wanted = paths.filter(Boolean);
  if (!wanted.length) return;

  for (const path of wanted) {
    try {
      await unlink(locate(bucket, path));
    } catch {
      // The metadata row is the authoritative record; an orphan file or an
      // already-missing one is harmless.
    }
  }

  const drop = (t: DbContext) => data.remove(t, bucket, wanted);
  if (tx) await drop(tx);
  else await asService(drop);
}

/** Decode a data-URL or bare base64 payload into bytes. */
export function decodeBase64Image(input: string): Buffer | null {
  const b64 = (input || '').split(',').pop() ?? '';
  if (!b64) return null;
  try {
    const buf = Buffer.from(b64, 'base64');
    return buf.length ? buf : null;
  } catch {
    return null;
  }
}
