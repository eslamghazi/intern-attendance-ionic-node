-- ============================================================================
-- Shifts are GENERIC/global (one set for all hospitals & departments), each with
-- a short key (e.g. M / N / L). The monthly "roster" assigns, per intern per day,
-- which shift they are on (uploaded from an Excel grid: rows=students, cols=days).
-- Replaces the old per-roster grouping.
-- ============================================================================

-- 1. Make shifts global: drop the roster grouping, add a unique key.
alter table public.shifts drop column if exists roster_id cascade;
alter table public.shifts add column if not exists key text;
create unique index if not exists shifts_key_unique
  on public.shifts (lower(key)) where key is not null;

-- 2. Per-day schedule (the roster): intern + date -> shift.
create table if not exists public.roster_days (
  id         uuid primary key default gen_random_uuid(),
  intern_id  uuid not null references public.interns(id) on delete cascade,
  date       date not null,
  shift_id   uuid not null references public.shifts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (intern_id, date)
);
create index if not exists roster_days_intern_date_idx on public.roster_days(intern_id, date);

alter table public.roster_days enable row level security;
create policy "roster_days_select" on public.roster_days
  for select to authenticated using (intern_id = public.my_intern_id() or public.is_admin());
create policy "roster_days_write_admin" on public.roster_days
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3. Remove the old roster grouping entirely.
alter table public.interns drop column if exists roster_id;
drop table if exists public.rosters cascade;
