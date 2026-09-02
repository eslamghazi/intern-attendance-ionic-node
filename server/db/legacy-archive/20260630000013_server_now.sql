-- Authoritative server time (Africa/Cairo) so the whole app never depends on a
-- device clock. The student's phone can be tampered with; this cannot.
create or replace function public.server_now()
returns json
language sql
stable
as $$
  select json_build_object(
    'date', to_char((now() at time zone 'Africa/Cairo'), 'YYYY-MM-DD'),
    'time', to_char((now() at time zone 'Africa/Cairo'), 'HH24:MI:SS')
  );
$$;

grant execute on function public.server_now() to authenticated, anon;
