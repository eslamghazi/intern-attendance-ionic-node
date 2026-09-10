-- Departments: a catalog of departments/sections, and a per-member MONTHLY
-- assignment (a member's department can change each month). Mirrors the RLS
-- pattern of shifts (catalog) and roster_days (per-member, admin-managed).

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);
alter table public.departments enable row level security;
create policy departments_select on public.departments
  for select to authenticated using (true);
create policy departments_write_admin on public.departments
  for all to authenticated using (is_admin()) with check (is_admin());

-- One department per (member, year, month).
create table if not exists public.member_departments (
  id uuid primary key default gen_random_uuid(),
  intern_id uuid not null references public.interns(id) on delete cascade,
  year int not null,
  month int not null,
  department_id uuid not null references public.departments(id) on delete cascade,
  created_at timestamptz default now(),
  unique (intern_id, year, month)
);
alter table public.member_departments enable row level security;
create policy member_departments_select on public.member_departments
  for select to authenticated using ((intern_id = my_intern_id()) or is_admin());
create policy member_departments_write_admin on public.member_departments
  for all to authenticated using (is_admin()) with check (is_admin());
create index if not exists member_departments_month_idx
  on public.member_departments (year, month);
