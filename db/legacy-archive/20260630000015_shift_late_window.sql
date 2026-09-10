-- Express lateness per shift as a clock window instead of grace-minutes:
--   arrive before late_from   -> present
--   arrive in [late_from,late_to] -> late
--   arrive after late_to      -> absent (missed the window)
alter table public.shifts
  add column if not exists late_from time,
  add column if not exists late_to time;

-- Seed from existing data: late window starts at start+grace and ends at shift end.
update public.shifts
set
  late_from = coalesce(late_from, (start_time + make_interval(mins => coalesce(late_grace_minutes, 15)))::time),
  late_to = coalesce(late_to, end_time)
where late_from is null or late_to is null;
