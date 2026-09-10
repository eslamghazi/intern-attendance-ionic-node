-- server_now(): also report WHETHER the returned instant is a frozen (pinned)
-- clock, so the client can hold it steady instead of ticking the seconds
-- forward between syncs. Behaviour is otherwise unchanged: interns with a
-- frozen_at get their pinned time; everyone else gets real Africa/Cairo now.
create or replace function public.server_now()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  fz  timestamptz;
  eff timestamptz;
begin
  select i.frozen_at into fz
  from public.interns i
  where i.profile_id = auth.uid()
  limit 1;

  eff := coalesce(fz, now());

  return json_build_object(
    'date', to_char((eff at time zone 'Africa/Cairo'), 'YYYY-MM-DD'),
    'time', to_char((eff at time zone 'Africa/Cairo'), 'HH24:MI:SS'),
    'frozen', fz is not null
  );
end;
$$;

grant execute on function public.server_now() to authenticated, anon;
