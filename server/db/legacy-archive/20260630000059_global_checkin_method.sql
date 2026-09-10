-- Global (app-wide) check-in method, mirroring the per-branch control. The
-- EFFECTIVE policy is the most restrictive of global + branch:
--   block  if global='none'     OR branch blocked
--   qr-only if global='qr'       OR branch requires qr   (geofence path blocked)
--   qr off  if global='location' OR branch qr disabled   (QR path blocked)
alter table public.app_settings
  add column if not exists checkin_method text not null default 'both';
alter table public.app_settings drop constraint if exists app_settings_checkin_method_check;
alter table public.app_settings
  add constraint app_settings_checkin_method_check
  check (checkin_method in ('location', 'qr', 'both', 'none'));
