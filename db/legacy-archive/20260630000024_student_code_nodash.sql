-- Institution gets a free label (كلية / معهد / anything) alongside its code, and
-- the student code drops the dashes: <year><institution code><serial> e.g. 20261003.
alter table public.batches
  add column if not exists institution_name text;

drop view if exists public.intern_directory;
create view public.intern_directory
with (security_invoker = on) as
with base as (
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
    i.frozen_at,
    p.full_name,
    p.national_id,
    p.phone,
    b.name          as batch_name,
    b.year          as batch_year,
    b.institution_code,
    b.institution_name,
    h.name          as hospital_name,
    row_number() over (partition by i.batch_id order by p.full_name asc, i.id asc) as serial
  from public.interns i
  join public.profiles p on p.id = i.profile_id
  left join public.batches b on b.id = i.batch_id
  left join public.hospitals h on h.id = i.hospital_id
)
select
  base.*,
  case
    when base.batch_year is not null
      then base.batch_year::text || coalesce(base.institution_code, 0)::text
           || lpad(base.serial::text, 3, '0')
    else null
  end as student_code
from base;

grant select on public.intern_directory to authenticated, anon;

create or replace function public.my_student_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      i.profile_id,
      b.year as batch_year,
      b.institution_code,
      row_number() over (partition by i.batch_id order by p.full_name asc, i.id asc) as serial
    from public.interns i
    join public.profiles p on p.id = i.profile_id
    left join public.batches b on b.id = i.batch_id
  )
  select case
    when r.batch_year is not null
      then r.batch_year::text || coalesce(r.institution_code, 0)::text
           || lpad(r.serial::text, 3, '0')
  end
  from ranked r
  where r.profile_id = auth.uid()
  limit 1;
$$;

grant execute on function public.my_student_code() to authenticated, anon;
