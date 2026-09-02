-- ============================================================================
-- Table privileges. AUTHORED — not generated.
--
-- What privileges should exist is a decision, not an observation, and the
-- database we migrated from is the wrong place to read it from.
--
-- WHY THIS FILE EXISTS AT ALL
--
-- The Supabase migrations grant almost nothing: `authenticated` has no SELECT
-- on `branches`, `members` or `attendance`. The app worked because Supabase
-- granted those when it PROVISIONED the project, well before any migration ran.
-- Rebuild the schema from the migrations alone and every request fails with
-- `permission denied for table branches` — which is exactly what happened the
-- first time the API met a database it had built itself.
--
-- GRANT AND RLS ANSWER DIFFERENT QUESTIONS
--
--   GRANT  may this role touch the table at all?
--   RLS    which ROWS of it may this role see?
--
-- The second is the security model here: 47 policies, and RLS is enabled on
-- every application table (the only ones without it are the migration
-- bookkeeping, the PostGIS catalogue and storage.buckets). So a broad grant is
-- safe — it is what the policies were written to sit behind — while a narrow
-- one breaks the app without adding protection.
--
-- Two deliberate departures from what Supabase does:
--
--   * `anon` gets SELECT only. Supabase grants it everything and leans on RLS,
--     but anon has no INSERT, UPDATE or DELETE policy anywhere in this schema,
--     so write privileges would be dead weight a future policy could
--     accidentally give meaning to.
--   * `_migrations` is excluded and explicitly revoked. It is the runner's own
--     bookkeeping, has no RLS, and nothing in the app should read it.
-- ============================================================================

-- `auth` holds no tables any more, only auth.uid() and auth.jwt(), which every
-- policy calls — so USAGE on the schema still has to be granted. `storage` is
-- gone entirely: public.attachments replaced it, and a table in `public` is
-- already covered by the grants below.
grant usage on schema public, auth, extensions
  to anon, authenticated, service_role;

-- Read-write for a signed-in user and for the service role; the policies decide
-- which rows either of them actually reaches.
grant select, insert, update, delete on all tables in schema public
  to authenticated, service_role;

-- Read-only for a caller with no session: the public avatars bucket and the
-- handful of things exposed before sign-in.
grant select on all tables in schema public to anon;

grant usage, select on all sequences in schema public
  to authenticated, service_role;

-- A table added later must not be silently unreachable — that failure shows up
-- as a 500 on an endpoint nobody touched, days after the change.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public
  grant usage, select on sequences to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Exclusions
-- ---------------------------------------------------------------------------

-- The migration runner's bookkeeping. No RLS, no reason for the app to see it.
revoke all on public._migrations from anon, authenticated, service_role;

-- Refresh tokens. Nothing but the API ever touches this table, and the blanket
-- grant above would otherwise hand every signed-in caller the whole session
-- register: which accounts are signed in, from what, and when.
--
-- Belt and braces, because the two answer different questions and either alone
-- has a gap:
--   * REVOKE stops `authenticated` and `anon` reaching the table at all;
--   * RLS ENABLED WITH NO POLICIES denies every row to anyone not bypassing
--     RLS, which is what catches a future grant added without thinking.
--
-- service_role keeps its access (it has BYPASSRLS and is what the API uses).
revoke all on public.refresh_tokens from anon, authenticated;
alter table public.refresh_tokens enable row level security;

-- The hashes are SHA-256 of 256 random bits, so a leaked row is not a usable
-- token — but it is still a map of who is signed in where, and there is no
-- reason for anyone to hold it.

-- PostGIS's reference table. It ships world-readable and that is correct, but
-- nothing should be writing to it.
revoke insert, update, delete on public.spatial_ref_sys
  from anon, authenticated, service_role;

-- storage.buckets used to be revoked here: a three-row table naming the buckets
-- and whether each was public, which a client flipping one column could have
-- turned every enrolment photo world-readable. There is no such table now —
-- the buckets and their publicity are constants in src/storage/objects.ts,
-- which nothing at runtime can write to at all.
