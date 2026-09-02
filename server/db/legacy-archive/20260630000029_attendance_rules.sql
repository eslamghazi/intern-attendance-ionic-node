-- Attendance policy controls (all admin-configurable; default OFF so existing
-- behaviour is unchanged until enabled).
alter table public.app_settings
  add column if not exists enforce_shift_window boolean not null default false,
  -- check-in allowed from (shift start - before) to (shift start + after)
  add column if not exists checkin_before_min integer not null default 30,
  add column if not exists checkin_after_min integer not null default 60,
  -- check-out allowed until (shift end + after); past that => "left work"
  add column if not exists checkout_after_min integer not null default 180,
  -- allow recording a check-out with no prior check-in
  add column if not exists allow_checkout_only boolean not null default false,
  -- auto-mark checked-in-but-never-checked-out as "left work" after the window
  add column if not exists auto_leave_work boolean not null default false;

-- Auto "left work": a student who checked in but never checked out is marked
-- 'left_work' once their shift's checkout window has closed. Runs on a schedule.
create or replace function public.mark_left_work()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s          record;
  now_cairo  timestamp := (now() at time zone 'Africa/Cairo');
  changed    integer := 0;
begin
  select enforce_shift_window, checkout_after_min, auto_leave_work, shift_end
    into s
    from public.app_settings where id = 1;

  if s is null or not s.auto_leave_work then
    return 0;
  end if;

  with candidates as (
    select a.id,
           coalesce(sh.end_time, s.shift_end) as end_time
      from public.attendance a
      left join public.shifts sh on sh.id = a.shift_id
     where a.check_in_at is not null
       and a.check_out_at is null
       and a.status <> 'left_work'
       and a.date = now_cairo::date
  )
  update public.attendance a
     set status = 'left_work'
    from candidates c
   where a.id = c.id
     -- past (shift end + grace) in Cairo local time (same-day shifts)
     and now_cairo::time > (c.end_time::time + make_interval(mins => s.checkout_after_min));

  get diagnostics changed = row_count;
  return changed;
end;
$$;

grant execute on function public.mark_left_work() to service_role;

-- Schedule it every 15 minutes (pg_cron). Unschedule a prior copy first.
do $$
begin
  perform cron.unschedule('mark-left-work');
exception when others then null;
end $$;
select cron.schedule('mark-left-work', '*/15 * * * *', $$select public.mark_left_work();$$);

notify pgrst, 'reload schema';
