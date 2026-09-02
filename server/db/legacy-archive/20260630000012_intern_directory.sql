-- A flat, searchable/sortable directory of interns (joins profiles) so the
-- admin grids can paginate + search server-side. security_invoker keeps the
-- underlying RLS of interns/profiles in force for the querying user.
create or replace view public.intern_directory
with (security_invoker = on) as
select
  i.id           as intern_id,
  i.hospital_id,
  i.batch_id,
  i.is_active,
  i.created_at,
  p.full_name,
  p.national_id
from public.interns i
join public.profiles p on p.id = i.profile_id;

grant select on public.intern_directory to authenticated, anon;
