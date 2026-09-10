-- ============================================================================
-- Custom Access Token Auth Hook — injects the user's role as a JWT claim
-- ("user_role") so RLS can read it without a profiles lookup on every query.
--
-- After applying, enable it:
--   * Hosted: Dashboard -> Authentication -> Hooks -> Customize Access Token
--             -> select public.custom_access_token_hook
--   * Local:  configured in supabase/config.toml ([auth.hook.custom_access_token])
-- ============================================================================

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims    jsonb;
  v_role    text;
begin
  select role::text into v_role
    from public.profiles
   where id = (event ->> 'user_id')::uuid;

  claims := coalesce(event -> 'claims', '{}'::jsonb);

  if v_role is not null then
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- The auth admin role must be able to run the hook and read profiles.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on table public.profiles to supabase_auth_admin;

-- Keep the hook private from normal API roles.
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- Allow the auth admin to read profiles despite RLS (needed by the hook).
do $$ begin
  create policy "auth_admin_read_profiles" on public.profiles
    for select to supabase_auth_admin using (true);
exception when duplicate_object then null; end $$;
