// Data access for the file index. Takes an OPEN transaction.
//
// Who may reach which file is decided in domain/access/attachment.ts and
// enforced by storage/objects.ts BEFORE anything here runs. Eleven RLS policies
// used to do it; they were the only guard until an experiment with RLS disabled
// showed one student fetching a signed URL for another student's face template.
import { sql } from 'drizzle-orm';
import type { DbContext } from '../db/context.js';
import { arrayOf, query } from '../db/context.js';

export interface AttachmentRow {
  path: string;
  contentType: string;
  byteSize: number;
}

/**
 * Record a file, or update what is already recorded for that path.
 *
 * `on conflict` rather than delete-then-insert: re-uploading an avatar keeps
 * the same row, so nothing referencing it by id is orphaned mid-upload.
 */
export async function upsert(
  tx: DbContext,
  bucket: string,
  path: string,
  ownerId: string | null,
  byteSize: number,
  contentType: string,
): Promise<void> {
  await tx.execute(sql`
    insert into public.attachments (bucket, path, owner_id, byte_size, content_type)
    values (${bucket}, ${path}, ${ownerId}, ${byteSize}, ${contentType})
    on conflict (bucket, path) do update
      set owner_id     = excluded.owner_id,
          byte_size    = excluded.byte_size,
          content_type = excluded.content_type,
          updated_at   = now()
  `);
}

/**
 * Which of these paths may this caller see? ONE query for the whole batch.
 *
 * Asking per path would open a transaction each: an admin gallery requesting a
 * hundred thumbnails would try to hold a hundred connections against a pool of
 * twenty.
 */
export async function findVisible(
  tx: DbContext,
  bucket: string,
  paths: readonly string[],
): Promise<AttachmentRow[]> {
  const rows = await query<{ path: string; content_type: string; byte_size: string | number }>(
    tx,
    sql`
      select path, content_type, byte_size
        from public.attachments
       where bucket = ${bucket} and path = any(${arrayOf(paths as string[])}::text[])
    `,
  );
  return rows.map((r) => ({
    path: r.path,
    contentType: r.content_type,
    // bigint arrives as a string from node-postgres; it is a file size, so it
    // fits a JS number long before it stops being exact.
    byteSize: Number(r.byte_size),
  }));
}

export async function findOne(
  tx: DbContext,
  bucket: string,
  path: string,
): Promise<AttachmentRow | null> {
  return (await findVisible(tx, bucket, [path]))[0] ?? null;
}

export async function remove(
  tx: DbContext,
  bucket: string,
  paths: readonly string[],
): Promise<void> {
  await tx.execute(sql`
    delete from public.attachments
     where bucket = ${bucket} and path = any(${arrayOf(paths as string[])}::text[])
  `);
}
