-- Web-only anti-spoof threshold (km): reject a browser check-in when the GPS
-- fix is more than this far from the caller's IP location. 0 disables the check.
alter table public.app_settings
  add column if not exists location_ip_max_km integer not null default 100;
