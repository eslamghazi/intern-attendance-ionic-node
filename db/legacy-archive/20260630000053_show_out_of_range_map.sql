-- Admin toggle: show the "your location vs. branch" map when a check-in fails
-- because the member is outside the geofence. Defaults ON.
alter table public.app_settings
  add column if not exists show_out_of_range_map boolean not null default true;
