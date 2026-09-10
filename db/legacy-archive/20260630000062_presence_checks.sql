-- Surprise "presence spot-check": an admin picks a group of members who are ON
-- shift right now and asks them to confirm they are physically present, by a
-- deadline within the shift. Members confirm in-app (polling). After the deadline
-- the admin decides whether non-confirmers are marked "left work".
create table if not exists public.presence_checks (
  id                uuid primary key default gen_random_uuid(),
  created_by        uuid references public.profiles(id) on delete set null,
  branch_id         uuid references public.branches(id) on delete set null,
  group_id          uuid references public.groups(id) on delete set null,
  department_id     uuid references public.departments(id) on delete set null,
  shift_id          uuid references public.shifts(id) on delete set null,
  date              date not null,
  deadline          timestamptz not null,
  target_member_ids uuid[] not null default '{}',
  status            text not null default 'open' check (status in ('open', 'resolved', 'cancelled')),
  decision          text check (decision in ('left_work', 'keep')),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);
create index if not exists presence_checks_open_idx on public.presence_checks(status, deadline);
create index if not exists presence_checks_creator_idx on public.presence_checks(created_by, created_at desc);

create table if not exists public.presence_confirmations (
  id           uuid primary key default gen_random_uuid(),
  check_id     uuid not null references public.presence_checks(id) on delete cascade,
  member_id    uuid not null references public.members(id) on delete cascade,
  confirmed_at timestamptz not null default now(),
  unique (check_id, member_id)
);

-- Access is only through the edge functions (service role); deny direct client access.
alter table public.presence_checks enable row level security;
alter table public.presence_confirmations enable row level security;
