-- QR-based location bypass. A "manager" (role below admin) generates a QR for a
-- hospital+day (optionally a specific student). A student whose GPS fails scans
-- it to check in. Tokens are validated only by the record-attendance Edge
-- Function (service role), so RLS is fully locked (no client access).
create table if not exists public.qr_tokens (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  date        date not null,
  intern_id   uuid references public.interns(id) on delete cascade, -- null = any student at the hospital
  single_use  boolean not null default false,
  used_at     timestamptz,
  expires_at  timestamptz not null,
  created_by  uuid,
  created_at  timestamptz not null default now()
);
create index if not exists qr_tokens_token_idx on public.qr_tokens(token);

alter table public.qr_tokens enable row level security;
-- No policies: only the service-role Edge Functions touch this table.

-- Superadmin toggle: QR must target a specific student (not a whole hospital).
alter table public.app_settings
  add column if not exists qr_requires_student boolean not null default false;
