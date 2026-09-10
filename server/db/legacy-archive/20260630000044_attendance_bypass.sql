-- Record which gates were bypassed at the moment of each check-in / check-out
-- (face, location + its source, shift-time window). Shown in attendance detail.
alter table public.attendance add column if not exists check_in_bypass  jsonb;
alter table public.attendance add column if not exists check_out_bypass jsonb;

notify pgrst, 'reload schema';
