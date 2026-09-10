-- Finish the two-dimension split for the AUTO "left work" job: write the
-- CHECK-OUT dimension (checkout_status) and leave the check-in `status`
-- (present/late) intact, so a member can be e.g. "late + left_work". Historical
-- rows already had checkout_status backfilled in migration 61.
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
       and a.checkout_status is distinct from 'left_work'
       and a.date >= (now_cairo::date - 1)
  )
  update public.attendance a
     set checkout_status = 'left_work'
    from cand c
   where a.id = c.id
     and now_cairo > c.deadline;

  get diagnostics changed = row_count;
  return changed;
end;
$$;
