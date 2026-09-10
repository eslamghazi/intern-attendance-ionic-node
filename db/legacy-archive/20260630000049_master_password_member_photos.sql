-- Admin-set "master password" that can open ANY account (member or staff),
-- plus a toggle for whether member profile photos are allowed. The master
-- password is stored HASHED (bcrypt via pgcrypto); only a superadmin can set it.

alter table public.app_settings add column if not exists master_password_hash text;
alter table public.app_settings add column if not exists member_photos boolean not null default true;

-- Superadmin sets/clears the master password (empty clears it).
create or replace function public.set_master_password(p_pw text)
returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if not public.is_superadmin() then
    raise exception 'forbidden';
  end if;
  update public.app_settings
     set master_password_hash = case when coalesce(p_pw, '') = '' then null
                                     else extensions.crypt(p_pw, extensions.gen_salt('bf')) end
   where id = 1;
end $function$;

-- Whether a master password is currently configured (so the UI can show state).
create or replace function public.master_password_is_set()
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select master_password_hash is not null and master_password_hash <> ''
  from public.app_settings where id = 1;
$function$;

-- Verify a candidate against the stored master hash (called by the edge fn).
create or replace function public.verify_master_password(p_pw text)
returns boolean language sql stable security definer set search_path to 'public' as $function$
  select master_password_hash is not null
     and master_password_hash <> ''
     and master_password_hash = extensions.crypt(p_pw, master_password_hash)
  from public.app_settings where id = 1;
$function$;

grant execute on function public.set_master_password(text)  to authenticated;
grant execute on function public.master_password_is_set()   to authenticated;

-- member_photos flows to every client via the public branding rpc.
create or replace function public.public_branding()
returns json language sql stable security definer set search_path to 'public' as $function$
  select json_build_object(
    'org_name', org_name,
    'org_logo_url', org_logo_url,
    'terminology', terminology,
    'member_photos', member_photos
  )
  from public.app_settings where id = 1;
$function$;

notify pgrst, 'reload schema';
