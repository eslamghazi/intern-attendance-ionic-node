-- Timed location-bypass window: scanning a valid location QR grants the student
-- a bypass for the next N minutes (admin-configurable) instead of a single
-- check-in. `location_bypass_until` holds the server-side expiry.
alter table public.interns
  add column if not exists location_bypass_until timestamptz;

alter table public.app_settings
  add column if not exists qr_bypass_minutes integer not null default 30;

notify pgrst, 'reload schema';
