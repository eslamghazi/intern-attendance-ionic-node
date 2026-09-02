-- ============================================================================
-- Rosters & shifts (morning/evening/night). Superadmin-managed. Each intern is
-- assigned a roster; check-in auto-detects which shift the current time falls
-- into and judges late/early against it (falls back to app_settings if none).
-- ============================================================================

create table if not exists public.rosters (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.shifts (
  id         uuid primary key default gen_random_uuid(),
  roster_id  uuid not null references public.rosters(id) on delete cascade,
  name       text not null,                 -- e.g. صباحي / مسائي / ليلي
  start_time time not null,
  end_time   time not null,                 -- end <= start means it crosses midnight
  created_at timestamptz not null default now()
);
create index if not exists shifts_roster_idx on public.shifts(roster_id);

alter table public.interns
  add column if not exists roster_id uuid references public.rosters(id) on delete set null;

alter table public.attendance
  add column if not exists shift_id uuid references public.shifts(id) on delete set null,
  add column if not exists shift_name text;

-- RLS: everyone authenticated may read rosters/shifts; only superadmin writes.
alter table public.rosters enable row level security;
alter table public.shifts  enable row level security;

create policy "rosters_select" on public.rosters
  for select to authenticated using (true);
create policy "rosters_write_superadmin" on public.rosters
  for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());

create policy "shifts_select" on public.shifts
  for select to authenticated using (true);
create policy "shifts_write_superadmin" on public.shifts
  for all to authenticated using (public.is_superadmin()) with check (public.is_superadmin());
