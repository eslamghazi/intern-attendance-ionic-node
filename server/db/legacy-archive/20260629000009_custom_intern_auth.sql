-- ============================================================================
-- Custom intern auth: interns no longer have a Supabase Auth (auth.users) row.
-- Their profile id is a standalone uuid; they log in with NID (username) + NID
-- (password) via the intern-login Edge Function, which mints an HS256 JWT.
-- Admins/superadmin remain on Supabase Auth.
-- ============================================================================

-- profiles.id was FK -> auth.users(id). Interns won't have an auth user.
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- Allow inserting intern profiles without supplying an id.
alter table public.profiles alter column id set default gen_random_uuid();
