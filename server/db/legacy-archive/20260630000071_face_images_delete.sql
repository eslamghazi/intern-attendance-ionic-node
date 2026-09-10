-- Let an admin DELETE stored biometric images.
--
-- The buckets were read-only for admins: they could look at a face print or a
-- check-in shot but never remove one, so there was no way to clear biometric
-- data that should not be kept. Reading is already admin-wide (see
-- faces_read_own_or_admin / probes_read_own_or_admin); this grants the matching
-- delete. Members still cannot delete anything, including their own.
--
-- WHO may press the button is a separate question, decided in the app by the
-- faceImages page permission ("delete" op) — this policy only decides who the
-- database will accept it from at all.
create policy "faces_delete_admin" on storage.objects
  for delete to authenticated using (
    bucket_id = 'faces' and public.is_admin()
  );

create policy "probes_delete_admin" on storage.objects
  for delete to authenticated using (
    bucket_id = 'probes' and public.is_admin()
  );
