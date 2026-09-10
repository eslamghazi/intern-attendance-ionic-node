-- Operational toggles: bypass face/location gates, and make image storage
-- optional (by default we keep only the embedding/score, not the raw photo).
alter table public.app_settings
  add column if not exists bypass_face boolean not null default false,
  add column if not exists bypass_location boolean not null default false,
  add column if not exists store_face_images boolean not null default false;

-- Enrich the directory view so the Interns page can page + search server-side
-- while still showing batch/hospital names and edit fields.
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
