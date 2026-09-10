-- Deleting a shift should delete the attendance recorded against it (previously
-- ON DELETE SET NULL, which orphaned the rows). roster_days.shift_id already
-- cascades. Member deletion already cascades attendance/roster/enrollment/QR via
-- members.profile_id -> profiles and the member_id FKs, so no change needed there.
alter table public.attendance drop constraint if exists attendance_shift_id_fkey;
alter table public.attendance
  add constraint attendance_shift_id_fkey
  foreign key (shift_id) references public.shifts(id) on delete cascade;
