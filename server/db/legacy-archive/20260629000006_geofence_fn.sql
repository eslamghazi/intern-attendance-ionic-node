-- ============================================================================
-- Authoritative server-side geofence check used by record-attendance.
-- Recomputes distance with PostGIS rather than trusting any client value.
-- ============================================================================

create or replace function public.geofence_check(
  p_hospital uuid,
  p_lat double precision,
  p_lng double precision
)
returns table (distance_m double precision, radius_m int, within boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    ST_Distance(h.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography) as distance_m,
    h.radius_meters as radius_m,
    ST_DWithin(h.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography, h.radius_meters) as within
  from public.hospitals h
  where h.id = p_hospital;
$$;

grant execute on function public.geofence_check(uuid, double precision, double precision)
  to authenticated, service_role;
