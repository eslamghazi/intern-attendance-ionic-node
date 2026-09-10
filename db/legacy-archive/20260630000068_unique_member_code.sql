-- Fix duplicate member codes — two students could hold the SAME code.
--
-- Two independent bugs made the composed code non-unique:
--
--  1. lpad() TRUNCATES. `lpad(serial::text, 3, '0')` does not just pad short
--     serials, it also cuts long ones down to 3 chars — so serial 1070 came out
--     as '107' and collided with serial 107. With 1099 members in one group,
--     serials 1000..1099 landed on top of 100..109: 10 codes, 11 students each.
--     Effect: member-face-tool looks a student up with .eq(member_code).single(),
--     which errors on multiple rows, so those 110 students could not be found.
--
--  2. The serial was numbered per GROUP, but the code only carries the group's
--     YEAR and INSTITUTION. A second group in the same year+institution would
--     therefore restart at 1 and duplicate every code in the first group. Not
--     triggered yet (there is one group today) — it would have been on the next.
--
-- The new format is `YYYY | II | SSSS+` — year (4) + institution code (2) +
-- serial padded to at least 4, widening automatically once a year+institution
-- passes 9999 members. Fixed-width prefix + one uniform serial width inside each
-- partition makes the mapping injective, so a collision is arithmetically
-- impossible rather than merely unlikely. The two CHECKs below keep the prefix
-- widths true, and the DO block at the end refuses to apply the migration if any
-- duplicate survives it.
--
-- NOTE: every code changes shape (e.g. 20261107 -> 2026010107). Nothing parses
-- the code — it is only compared whole and used to name storage folders — but
-- previously exported/printed code lists are stale after this.

-- Keep the code prefix at its fixed width: a 3-digit institution code or a
-- 5-digit year would shift the field boundaries and re-open the ambiguity.
alter table public.institutions drop constraint if exists institutions_code_width_check;
alter table public.institutions
  add constraint institutions_code_width_check check (code between 0 and 99);

alter table public.groups drop constraint if exists groups_year_width_check;
alter table public.groups
  add constraint groups_year_width_check check (year between 1000 and 9999);

-- The ONE definition of a member code. Every place that needs one calls this,
-- so re-creating the view later (which happens on every added column) cannot
-- quietly reintroduce a different — or truncating — format.
--
--   YYYY | II | SSSS...   year(4) + institution(2) + serial, zero-padded to at
--                         least 4 and to the width of the largest serial in the
--                         same year+institution.
--
-- Uniqueness argument: the prefix is fixed width, and every serial inside one
-- year+institution is padded to the SAME width, so code -> (prefix, serial) is
-- injective and the serial is a row_number within that partition. Do not make
-- the padding narrower than the widest serial: lpad() truncates on the right,
-- which is exactly how codes collided before.
create or replace function public.compose_member_code(
  p_year integer,
  p_institution_code integer,
  p_serial bigint,
  p_partition_size bigint
) returns text
language sql
immutable
as $function$
  select case when p_year is not null then
    lpad(p_year::text, 4, '0')
    || lpad(coalesce(p_institution_code, 0)::text, 2, '0')
    || lpad(
         p_serial::text,
         greatest(4, length(greatest(coalesce(p_partition_size, 0), p_serial)::text)),
         '0'
       )
  end;
$function$;

-- Reusable guard: call this at the end of any migration that touches how codes
-- are built, so the change cannot land while two members share a code.
create or replace function public.assert_member_codes_unique()
returns void
language plpgsql
as $function$
declare
  dups int;
begin
  select count(*) into dups from (
    select member_code
    from public.member_directory
    where member_code is not null
    group by member_code
    having count(*) > 1
  ) d;
  if dups > 0 then
    raise exception 'member_code is not unique: % duplicated code(s)', dups;
  end if;
end $function$;

create or replace view public.member_directory as
 WITH base AS (
         SELECT i.id AS member_id,
            i.profile_id,
            i.branch_id,
            i.group_id,
            i.is_active,
            i.enrollment_status,
            (EXISTS ( SELECT 1
                   FROM face_templates ft
                  WHERE ft.member_id = i.id)) AS has_face,
            i.created_at,
            i.bypass_face,
            i.bypass_location,
            i.bypass_checkout_window,
            i.frozen_at,
            i.can_generate_qr,
            p.full_name,
            p.national_id,
            p.phone,
            p.email,
            p.avatar_url,
            b.name AS group_name,
            b.year AS group_year,
            COALESCE(inst.code, b.institution_code, 0) AS institution_code,
            COALESCE(inst.name, b.institution_name) AS institution_name,
            h.name AS branch_name,
            i.can_make_roster,
            i.can_reset_face,
            row_number() OVER (PARTITION BY b.year, COALESCE(inst.code, b.institution_code, 0) ORDER BY p.full_name, i.id) AS serial,
            count(*) OVER (PARTITION BY b.year, COALESCE(inst.code, b.institution_code, 0)) AS partition_size
           FROM members i
             JOIN profiles p ON p.id = i.profile_id
             LEFT JOIN groups b ON b.id = i.group_id
             LEFT JOIN institutions inst ON inst.id = b.institution_id
             LEFT JOIN branches h ON h.id = i.branch_id
        )
 SELECT base.member_id,
    base.profile_id,
    base.branch_id,
    base.group_id,
    base.is_active,
    base.enrollment_status,
    base.has_face,
    base.created_at,
    base.bypass_face,
    base.bypass_location,
    base.frozen_at,
    base.can_generate_qr,
    base.full_name,
    base.national_id,
    base.phone,
    base.group_name,
    base.group_year,
    base.institution_code,
    base.institution_name,
    base.branch_name,
    base.serial,
    public.compose_member_code(base.group_year, base.institution_code, base.serial, base.partition_size) AS member_code,
    base.email,
    base.avatar_url,
    base.can_make_roster,
    base.bypass_checkout_window,
    base.can_reset_face
   FROM base;

-- The member's own code, computed exactly like the view above.
create or replace function public.my_member_code()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  with ranked as (
    select
      i.profile_id,
      b.year as group_year,
      coalesce(inst.code, b.institution_code, 0) as institution_code,
      row_number() over (
        partition by b.year, coalesce(inst.code, b.institution_code, 0)
        order by p.full_name asc, i.id asc
      ) as serial,
      count(*) over (
        partition by b.year, coalesce(inst.code, b.institution_code, 0)
      ) as partition_size
    from public.members i
    join public.profiles p on p.id = i.profile_id
    left join public."groups" b on b.id = i.group_id
    left join public.institutions inst on inst.id = b.institution_id
  )
  select public.compose_member_code(r.group_year, r.institution_code, r.serial, r.partition_size)
  from ranked r
  where r.profile_id = auth.uid()
  limit 1;
$function$;

-- Refuse to leave the database in the broken state this migration exists to fix.
select public.assert_member_codes_unique();
