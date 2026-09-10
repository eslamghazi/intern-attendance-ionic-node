-- Attendance is tied to the roster: if a day's roster shift is REMOVED (or
-- changed to a different shift), that day's attendance for the student is
-- dropped automatically, so the two never get out of sync.
create or replace function public.sync_attendance_with_roster()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    delete from public.attendance where intern_id = old.intern_id and date = old.date;
    return old;
  elsif (tg_op = 'UPDATE') then
    -- Only when the actual shift changes (not other column edits).
    if new.shift_id is distinct from old.shift_id then
      delete from public.attendance where intern_id = old.intern_id and date = old.date;
    end if;
    return new;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_sync_attendance_roster on public.roster_days;
create trigger trg_sync_attendance_roster
after delete or update on public.roster_days
for each row execute function public.sync_attendance_with_roster();
