-- A department can belong to one or more institutions (many-to-many).
create table if not exists public.department_institutions (
  department_id uuid not null references public.departments(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  primary key (department_id, institution_id)
);
alter table public.department_institutions enable row level security;
create policy dept_inst_select on public.department_institutions
  for select to authenticated using (true);
create policy dept_inst_write_admin on public.department_institutions
  for all to authenticated using (is_admin()) with check (is_admin());
