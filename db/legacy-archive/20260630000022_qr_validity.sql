-- Short-lived, auto-rotating location QR codes. The QR page regenerates a new
-- token every N seconds and each token expires after N seconds, so a screenshot
-- of the code is useless a few seconds later. N is superadmin-configurable.
alter table public.app_settings
  add column if not exists qr_validity_seconds int not null default 25;

-- Fast expiry lookups + cleanup.
create index if not exists qr_tokens_expires_at_idx on public.qr_tokens (expires_at);

-- Auto-clean expired tokens so the table stays tiny despite frequent rotation.
create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-expired-qr') then
    perform cron.unschedule('cleanup-expired-qr');
  end if;
end $$;

-- Every minute, delete tokens that expired more than a minute ago.
select cron.schedule(
  'cleanup-expired-qr',
  '* * * * *',
  $$delete from public.qr_tokens where expires_at < now() - interval '1 minute'$$
);
