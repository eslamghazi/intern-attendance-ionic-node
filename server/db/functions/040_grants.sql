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
-- WHY THIS FILE SURVIVED THE MOVE AND THE POLICIES DID NOT
--
--   GRANT  may this role touch the table or column at all?
--   RLS    which ROWS of it may this role see?
--
-- The second question is answered in the API now (src/domain/access), and the
-- 54 policies that used to answer it are gone. The first stays here, because
-- it is a different kind of rule: coarse, static, and impossible to get subtly
-- wrong the way a row predicate can be.
--
-- What it buys is a floor under the API's own checks. `authenticated` cannot
-- read app_settings.master_password_hash, cannot see refresh_tokens, and cannot
-- write to the audit log — whatever a route forgets. Three statements, and they
-- hold even if every check above them is bypassed.
--
-- Two deliberate departures from what Supabase does:
--
--   * `anon` gets SELECT only. Supabase grants it everything and leans on RLS
--     to sort it out; nothing here is writable without a session, so write
--     privileges would be dead weight for a mistake to find later.
--   * `_migrations` is excluded and explicitly revoked. It is the runner's own
--     bookkeeping, has no RLS, and nothing in the app should read it.
-- ============================================================================

-- `auth` holds no tables any more, only auth.uid() — which server_now() and
-- roster_maker_data() still read — so USAGE on the schema is still needed.
-- `storage` is gone entirely: public.attachments replaced it, and a table in
-- `public` is already covered by the grants below.
grant usage on schema public, auth, extensions
  to anon, authenticated, service_role;

-- Read-write for a signed-in user and for the service role. Which ROWS either
-- of them reaches is the API's decision now — this only says which tables they
-- may touch at all, and the exclusions below are where that gets interesting.
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

-- The migration runner's bookkeeping. No reason for the app to see it.
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

-- app_settings.master_password_hash. The bcrypt hash of the SHARED master
-- password, which opens every member and admin account.
--
-- GET /settings ran `select *`, and the policy behind it permitted every row to
-- every signed-in caller — RLS restricts rows, never columns — so every student
-- received the hash. Proven against a running stack, not theorised.
--
-- The route now names its columns (src/routes/settings.ts, READABLE). This is
-- the other half: `authenticated` is granted the readable columns and nothing
-- else, so the next `select *` on this table FAILS with `permission denied for
-- table app_settings` instead of quietly leaking it again. Loud beats
-- safe-by-convention.
--
-- The API still reads it: verify/set run under asService as the table owner,
-- and an owner is exempt from column privileges.
--
-- HOW THIS HAS TO BE WRITTEN, because the obvious form does nothing:
--
--   revoke select (master_password_hash) on public.app_settings from authenticated;
--
-- That statement succeeds and changes nothing. A table-level `GRANT SELECT`
-- already covers every column, and revoking one column does not subtract from
-- it — there is no column-level grant to take away. The table grant has to be
-- withdrawn and replaced with an explicit column list. (Verified: with only
-- the column revoke in place, `set role authenticated; select * from
-- app_settings` still returned the hash.)
--
-- The list is enumerated rather than derived from information_schema. A
-- derived list would silently grant read on the NEXT secret column somebody
-- adds; this one has to be edited deliberately, and a column missing from it
-- fails loudly the first time a route asks for it.
--
-- Must come AFTER the blanket `grant select on all tables` above, which would
-- otherwise re-grant the whole row on every re-apply.
revoke select on public.app_settings from anon, authenticated;
grant select (
  id,
  face_match_threshold, liveness_required, liveness_mode,
  default_radius_meters, max_accuracy_meters,
  shift_start, shift_end, late_grace_minutes,
  require_play_integrity, bypass_face, bypass_location, bypass_checkout_window,
  store_face_images, store_probe_images, capture_hold_seconds,
  qr_requires_member, qr_allow_image, qr_validity_seconds, qr_bypass_minutes,
  enforce_shift_window, allow_checkout_only, auto_leave_work,
  org_name, org_logo_url, terminology, member_photos,
  show_out_of_range_map, block_dev_options, location_ip_max_km,
  web_detect_frozen_gps, checkin_method
) on public.app_settings to authenticated;

-- UPDATE is left table-wide. PATCH /settings is superadmin-only and projects
-- the body onto an explicit column list (EDITABLE in src/routes/settings.ts),
-- so narrowing it here would mean a second 30-column list to keep in step for
-- no proven exposure.

-- audit_log. Written only by the API, which writes as the owner.
--
-- This table used to carry an insert policy permitting any signed-in caller to
-- write rows as themselves, or — through a null branch — as nobody at all. It
-- records mock_location_detected, face_mismatch, master_login and refresh-token
-- reuse: the evidence trail for exactly the behaviour someone would want to
-- bury. Revoking the privilege is what actually closes it; the policy was only
-- ever half the story.
revoke insert, update, delete on public.audit_log from anon, authenticated;

-- PostGIS's reference table. It ships world-readable and that is correct, but
-- nothing should be writing to it.
revoke insert, update, delete on public.spatial_ref_sys
  from anon, authenticated, service_role;

-- storage.buckets used to be revoked here: a three-row table naming the buckets
-- and whether each was public, which a client flipping one column could have
-- turned every enrolment photo world-readable. There is no such table now —
-- the buckets and their publicity are constants in src/storage/objects.ts,
-- which nothing at runtime can write to at all.
