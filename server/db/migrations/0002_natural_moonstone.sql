-- Fold auth.users into profiles, and drop it.
--
-- HAND-EDITED after `npm run db:generate`. drizzle-kit produced the schema
-- change correctly and everything else wrong, in two ways worth recording:
--
--   1. It emitted `DROP TABLE "auth"."users" CASCADE` as the FIRST statement.
--      drizzle-kit models structure, not data — it has no way to know that
--      column holds every staff password, so it would have deleted them and
--      reported success. Locking out every admin.
--   2. That CASCADE also drops profiles_created_by_fkey, and the very next
--      generated line was `ALTER TABLE profiles DROP CONSTRAINT
--      profiles_created_by_fkey` — which then fails because CASCADE already
--      removed it. The migration could not have run as generated.
--
-- Data movement is always going to be the author's job here. What is worth
-- remembering is that a generated migration is a DRAFT: read it before it runs
-- once, because after that it is frozen by a checksum.

-- ---------------------------------------------------------------------------
-- 1. The passwords.
--
-- Staff hashes were in auth.users.encrypted_password (GoTrue wrote them at
-- bcrypt cost 10); member hashes were in profiles.password_hash (pgcrypto
-- wrote them at cost 6). Identical format, two tables, because GoTrue could
-- not be taught about the second one. One store from here on.
--
-- coalesce, not overwrite: a profile that already has a hash keeps it. The two
-- are the same account (the profile was created with the auth user's id), so
-- the profile's own value is the newer of the two.
-- ---------------------------------------------------------------------------
UPDATE "public"."profiles" p
   SET "password_hash" = u."encrypted_password"
  FROM "auth"."users" u
 WHERE u."id" = p."id"
   AND p."password_hash" IS NULL
   AND u."encrypted_password" IS NOT NULL;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 2. created_by is about to point at profiles instead of auth.users.
--
-- Every auth user had a profile with the same id, so the values carry over as
-- they are — but a row pointing at an account deleted at some point in the
-- past would fail the new constraint and take the whole migration with it.
-- Null those first: "created by someone no longer here" is exactly what the
-- new ON DELETE SET NULL means anyway.
-- ---------------------------------------------------------------------------
UPDATE "public"."profiles" p
   SET "created_by" = NULL
 WHERE p."created_by" IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM "public"."profiles" q WHERE q."id" = p."created_by");
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- 3. Repoint the constraint, then drop the table.
--
-- Dropped explicitly rather than by CASCADE: if anything else in this schema
-- still referenced auth.users, a plain DROP TABLE fails and says so, where
-- CASCADE would quietly remove that too.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."profiles" DROP CONSTRAINT IF EXISTS "profiles_created_by_fkey";
--> statement-breakpoint
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
DROP TABLE IF EXISTS "auth"."users";
