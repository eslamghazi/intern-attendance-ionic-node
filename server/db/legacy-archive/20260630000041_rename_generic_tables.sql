-- Rename core tables to the generic terminology used across the app:
--   interns   -> members
--   hospitals -> branches
--   batches   -> groups
-- FKs, indexes, RLS policies and views follow automatically (OID-based). Only
-- functions that reference the tables by NAME in their body must be recreated.

alter table public.interns rename to members;
alter table public.hospitals rename to branches;
alter table public.batches rename to groups;

create or replace function public.geofence_check(p_hospital uuid, p_lat double precision, p_lng double precision)
returns table(distance_m double precision, radius_m integer, within boolean)
language sql stable security definer set search_path to 'public' as $function$
  select
    ST_Distance(h.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) as distance_m,
    h.radius_meters as radius_m,
    ST_DWithin(h.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, h.radius_meters) as within
  from public.branches h
  where h.id = p_hospital;
$function$;

create or replace function public.mark_enrolled()
returns void language sql security definer set search_path to 'public' as $function$
  update public.members set enrollment_status = 'enrolled' where profile_id = auth.uid();
$function$;

create or replace function public.my_intern_id()
returns uuid language sql stable security definer set search_path to 'public' as $function$
  select id from public.members where profile_id = auth.uid();
$function$;

create or replace function public.my_student_code()
returns text language sql stable security definer set search_path to 'public' as $function$
  with ranked as (
    select
      i.profile_id,
      b.year as batch_year,
      coalesce(inst.code, b.institution_code, 0) as institution_code,
      row_number() over (partition by i.batch_id order by p.full_name asc, i.id asc) as serial
    from public.members i
    join public.profiles p on p.id = i.profile_id
    left join public."groups" b on b.id = i.batch_id
    left join public.institutions inst on inst.id = b.institution_id
  )
  select case
    when r.batch_year is not null
      then r.batch_year::text || r.institution_code::text || lpad(r.serial::text, 3, '0')
  end
  from ranked r
  where r.profile_id = auth.uid()
  limit 1;
$function$;

create or replace function public.server_now()
returns json language plpgsql stable security definer set search_path to 'public' as $function$
declare
  fz   timestamptz;
  eff  timestamptz;
  rnow timestamptz := now();
begin
  select i.frozen_at into fz from public.members i where i.profile_id = auth.uid() limit 1;
  eff := coalesce(fz, rnow);
  return json_build_object(
    'date', to_char((eff at time zone 'Africa/Cairo'), 'YYYY-MM-DD'),
    'time', to_char((eff at time zone 'Africa/Cairo'), 'HH24:MI:SS'),
    'frozen', fz is not null,
    'real_date', to_char((rnow at time zone 'Africa/Cairo'), 'YYYY-MM-DD'),
    'real_time', to_char((rnow at time zone 'Africa/Cairo'), 'HH24:MI:SS')
  );
end;
$function$;
