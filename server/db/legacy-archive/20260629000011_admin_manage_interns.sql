-- ============================================================================
-- Let admins (not only superadmin) update/delete INTERN profiles, so they can
-- edit a student's name/national ID/phone and delete a student. The check keeps
-- role = 'intern' so an admin can't edit/escalate admin/superadmin accounts.
-- Deleting the profile cascades to interns/attendance/roster_days/face_templates.
-- ============================================================================

create policy "profiles_update_intern_by_admin" on public.profiles
  for update to authenticated
  using (role = 'intern' and public.is_admin())
  with check (role = 'intern' and public.is_admin());

create policy "profiles_delete_intern_by_admin" on public.profiles
  for delete to authenticated
  using (role = 'intern' and public.is_admin());
