-- Profile photos, member self-service profile edits, and an app-wide
-- terminology preset (generic / students / employees / …).

-- 1) Columns ----------------------------------------------------------------
alter table public.profiles     add column if not exists avatar_url  text;
alter table public.app_settings add column if not exists terminology text not null default 'generic';

-- 2) Public bucket for avatars ---------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

-- A member may write only their own avatar (path = "<profile_id>.<ext>");
-- admins/superadmins may write anyone's. Everyone can read (public bucket).
drop policy if exists "avatars_read"           on storage.objects;
drop policy if exists "avatars_write_own_admin" on storage.objects;
drop policy if exists "avatars_update_own_admin" on storage.objects;
drop policy if exists "avatars_delete_own_admin" on storage.objects;
create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "avatars_write_own_admin" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (split_part(name, '.', 1) = auth.uid()::text or public.is_admin())
  );
create policy "avatars_update_own_admin" on storage.objects
  for update using (
    bucket_id = 'avatars' and (split_part(name, '.', 1) = auth.uid()::text or public.is_admin())
  );
create policy "avatars_delete_own_admin" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (split_part(name, '.', 1) = auth.uid()::text or public.is_admin())
  );

-- 3) Members edit their OWN profile safely (cannot touch role/permissions). --
create or replace function public.update_my_profile(
  p_full_name   text,
  p_phone       text,
  p_email       text,
  p_national_id text,
  p_avatar_url  text default null
) returns void language plpgsql security definer set search_path to 'public' as $function$
begin
  if p_national_id is not null and p_national_id <> '' and exists (
    select 1 from public.profiles where national_id = p_national_id and id <> auth.uid()
  ) then
    raise exception 'national_id_taken';
  end if;
  update public.profiles set
    full_name   = coalesce(nullif(p_full_name, ''), full_name),
    phone       = nullif(p_phone, ''),
    email       = nullif(p_email, ''),
    national_id = coalesce(nullif(p_national_id, ''), national_id),
    avatar_url  = coalesce(p_avatar_url, avatar_url)
  where id = auth.uid();
end $function$;

grant execute on function public.update_my_profile(text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
