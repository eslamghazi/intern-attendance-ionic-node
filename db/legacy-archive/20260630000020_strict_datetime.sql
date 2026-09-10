-- Per-student "strict datetime" check-in window (the third "magic" option).
-- When strict_start / strict_end are set, the student may ONLY check in while
-- the SERVER clock is inside [strict_start, strict_end]. Both NULL => no limit.
-- Times are timestamptz so they are absolute (device clock is never trusted).
alter table public.interns
  add column if not exists strict_start timestamptz,
  add column if not exists strict_end   timestamptz;

-- Rebuild the directory view so the admin grid can read/filter the new columns.
drop view if exists public.intern_directory;
create view public.intern_directory
with (security_invoker = on) as
select
  i.id            as intern_id,
  i.profile_id,
  i.hospital_id,
  i.batch_id,
  i.is_active,
  i.enrollment_status,
  i.created_at,
  i.bypass_face,
  i.bypass_location,
  i.strict_start,
  i.strict_end,
  p.full_name,
  p.national_id,
  p.phone,
  b.name          as batch_name,
  h.name          as hospital_name
from public.interns i
join public.profiles p on p.id = i.profile_id
left join public.batches b on b.id = i.batch_id
left join public.hospitals h on h.id = i.hospital_id;

grant select on public.intern_directory to authenticated, anon;
