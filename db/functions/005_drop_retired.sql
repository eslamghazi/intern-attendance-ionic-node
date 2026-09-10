-- ============================================================================
-- Functions retired by the move to a Node API. AUTHORED — not generated.
--
-- Every one existed for the same reason: the CLIENT talked to Postgres
-- directly. A browser holding an anon key cannot be trusted to decide what it
-- may read, so each was a SECURITY DEFINER wrapper doing one small privileged
-- thing on its behalf. With an API in between that job belongs to the API,
-- where it is readable, testable, and needs no database function to enforce it.
--
-- 010_functions.sql no longer emits them (the extractor excludes them by name),
-- so this file is what removes them from a database that already has them.
-- Idempotent.
-- ============================================================================

-- A GoTrue hook. GoTrue is gone; nothing has called this since the port. It
-- added the `user_role` claim to a token, which the API now mints itself in
-- src/auth/jwt.ts.
drop function if exists public.custom_access_token_hook(jsonb);

-- Exposed four columns of app_settings to a signed-out caller. app_settings
-- also holds the master password hash, so it is not readable by `anon`; this
-- function was the hole punched through that. Replaced by GET
-- /settings/branding, which reads a fixed column list under asService.
drop function if exists public.public_branding();

-- Told a member their own student code. The client needed the database to
-- identify it, because the database was the only thing that knew who was
-- asking. The API knows.
drop function if exists public.my_member_code();

-- Nulled the columns pointing at deleted images, and began by re-checking
-- is_admin() because a client could call it. The route that replaces it is
-- already admin-only.
drop function if exists public.clear_image_paths(text[]);


-- ---------------------------------------------------------------------------
-- The password functions. Moved to src/services/authService.ts.
--
-- These were the last thing keeping pgcrypto in the request path, and the
-- reason db/prelude.sql carries extensions.crypt() wrappers: crypt() resolved
-- from `public` on a fresh database and from `extensions` on one restored from
-- the Supabase dump, and the functions were written for both.
--
-- Hashing is bcryptjs now. The stored hashes are unchanged — pgcrypto's
-- $2a$06$ and GoTrue's $2a$10$ are both plain bcrypt, and bcryptjs verifies
-- either — so nobody's password stopped working.
-- ---------------------------------------------------------------------------
drop function if exists public.verify_member_login(text, text);
drop function if exists public.change_member_password(uuid, text, text);
drop function if exists public.set_member_password(uuid, text);
drop function if exists public.verify_master_password(text);
drop function if exists public.set_master_password(text);
drop function if exists public.master_password_is_set();


-- ---------------------------------------------------------------------------
-- The policy that went with custom_access_token_hook.
--
-- `for select to supabase_auth_admin using (true)` — GoTrue's own role reading
-- every profile row, so the hook could look up a user's role while minting a
-- token. The hook went in the first phase of this port and the role is no
-- longer created (see db/prelude.sql), which makes this the one kind of dead
-- object that is NOT harmless: CREATE POLICY against a missing role fails, so
-- a database built from scratch stopped part-way through the policy file
-- until this was removed. (Both that file and this drop are historical now:
-- RLS is off entirely — see 015_no_rls.sql.)
-- ---------------------------------------------------------------------------
drop policy if exists "auth_admin_read_profiles" on public.profiles;


-- ---------------------------------------------------------------------------
-- The "act on myself" functions. Moved to src/services/profileService.ts.
--
-- Each one ended in `where … = auth.uid()` and was SECURITY DEFINER for the
-- same reason: no policy lets a member update their own profiles or members
-- row, so the only way a client could do it was a function that stepped around
-- RLS and decided the WHERE clause itself.
--
-- The API knows who is asking, so the id is a parameter now and the row is
-- pinned in code. The column list — which is what stops a member setting their
-- own role — is in the file that writes it rather than in a function body.
-- ---------------------------------------------------------------------------
drop function if exists public.mark_enrolled();
drop function if exists public.mark_password_changed();
drop function if exists public.update_my_profile(text, text, text, text, text);


-- ---------------------------------------------------------------------------
-- The client's write access to the audit log.
--
-- `for insert to authenticated with check (actor_id = auth.uid() OR actor_id
-- IS NULL)` — any signed-in user could write audit rows as themselves, or as
-- nobody. Every audit write now goes through data.audit() under asService,
-- which runs as the owner, so nothing legitimate used this path.
-- ---------------------------------------------------------------------------
drop policy if exists "audit_insert_self" on public.audit_log;
