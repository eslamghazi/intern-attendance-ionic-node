-- server_now(): also return the REAL Africa/Cairo time (real_date/real_time),
-- independent of any frozen-clock override. The client uses the effective
-- (possibly frozen) time for display + shift logic, but the REAL time for
-- security-sensitive real-time windows (e.g. the QR location-bypass window) so
-- they can't be beaten by changing the device clock AND aren't broken by a
-- frozen test clock.
create or replace function public.server_now()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  fz   timestamptz;
  eff  timestamptz;
  rnow timestamptz := now();
begin
  select i.frozen_at into fz
  from public.interns i
  where i.profile_id = auth.uid()
  limit 1;

  eff := coalesce(fz, rnow);

  return json_build_object(
    'date', to_char((eff at time zone 'Africa/Cairo'), 'YYYY-MM-DD'),
    'time', to_char((eff at time zone 'Africa/Cairo'), 'HH24:MI:SS'),
    'frozen', fz is not null,
    'real_date', to_char((rnow at time zone 'Africa/Cairo'), 'YYYY-MM-DD'),
    'real_time', to_char((rnow at time zone 'Africa/Cairo'), 'HH24:MI:SS')
  );
end;
$$;

grant execute on function public.server_now() to authenticated, anon;
