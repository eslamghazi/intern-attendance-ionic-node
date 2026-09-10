-- ============================================================================
-- Row Level Security: helpers + policies
-- Service role (Edge Functions) bypasses RLS. The attendance table is therefore
-- writable ONLY by the record-attendance Edge Function — never by clients.
-- ============================================================================

-- Helper functions ----------------------------------------------------------

-- Role of the current user: prefer the JWT claim injected by the auth hook,
-- fall back to a profiles lookup. SECURITY DEFINER so the fallback read of
-- profiles does not recurse through RLS.
create or replace function public.current_app_role()
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'user_role', ''),
    (select role::text from public.profiles where id = auth.uid())
  );
$$;

create or replace function public.is_admin()
returns boolean language sql stable set search_path = public as $$
  select public.current_app_role() in ('admin', 'superadmin');
$$;

create or replace function public.is_superadmin()
returns boolean language sql stable set search_path = public as $$
  select public.current_app_role() = 'superadmin';
$$;

create or replace function public.my_intern_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.interns where profile_id = auth.uid();
$$;

create or replace function public.admin_has_assignments()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_assignments where admin_id = auth.uid());
$$;

create or replace function public.admin_batch_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select batch_id from public.admin_assignments
   where admin_id = auth.uid() and batch_id is not null;
$$;

create or replace function public.admin_hospital_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select hospital_id from public.admin_assignments
   where admin_id = auth.uid() and hospital_id is not null;
$$;

-- Can the current admin/superadmin access an intern in this batch/hospital?
-- Superadmins: always. Admins with no assignments: treated as full admins.
-- Admins with assignments: only their batches/hospitals.
create or replace function public.admin_can_access(p_batch uuid, p_hospital uuid)
returns boolean language sql stable set search_path = public as $$
  select public.is_superadmin()
      or (public.is_admin() and (
            not public.admin_has_assignments()
            or p_hospital in (select public.admin_hospital_ids())
            or p_batch    in (select public.admin_batch_ids())
      ));
$$;

-- Self-service RPCs (avoid granting interns broad UPDATE) --------------------
create or replace function public.mark_password_changed()
returns void language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

create or replace function public.mark_enrolled()
returns void language sql security definer set search_path = public as $$
  update public.interns set enrollment_status = 'enrolled' where profile_id = auth.uid();
$$;

grant execute on function public.mark_password_changed() to authenticated;
grant execute on function public.mark_enrolled() to authenticated;

-- Enable RLS ----------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.batches           enable row level security;
alter table public.hospitals         enable row level security;
alter table public.interns           enable row level security;
alter table public.face_templates    enable row level security;
alter table public.attendance        enable row level security;
alter table public.admin_assignments enable row level security;
alter table public.app_settings      enable row level security;
alter table public.audit_log         enable row level security;

-- Profiles ------------------------------------------------------------------
create policy "profiles_select_self_or_admin" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy "profiles_update_superadmin" on public.profiles
  for update to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "profiles_delete_superadmin" on public.profiles
  for delete to authenticated using (public.is_superadmin());

-- Batches -------------------------------------------------------------------
create policy "batches_select" on public.batches
  for select to authenticated using (
    public.is_admin()
    or id in (select batch_id from public.interns where profile_id = auth.uid())
  );
create policy "batches_write_superadmin" on public.batches
  for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

-- Hospitals -----------------------------------------------------------------
create policy "hospitals_select" on public.hospitals
  for select to authenticated using (
    public.is_admin()
    or id in (select hospital_id from public.interns where profile_id = auth.uid())
  );
create policy "hospitals_write_superadmin" on public.hospitals
  for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

-- Interns -------------------------------------------------------------------
create policy "interns_select" on public.interns
  for select to authenticated using (
    profile_id = auth.uid() or public.admin_can_access(batch_id, hospital_id)
  );
create policy "interns_update_admin" on public.interns
  for update to authenticated
  using (public.admin_can_access(batch_id, hospital_id))
  with check (public.admin_can_access(batch_id, hospital_id));
create policy "interns_delete_superadmin" on public.interns
  for delete to authenticated using (public.is_superadmin());
-- INSERT happens only through the create-intern Edge Function (service role).

-- Face templates ------------------------------------------------------------
create policy "face_select_self_or_admin" on public.face_templates
  for select to authenticated using (intern_id = public.my_intern_id() or public.is_admin());
create policy "face_insert_self" on public.face_templates
  for insert to authenticated with check (intern_id = public.my_intern_id());
create policy "face_update_self" on public.face_templates
  for update to authenticated
  using (intern_id = public.my_intern_id())
  with check (intern_id = public.my_intern_id());
create policy "face_delete_superadmin" on public.face_templates
  for delete to authenticated using (public.is_superadmin());

-- Attendance (read-only for clients; writes via Edge Function/service role) --
create policy "attendance_select" on public.attendance
  for select to authenticated using (
    intern_id = public.my_intern_id()
    or exists (
      select 1 from public.interns i
      where i.id = attendance.intern_id
        and public.admin_can_access(i.batch_id, attendance.hospital_id)
    )
  );
create policy "attendance_update_superadmin" on public.attendance
  for update to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
create policy "attendance_delete_superadmin" on public.attendance
  for delete to authenticated using (public.is_superadmin());

-- Admin assignments ---------------------------------------------------------
create policy "assignments_select" on public.admin_assignments
  for select to authenticated using (admin_id = auth.uid() or public.is_superadmin());
create policy "assignments_write_superadmin" on public.admin_assignments
  for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

-- App settings (read by all authenticated, write by superadmin) --------------
create policy "settings_select" on public.app_settings
  for select to authenticated using (true);
create policy "settings_write_superadmin" on public.app_settings
  for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

-- Audit log -----------------------------------------------------------------
create policy "audit_select_admin" on public.audit_log
  for select to authenticated using (public.is_admin());
create policy "audit_insert_self" on public.audit_log
  for insert to authenticated with check (actor_id = auth.uid() or actor_id is null);
