-- Optional polygon geofence per branch (alternative to the radius circle).
-- Admins draw a polygon; we keep the vertices as friendly JSON (area_coords)
-- and derive the PostGIS polygon (area) from them via the geom trigger.
-- geofence_check uses the polygon when set, otherwise the circle (geom+radius).
alter table public.branches add column if not exists area_coords jsonb;
alter table public.branches add column if not exists area geography(Polygon, 4326);

create or replace function public.branches_set_geom()
returns trigger language plpgsql as $function$
declare
  coords jsonb;
  ring   jsonb;
begin
  new.geom := ST_SetSRID(ST_MakePoint(new.longitude, new.latitude), 4326)::geography;

  if new.area_coords is not null
     and jsonb_typeof(new.area_coords) = 'array'
     and jsonb_array_length(new.area_coords) >= 3 then
    coords := new.area_coords;
    -- Close the ring if the last vertex isn't the first.
    if (coords -> (jsonb_array_length(coords) - 1)) is distinct from (coords -> 0) then
      coords := coords || jsonb_build_array(coords -> 0);
    end if;
    ring := (
      select jsonb_agg(jsonb_build_array((e ->> 'lng')::float8, (e ->> 'lat')::float8) order by ord)
      from jsonb_array_elements(coords) with ordinality as t(e, ord)
    );
    new.area := ST_SetSRID(
      ST_GeomFromGeoJSON(
        jsonb_build_object('type', 'Polygon', 'coordinates', jsonb_build_array(ring))::text
      ),
      4326
    )::geography;
  else
    new.area := null;
  end if;
  return new;
end;
$function$;

-- Fire the trigger when the polygon vertices change too.
drop trigger if exists trg_branches_set_geom on public.branches;
create trigger trg_branches_set_geom
  before insert or update of latitude, longitude, area_coords
  on public.branches for each row execute function public.branches_set_geom();

create or replace function public.geofence_check(p_branch uuid, p_lat double precision, p_lng double precision)
returns table(distance_m double precision, radius_m integer, within boolean)
language sql stable security definer set search_path to 'public' as $function$
  select
    case when h.area is not null then ST_Distance(h.area, g.pt)
         else ST_Distance(h.geom, g.pt) end as distance_m,
    h.radius_meters as radius_m,
    case when h.area is not null then ST_Covers(h.area, g.pt)
         else ST_DWithin(h.geom, g.pt, h.radius_meters) end as within
  from public.branches h
  cross join lateral (select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography as pt) g
  where h.id = p_branch;
$function$;

notify pgrst, 'reload schema';
