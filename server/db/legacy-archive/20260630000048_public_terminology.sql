-- Expose the terminology preset through the public branding RPC so it applies
-- everywhere (login screen, members, admins) without exposing app_settings.
create or replace function public.public_branding()
returns json language sql stable security definer set search_path to 'public' as $function$
  select json_build_object(
    'org_name', org_name,
    'org_logo_url', org_logo_url,
    'terminology', terminology
  )
  from public.app_settings where id = 1;
$function$;

notify pgrst, 'reload schema';
