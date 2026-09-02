-- Per-branch (per-hospital) check-in controls the admin can toggle:
--   qr_enabled    — whether the location-bypass QR works for this branch (default ON)
--   block_checkin — hard-stop: no check-in/out at all for this branch (default OFF)
-- The existing bypass_face / bypass_location flags already exist on branches;
-- these two are new. All are enforced authoritatively in the edge functions.
alter table public.branches
  add column if not exists qr_enabled boolean not null default true,
  add column if not exists block_checkin boolean not null default false;
