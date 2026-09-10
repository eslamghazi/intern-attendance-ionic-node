-- Per-shift late grace: each shift type gets its own "minutes after start
-- before a check-in counts as late". Falls back to app_settings when a day has
-- no rostered shift.
alter table public.shifts
  add column if not exists late_grace_minutes int not null default 15;
