-- Student code = <batch year>-<institution code>-<alphabetical serial>.
--   * batch year + institution code live on the batch (admin-set).
--   * serial is the student's alphabetical rank (by name) within their batch.
-- e.g. batch 2026, institution 1, 3rd name alphabetically => "2026-1-003".

-- Institution code on the batch (1 = كلية, 2 = معهد, … — the admin decides).
alter table public.batches
  add column if not exists institution_code int not null default 1;

-- Rebuild the directory view to expose the serial + composed code. The serial
-- is a window over the whole batch, so it is correct regardless of paging/search
-- (PostgREST filters are applied AFTER the window is computed).
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
      then base.batch_year::text || '-' || coalesce(base.institution_code, 0)::text
           || '-' || lpad(base.serial::text, 3, '0')
    else null
  end as student_code
from base;

grant select on public.intern_directory to authenticated, anon;

-- A student can't see the rest of their batch (RLS), so they can't compute their
-- own serial through the view. This SECURITY DEFINER function ranks over the full
-- batch and returns ONLY the caller's code.
create or replace function public.my_student_code()
returns text
language sql
stable
security definer
set search_path = public
as $$
  with ranked as (
    select
      i.id,
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
      then r.batch_year::text || '-' || coalesce(r.institution_code, 0)::text
           || '-' || lpad(r.serial::text, 3, '0')
  end
  from ranked r
  where r.profile_id = auth.uid()
  limit 1;
$$;

grant execute on function public.my_student_code() to authenticated, anon;
