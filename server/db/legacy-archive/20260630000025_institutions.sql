-- Institutions managed in ONE place: a reusable list (name + code). Batches pick
-- one instead of re-typing the name/code each time. The student code uses the
-- selected institution's code.
create table if not exists public.institutions (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       int  not null,
  created_at timestamptz not null default now()
);

alter table public.institutions enable row level security;
create policy "institutions_select" on public.institutions
  for select to authenticated using (true);
create policy "institutions_write_superadmin" on public.institutions
  for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
grant select on public.institutions to authenticated, anon;

-- Seed the obvious defaults if the list is empty.
insert into public.institutions (name, code)
  select 'كلية', 1 where not exists (select 1 from public.institutions);
insert into public.institutions (name, code)
  select 'معهد', 2 where not exists (select 1 from public.institutions where code = 2);

-- Batches reference an institution (kept the old columns as a fallback).
alter table public.batches
  add column if not exists institution_id uuid references public.institutions(id);

-- Rebuild the directory view: institution code/name come from the linked
-- institution, falling back to the legacy per-batch columns.
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
    coalesce(inst.code, b.institution_code, 0) as institution_code,
    coalesce(inst.name, b.institution_name)    as institution_name,
    h.name          as hospital_name,
    row_number() over (partition by i.batch_id order by p.full_name asc, i.id asc) as serial
  from public.interns i
  join public.profiles p on p.id = i.profile_id
  left join public.batches b on b.id = i.batch_id
  left join public.institutions inst on inst.id = b.institution_id
  left join public.hospitals h on h.id = i.hospital_id
)
select
  base.*,
  case
    when base.batch_year is not null
      then base.batch_year::text || base.institution_code::text
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
      coalesce(inst.code, b.institution_code, 0) as institution_code,
      row_number() over (partition by i.batch_id order by p.full_name asc, i.id asc) as serial
    from public.interns i
    join public.profiles p on p.id = i.profile_id
    left join public.batches b on b.id = i.batch_id
    left join public.institutions inst on inst.id = b.institution_id
  )
  select case
    when r.batch_year is not null
      then r.batch_year::text || r.institution_code::text
           || lpad(r.serial::text, 3, '0')
  end
  from ranked r
  where r.profile_id = auth.uid()
  limit 1;
$$;

grant execute on function public.my_student_code() to authenticated, anon;
