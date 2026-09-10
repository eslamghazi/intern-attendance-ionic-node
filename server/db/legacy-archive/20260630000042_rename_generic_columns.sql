-- Rename remaining old-terminology identifiers to the generic scheme:
--   intern_id   -> member_id
--   hospital_id -> branch_id      hospital_name -> branch_name
--   batch_id    -> group_id       batch_name    -> group_name   batch_year -> group_year
--   student_code-> member_code
--   qr_requires_student -> qr_requires_member
-- Column renames are OID-based: FKs, indexes, RLS policies and view *internals*
-- follow automatically. Only function BODIES that reference columns by name and
-- the view's OUTPUT column names must be updated by hand. Function renames use
-- ALTER FUNCTION (OID preserved) so RLS policies that call them keep working.
-- NOTE: the auth role value 'intern' is intentionally left unchanged (it is an
-- auth contract shared with JWT claims / RLS), as are edge-function slugs.

-- 1) Base-table columns ------------------------------------------------------
alter table public.admin_assignments  rename column batch_id     to group_id;
alter table public.admin_assignments  rename column hospital_id  to branch_id;
alter table public.attendance         rename column hospital_id  to branch_id;
alter table public.attendance         rename column intern_id    to member_id;
alter table public.departments        rename column hospital_id  to branch_id;
alter table public.face_templates     rename column intern_id    to member_id;
alter table public.groups             rename column hospital_id  to branch_id;
alter table public.member_departments rename column intern_id    to member_id;
alter table public.members            rename column batch_id     to group_id;
alter table public.members            rename column hospital_id  to branch_id;
alter table public.qr_tokens          rename column hospital_id  to branch_id;
alter table public.qr_tokens          rename column intern_id    to member_id;
alter table public.roster_days        rename column intern_id    to member_id;
alter table public.app_settings       rename column qr_requires_student to qr_requires_member;

-- 2) Function renames (OID preserved; policy/trigger references follow) -------
alter function public.admin_batch_ids()                         rename to admin_group_ids;
alter function public.admin_hospital_ids()                      rename to admin_branch_ids;
alter function public.my_intern_id()                            rename to my_member_id;
alter function public.my_student_code()                         rename to my_member_code;
alter function public.change_intern_password(uuid, text, text)  rename to change_member_password;
alter function public.verify_intern_login(text, text)           rename to verify_member_login;
alter function public.hospitals_set_geom()                      rename to branches_set_geom;

-- 3) Rewrite bodies that referenced renamed columns / functions --------------
create or replace function public.admin_group_ids()
returns setof uuid language sql stable security definer set search_path to 'public' as $function$
  select group_id from public.admin_assignments
   where admin_id = auth.uid() and group_id is not null;
$function$;

create or replace function public.admin_branch_ids()
returns setof uuid language sql stable security definer set search_path to 'public' as $function$
  select branch_id from public.admin_assignments
   where admin_id = auth.uid() and branch_id is not null;
$function$;

create or replace function public.admin_can_access(p_batch uuid, p_hospital uuid)
returns boolean language sql stable set search_path to 'public' as $function$
  select public.is_superadmin()
      or (public.is_admin() and (
            not public.admin_has_assignments()
            or p_hospital in (select public.admin_branch_ids())
            or p_batch    in (select public.admin_group_ids())
      ));
$function$;

create or replace function public.my_member_code()
returns text language sql stable security definer set search_path to 'public' as $function$
  with ranked as (
    select
      i.profile_id,
      b.year as group_year,
      coalesce(inst.code, b.institution_code, 0) as institution_code,
      row_number() over (partition by i.group_id order by p.full_name asc, i.id asc) as serial
    from public.members i
    join public.profiles p on p.id = i.profile_id
    left join public."groups" b on b.id = i.group_id
    left join public.institutions inst on inst.id = b.institution_id
  )
  select case
    when r.group_year is not null
      then r.group_year::text || r.institution_code::text || lpad(r.serial::text, 3, '0')
  end
  from ranked r
  where r.profile_id = auth.uid()
  limit 1;
$function$;

create or replace function public.sync_attendance_with_roster()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if (tg_op = 'DELETE') then
    delete from public.attendance
     where member_id = old.member_id and date = old.date and shift_id = old.shift_id;
    return old;
  elsif (tg_op = 'UPDATE') then
    if new.shift_id is distinct from old.shift_id then
      delete from public.attendance
       where member_id = old.member_id and date = old.date and shift_id = old.shift_id;
    end if;
    return new;
  end if;
  return null;
end;
$function$;

-- 4) Directory view: rename it + its output columns (grants/OID preserved) ---
alter view public.intern_directory rename to member_directory;
alter view public.member_directory rename column intern_id     to member_id;
alter view public.member_directory rename column hospital_id   to branch_id;
alter view public.member_directory rename column hospital_name to branch_name;
alter view public.member_directory rename column batch_id      to group_id;
alter view public.member_directory rename column batch_name    to group_name;
alter view public.member_directory rename column batch_year    to group_year;
alter view public.member_directory rename column student_code  to member_code;

-- 5) Trigger name to match its renamed function ------------------------------
alter trigger trg_hospitals_set_geom on public.branches rename to trg_branches_set_geom;

-- 6) Refresh PostgREST schema cache ------------------------------------------
notify pgrst, 'reload schema';
