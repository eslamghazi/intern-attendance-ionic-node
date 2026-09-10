-- Per-entity bypass overrides. Effective bypass = global (app_settings) OR the
-- intern's OR their hospital's OR their batch's flag (any TRUE => bypass).
alter table public.interns
  add column if not exists bypass_face boolean not null default false,
  add column if not exists bypass_location boolean not null default false;
alter table public.hospitals
  add column if not exists bypass_face boolean not null default false,
  add column if not exists bypass_location boolean not null default false;
alter table public.batches
  add column if not exists bypass_face boolean not null default false,
  add column if not exists bypass_location boolean not null default false;

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
