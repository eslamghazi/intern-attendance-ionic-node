-- Members: add an email field to their profile, and let them change their
-- password (custom-auth members previously used national_id as the password).
create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists email text,
  add column if not exists password_hash text;

-- Surface email in the directory view used by the members grid. Existing columns
-- keep their order (CREATE OR REPLACE requirement); email is appended.
create or replace view public.intern_directory
with (security_invoker = on) as
 WITH base AS (
         SELECT i.id AS intern_id,
            i.profile_id,
            i.hospital_id,
            i.batch_id,
            i.is_active,
            i.enrollment_status,
            (EXISTS ( SELECT 1 FROM face_templates ft WHERE ft.intern_id = i.id)) AS has_face,
            i.created_at,
            i.bypass_face,
            i.bypass_location,
            i.frozen_at,
            i.can_generate_qr,
            p.full_name,
            p.national_id,
            p.phone,
            p.email,
            b.name AS batch_name,
            b.year AS batch_year,
            COALESCE(inst.code, b.institution_code, 0) AS institution_code,
            COALESCE(inst.name, b.institution_name) AS institution_name,
            h.name AS hospital_name,
            row_number() OVER (PARTITION BY i.batch_id ORDER BY p.full_name, i.id) AS serial
           FROM interns i
             JOIN profiles p ON p.id = i.profile_id
             LEFT JOIN batches b ON b.id = i.batch_id
             LEFT JOIN institutions inst ON inst.id = b.institution_id
             LEFT JOIN hospitals h ON h.id = i.hospital_id
        )
 SELECT base.intern_id, base.profile_id, base.hospital_id, base.batch_id, base.is_active,
    base.enrollment_status, base.has_face, base.created_at, base.bypass_face, base.bypass_location,
    base.frozen_at, base.can_generate_qr, base.full_name, base.national_id, base.phone,
    base.batch_name, base.batch_year, base.institution_code, base.institution_name, base.hospital_name,
    base.serial,
    CASE WHEN base.batch_year IS NOT NULL
      THEN (base.batch_year::text || base.institution_code::text) || lpad(base.serial::text, 3, '0'::text)
      ELSE NULL::text END AS student_code,
    base.email
   FROM base;

grant select on public.intern_directory to authenticated, anon;

-- Verify a member login (national_id + password). Returns the profile id when
-- valid, else null. Password is the stored hash if set, otherwise the national
-- ID (the initial password). Called by intern-login with the service role.
create or replace function public.verify_intern_login(p_nid text, p_pw text)
returns uuid language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  select id, national_id, password_hash, is_active, role into rec
  from public.profiles where national_id = p_nid;
  if rec.id is null or rec.is_active = false or rec.role <> 'intern' then return null; end if;
  if rec.password_hash is not null then
    return case when rec.password_hash = crypt(p_pw, rec.password_hash) then rec.id else null end;
  end if;
  return case when p_pw = rec.national_id then rec.id else null end;
end $$;

-- Change a member's password (verifies the current one first). Called by the
-- change-intern-password function with the service role.
create or replace function public.change_intern_password(p_profile uuid, p_current text, p_new text)
returns boolean language plpgsql security definer set search_path = public as $$
declare rec record;
begin
  select id, national_id, password_hash into rec
  from public.profiles where id = p_profile and role = 'intern';
  if rec.id is null then return false; end if;
  if rec.password_hash is not null then
    if rec.password_hash <> crypt(p_current, rec.password_hash) then return false; end if;
  elsif p_current <> rec.national_id then
    return false;
  end if;
  update public.profiles set password_hash = crypt(p_new, gen_salt('bf')) where id = p_profile;
  return true;
end $$;

revoke all on function public.verify_intern_login(text, text) from public, anon, authenticated;
revoke all on function public.change_intern_password(uuid, text, text) from public, anon, authenticated;
grant execute on function public.verify_intern_login(text, text) to service_role;
grant execute on function public.change_intern_password(uuid, text, text) to service_role;
