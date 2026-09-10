-- Final genericization: rename the auth role value and the remaining
-- old-terminology object names.
--   role enum value  'intern' -> 'member'
--   RLS policy names  interns_/hospitals_/batches_/*_intern_* -> generic
--   geofence_check param  p_hospital -> p_branch
-- The role enum RENAME VALUE is OID-preserving: stored rows and every
-- enum-coerced comparison (role = 'intern'::role) in policies / functions /
-- checks follow automatically. Nothing compares the role as text to 'intern'.

-- 1) Role enum value ---------------------------------------------------------
alter type public.role rename value 'intern' to 'member';

-- 2) RLS policy names (cosmetic; behaviour unchanged) ------------------------
alter policy hospitals_select            on public.branches rename to branches_select;
alter policy hospitals_write_superadmin  on public.branches rename to branches_write_superadmin;
alter policy batches_select              on public.groups   rename to groups_select;
alter policy batches_write_superadmin    on public.groups   rename to groups_write_superadmin;
alter policy interns_delete_superadmin   on public.members  rename to members_delete_superadmin;
alter policy interns_select              on public.members  rename to members_select;
alter policy interns_update_admin        on public.members  rename to members_update_admin;
alter policy profiles_update_intern_by_admin on public.profiles rename to profiles_update_member_by_admin;
alter policy profiles_delete_intern_by_admin on public.profiles rename to profiles_delete_member_by_admin;

-- 3) geofence_check param rename (no policy depends on it) -------------------
drop function if exists public.geofence_check(uuid, double precision, double precision);
create function public.geofence_check(p_branch uuid, p_lat double precision, p_lng double precision)
returns table(distance_m double precision, radius_m integer, within boolean)
language sql stable security definer set search_path to 'public' as $function$
  select
    ST_Distance(h.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) as distance_m,
    h.radius_meters as radius_m,
    ST_DWithin(h.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, h.radius_meters) as within
  from public.branches h
  where h.id = p_branch;
$function$;

notify pgrst, 'reload schema';
