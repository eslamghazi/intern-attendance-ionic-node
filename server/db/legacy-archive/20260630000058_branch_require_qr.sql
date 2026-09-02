-- Per-branch check-in method control:
--   require_qr — when ON, the GPS/geofence path is blocked and a member can ONLY
--   check in via a QR scan (a valid token or an active QR bypass window). Default
--   OFF. The reverse ("location only, block QR") is qr_enabled = false.
alter table public.branches
  add column if not exists require_qr boolean not null default false;
