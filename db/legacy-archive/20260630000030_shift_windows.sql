-- Per-shift attendance windows (replaces the global window settings). Each shift
-- defines its own check-in/check-out windows as clock times; overnight shifts
-- (e.g. 20:00 -> 08:00) are handled by the app/function via minute-placement.
alter table public.shifts
  add column if not exists checkin_open   time, -- check-in opens
  add column if not exists checkin_late   time, -- arrive after this => late
  add column if not exists checkin_close  time, -- last time to check in
  add column if not exists checkout_open  time, -- check-out opens
  add column if not exists checkout_close time; -- last time to check out

-- Backfill from existing start/end so current shifts keep working.
update public.shifts set
  checkin_open   = coalesce(checkin_open,   (start_time::time - interval '30 minutes')::time),
  checkin_late   = coalesce(checkin_late,   start_time::time),
  checkin_close  = coalesce(checkin_close,  (start_time::time + interval '60 minutes')::time),
  checkout_open  = coalesce(checkout_open,  end_time::time),
  checkout_close = coalesce(checkout_close, (end_time::time + interval '180 minutes')::time);

-- The global window offsets are now per-shift; drop them.
alter table public.app_settings
  drop column if exists checkin_before_min,
  drop column if exists checkin_after_min,
  drop column if exists checkout_after_min;

-- Rewrite auto "left work" to use each shift's checkout_close, honouring overnight
-- shifts (checkout on the day AFTER check-in when the shift crosses midnight).
create or replace function public.mark_left_work()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  auto_on boolean;
  now_cairo timestamp := (now() at time zone 'Africa/Cairo');
  changed integer := 0;
begin
  select auto_leave_work into auto_on from public.app_settings where id = 1;
  if not coalesce(auto_on, false) then
    return 0;
  end if;

  with cand as (
    select a.id,
           -- checkout deadline as a Cairo timestamp; +1 day when the shift's
           -- checkout_close is earlier in the clock than its check-in start
           -- (i.e. the shift crosses midnight).
           (a.date::timestamp
             + coalesce(sh.checkout_close, sh.end_time::time, time '23:59')
             + case
                 when sh.checkin_open is not null
                   and coalesce(sh.checkout_close, sh.end_time::time) < sh.checkin_open
                 then interval '1 day' else interval '0' end
           ) as deadline
      from public.attendance a
      left join public.shifts sh on sh.id = a.shift_id
     where a.check_in_at is not null
       and a.check_out_at is null
       and a.status <> 'left_work'
       and a.date >= (now_cairo::date - 1)
  )
  update public.attendance a
     set status = 'left_work'
    from cand c
   where a.id = c.id
     and now_cairo > c.deadline;

  get diagnostics changed = row_count;
  return changed;
end;
$$;

notify pgrst, 'reload schema';
