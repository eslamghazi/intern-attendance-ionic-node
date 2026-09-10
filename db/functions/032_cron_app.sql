-- ============================================================================
-- Scheduled jobs this project ADDS. AUTHORED — not generated.
--
-- 030_cron.sql is read back out of cron.job, so a job scheduled here would be
-- swept into it on the next extract and then exist twice. The extractor skips
-- these by name (AUTHORED_JOBS), the same arrangement 012 and 014 use.
--
-- Numbered 032 so it runs after the generated jobs.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- Expired refresh tokens.
--
-- One row per sign-in and one more per renewal — every 15 minutes, per device.
-- A few hundred phones produce tens of thousands of rows a week, and every one
-- of them is dead weight in the index the renewal path looks through.
--
-- Kept for a week AFTER expiry rather than deleted on the dot. A token replayed
-- just after it lapses is still worth seeing in the audit log, and the row is
-- what makes that visible; a week is long enough to notice and short enough
-- that the table does not become a history of every session ever opened.
--
-- Revoked-but-unexpired rows are deliberately NOT touched: those are the ones
-- reuse detection matches against.
--
-- 01:20 UTC. Egypt is UTC+2 in winter and +3 in summer, so this is roughly
-- 03:20 or 04:20 local — the middle of the night either way, which is all this
-- needs to be.
-- ---------------------------------------------------------------------------
do $cron$
begin
  if exists (select 1 from cron.job where jobname = 'cleanup-expired-refresh-tokens') then
    perform cron.unschedule('cleanup-expired-refresh-tokens');
  end if;
end
$cron$;

select cron.schedule(
  'cleanup-expired-refresh-tokens',
  '20 1 * * *',
  'delete from public.refresh_tokens where expires_at < now() - interval ''7 days'''
);
