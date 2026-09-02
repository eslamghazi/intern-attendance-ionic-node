-- Fix: after renaming the role enum value 'intern' -> 'member', these plpgsql
-- functions still compared to the literal 'intern' (now an INVALID enum label),
-- so they threw at runtime and member sign-in / password change failed. Also
-- schema-qualify pgcrypto (crypt/gen_salt live in the `extensions` schema).
create or replace function public.verify_member_login(p_nid text, p_pw text)
returns uuid language plpgsql security definer set search_path to 'public' as $function$
declare rec record;
begin
  select id, national_id, password_hash, is_active, role into rec
  from public.profiles where national_id = p_nid;
  if rec.id is null or rec.is_active = false or rec.role <> 'member' then return null; end if;
  if rec.password_hash is not null then
    return case when rec.password_hash = extensions.crypt(p_pw, rec.password_hash) then rec.id else null end;
  end if;
  return case when p_pw = rec.national_id then rec.id else null end;
end $function$;

create or replace function public.change_member_password(p_profile uuid, p_current text, p_new text)
returns boolean language plpgsql security definer set search_path to 'public' as $function$
declare rec record;
begin
  select id, national_id, password_hash into rec
  from public.profiles where id = p_profile and role = 'member';
  if rec.id is null then return false; end if;
  if rec.password_hash is not null then
    if rec.password_hash <> extensions.crypt(p_current, rec.password_hash) then return false; end if;
  elsif p_current <> rec.national_id then
    return false;
  end if;
  update public.profiles set password_hash = extensions.crypt(p_new, extensions.gen_salt('bf')) where id = p_profile;
  return true;
end $function$;
