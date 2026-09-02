-- ============================================================================
-- Row-level security for public.attachments. AUTHORED — not generated.
--
-- These eleven replace the eleven that were on storage.objects. Same rules,
-- same names, said in this schema's own terms:
--
--   bucket_id                 -> bucket
--   name                      -> path
--   storage.foldername(name)[1] -> attachment_folder(path)
--
-- 015_policies.sql is generated from a live database, and would sweep these up
-- on the next extract; scripts/extract-programmables.mjs skips them by name
-- (AUTHORED_POLICIES) for exactly the reason 012 exists. Numbered 014 so it
-- runs after 012 (which defines attachment_folder) and beside 015.
--
-- WHY OWNERSHIP IS READ FROM THE PATH AND NOT FROM owner_id
--
-- attachments.owner_id records who UPLOADED the file. For a face photo that is
-- often an admin enrolling someone else, while the person the photo is OF is
-- named by the first folder of the path. The member has to be able to see
-- their own face template, so access follows the path, exactly as it did on
-- storage.objects. owner_id is provenance, not permission.
-- ============================================================================


-- Without this line every policy below is inert and the table is world-readable
-- to any signed-in caller. 015_policies.sql also emits it once the table shows
-- up in pg_class.relrowsecurity, but that only happens AFTER it is first
-- enabled — so it has to be here, not there.
alter table public.attachments enable row level security;


-- ---------------------------------------------------------------------------
-- faces — one folder per member: <profile-id>/<file>
-- ---------------------------------------------------------------------------
drop policy if exists "faces_read_own_or_admin" on public.attachments;
create policy "faces_read_own_or_admin" on public.attachments
  as permissive for select to authenticated
  using ((bucket = 'faces') and (attachment_folder(path) = (auth.uid())::text or is_admin()));

drop policy if exists "faces_insert_own" on public.attachments;
create policy "faces_insert_own" on public.attachments
  as permissive for insert to authenticated
  with check ((bucket = 'faces') and (attachment_folder(path) = (auth.uid())::text));

drop policy if exists "faces_update_own" on public.attachments;
create policy "faces_update_own" on public.attachments
  as permissive for update to authenticated
  using ((bucket = 'faces') and (attachment_folder(path) = (auth.uid())::text));

drop policy if exists "faces_delete_admin" on public.attachments;
create policy "faces_delete_admin" on public.attachments
  as permissive for delete to authenticated
  using ((bucket = 'faces') and is_admin());


-- ---------------------------------------------------------------------------
-- probes — the capture taken at each check-in. Same shape as faces, but no
-- member-side update: a probe is evidence, and re-writing one after the fact
-- is the one thing nobody should be able to do.
-- ---------------------------------------------------------------------------
drop policy if exists "probes_read_own_or_admin" on public.attachments;
create policy "probes_read_own_or_admin" on public.attachments
  as permissive for select to authenticated
  using ((bucket = 'probes') and (attachment_folder(path) = (auth.uid())::text or is_admin()));

drop policy if exists "probes_insert_own" on public.attachments;
create policy "probes_insert_own" on public.attachments
  as permissive for insert to authenticated
  with check ((bucket = 'probes') and (attachment_folder(path) = (auth.uid())::text));

drop policy if exists "probes_delete_admin" on public.attachments;
create policy "probes_delete_admin" on public.attachments
  as permissive for delete to authenticated
  using ((bucket = 'probes') and is_admin());


-- ---------------------------------------------------------------------------
-- avatars — FLAT, not foldered: <profile-id>.<ext>. Hence split_part on '.'
-- rather than attachment_folder(). Kept verbatim from the original policy;
-- changing the layout would orphan every avatar already on disk.
--
-- `to public` — not `authenticated` — because the avatars bucket is public and
-- a signed-out caller has to be able to see one. That is the whole difference
-- between this bucket and the other two.
-- ---------------------------------------------------------------------------
drop policy if exists "avatars_read" on public.attachments;
create policy "avatars_read" on public.attachments
  as permissive for select to public
  using (bucket = 'avatars');

drop policy if exists "avatars_write_own_admin" on public.attachments;
create policy "avatars_write_own_admin" on public.attachments
  as permissive for insert to public
  with check ((bucket = 'avatars')
              and (split_part(path, '.', 1) = (auth.uid())::text or is_admin()));

drop policy if exists "avatars_update_own_admin" on public.attachments;
create policy "avatars_update_own_admin" on public.attachments
  as permissive for update to public
  using ((bucket = 'avatars')
         and (split_part(path, '.', 1) = (auth.uid())::text or is_admin()));

drop policy if exists "avatars_delete_own_admin" on public.attachments;
create policy "avatars_delete_own_admin" on public.attachments
  as permissive for delete to public
  using ((bucket = 'avatars')
         and (split_part(path, '.', 1) = (auth.uid())::text or is_admin()));
