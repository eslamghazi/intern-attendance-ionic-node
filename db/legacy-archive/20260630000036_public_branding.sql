-- Expose ONLY the organization branding (name + logo) publicly, so the login
-- screen and exports can show it without exposing the rest of app_settings.
create or replace function public.public_branding()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object('org_name', org_name, 'org_logo_url', org_logo_url)
  from public.app_settings
  where id = 1;
$$;

grant execute on function public.public_branding() to authenticated, anon;
