-- Admin-only "frozen clock": an admin pins a specific datetime on a student and
-- that student's app clock is frozen there. The student is never told. Since the
-- whole app reads its clock from server_now(), freezing it there freezes the
-- student's app everywhere, invisibly. Replaces the earlier strict-window idea.
-- Drop the view first (it depends on the strict_* columns), then swap columns.
drop view if exists public.intern_directory;

alter table public.interns
  drop column if exists strict_start,
  drop column if exists strict_end,
  add column if not exists frozen_at timestamptz;

-- Rebuild the directory view: expose frozen_at, drop the strict columns.
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
  i.frozen_at,
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

-- server_now(): if the CALLER is an intern with a frozen clock, return that
-- fixed instant instead of the real time. SECURITY DEFINER so it can read the
-- intern row regardless of RLS. The student cannot tell the clock is frozen.
create or replace function public.server_now()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  fz  timestamptz;
  eff timestamptz;
begin
  select i.frozen_at into fz
  from public.interns i
  where i.profile_id = auth.uid()
  limit 1;

  eff := coalesce(fz, now());

  return json_build_object(
    'date', to_char((eff at time zone 'Africa/Cairo'), 'YYYY-MM-DD'),
    'time', to_char((eff at time zone 'Africa/Cairo'), 'HH24:MI:SS')
  );
end;
$$;

grant execute on function public.server_now() to authenticated, anon;
