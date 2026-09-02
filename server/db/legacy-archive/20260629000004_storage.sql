-- ============================================================================
-- Private storage buckets for biometric images.
--   faces  : the enrolled reference photo  (path: <auth_uid>/reference.jpg)
--   probes : per check-in/out capture       (path: <auth_uid>/<date>-<in|out>.jpg)
-- Top folder is the user's auth uid so policies are simple and self-scoped.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('faces', 'faces', false), ('probes', 'probes', false)
on conflict (id) do nothing;

-- faces: read own or admin; write own; update own ---------------------------
create policy "faces_read_own_or_admin" on storage.objects
  for select to authenticated using (
    bucket_id = 'faces'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
create policy "faces_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'faces' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "faces_update_own" on storage.objects
  for update to authenticated using (
    bucket_id = 'faces' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- probes: read own or admin; write own --------------------------------------
create policy "probes_read_own_or_admin" on storage.objects
  for select to authenticated using (
    bucket_id = 'probes'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );
create policy "probes_insert_own" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'probes' and (storage.foldername(name))[1] = auth.uid()::text
  );
