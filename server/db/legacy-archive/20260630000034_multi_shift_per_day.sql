-- Multiple shifts per day: a student can be rostered for (and record attendance
-- against) more than one shift on the same calendar date, e.g. a day shift AND a
-- night shift. Widen the uniqueness from (intern, date) to (intern, date, shift).
-- Existing data has at most one row per (intern, date), so both indexes build
-- cleanly with no data migration.

-- roster_days: one row per (intern, date, shift).
alter table public.roster_days drop constraint if exists roster_days_intern_id_date_key;
create unique index if not exists roster_days_intern_date_shift_key
  on public.roster_days (intern_id, date, shift_id);

-- attendance: one row per (intern, date, shift). The unique index is also the
-- ON CONFLICT target used by record-attendance's check-in upsert.
alter table public.attendance drop constraint if exists attendance_intern_id_date_key;
create unique index if not exists attendance_intern_date_shift_key
  on public.attendance (intern_id, date, shift_id);

-- Roster/attendance link: removing (or changing) ONE shift on a day must only
-- drop THAT shift's attendance, not every shift that day. Key the cascade by
-- shift_id too.
create or replace function public.sync_attendance_with_roster()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    delete from public.attendance
     where intern_id = old.intern_id and date = old.date and shift_id = old.shift_id;
    return old;
  elsif (tg_op = 'UPDATE') then
    if new.shift_id is distinct from old.shift_id then
      delete from public.attendance
       where intern_id = old.intern_id and date = old.date and shift_id = old.shift_id;
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
