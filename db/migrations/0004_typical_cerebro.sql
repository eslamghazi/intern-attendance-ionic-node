-- Move the file index into public.attachments, then remove the storage schema.
--
-- HAND-EDITED after `npm run db:generate`, for the same reason as 0002: what
-- drizzle-kit generated was
--
--   DROP TABLE "storage"."buckets" CASCADE;
--   DROP TABLE "storage"."objects" CASCADE;
--   DROP SCHEMA "storage";
--
-- which deletes the index of every stored file before anything copies it (the
-- images on disk would survive, with nothing left saying who they belong to),
-- and then fails anyway on the last line, because storage.foldername(),
-- storage.filename() and storage.extension() are still in the schema and a
-- plain DROP SCHEMA refuses to remove a schema that holds objects.

-- ---------------------------------------------------------------------------
-- 1. Copy the index across.
--
-- storage.objects kept size and mime type inside a `metadata` jsonb blob,
-- because Supabase Storage put whatever the upload API happened to return in
-- there. They are two known values, so they are two columns now.
--
-- `owner` was a bare uuid with no foreign key — Supabase Storage could not
-- reference this schema's profiles table. It can now, which means an owner who
-- no longer has a profile has to become NULL rather than break the constraint.
-- ---------------------------------------------------------------------------
INSERT INTO "public"."attachments"
       (id, bucket, path, owner_id, byte_size, content_type, created_at, updated_at)
SELECT o.id,
       o.bucket_id,
       o.name,
       (SELECT p.id FROM "public"."profiles" p WHERE p.id = o.owner),
       COALESCE((o.metadata ->> 'size')::bigint, 0),
       COALESCE(NULLIF(o.metadata ->> 'mimetype', ''), 'application/octet-stream'),
       o.created_at,
       o.updated_at
  FROM "storage"."objects" o
 WHERE o.bucket_id IN ('faces', 'probes', 'avatars')
    ON CONFLICT (bucket, path) DO NOTHING;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. Drop the tables. The 11 bucket policies live ON storage.objects and go
--    with it; their replacements are in db/functions/014_attachment_policies.sql.
--
--    Explicit order instead of CASCADE: objects references buckets, so objects
--    first. If anything else in this schema turns out to reference either one,
--    this fails and says so.
-- ---------------------------------------------------------------------------
DROP TABLE "storage"."objects";
--> statement-breakpoint
DROP TABLE "storage"."buckets";
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. The path helpers. Only the bucket policies ever called foldername(); the
--    other two were never used by this app at all.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS "storage"."foldername"(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS "storage"."filename"(text);
--> statement-breakpoint
DROP FUNCTION IF EXISTS "storage"."extension"(text);
--> statement-breakpoint
DROP SCHEMA IF EXISTS "storage";
