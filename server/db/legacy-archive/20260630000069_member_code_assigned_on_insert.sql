-- Assign each member's code ONCE, when the row is created — instead of deriving
-- it on every read.
--
-- The derived version had a second, quieter problem than the duplicates fixed in
-- 0068: the serial was `row_number() ... ORDER BY full_name`, so adding ONE
-- student renumbered every student alphabetically after them. Codes silently
-- changed under exported roster sheets, printed lists and the face tool, which
-- all key off the code. Storing the code fixes that: a new student takes the
-- next free serial in their year+institution, and nobody else moves.
--
-- Uniqueness is now enforced by the database itself (unique index), not merely
-- implied by the formula — which is what "cannot happen again" requires.

alter table public.members add column if not exists member_code text;

-- Freeze today's codes exactly as they are: the backfill reads the CURRENT
-- derived value, so no existing member's code changes here.
update public.members m
set member_code = d.member_code
from public.member_directory d
where d.member_id = m.id
  and m.member_code is distinct from d.member_code;

-- The actual guarantee.
drop index if exists public.members_member_code_key;
create unique index members_member_code_key
  on public.members (member_code)
  where member_code is not null;

-- Assignment + immutability.
create or replace function public.assign_member_code()
returns trigger
language plpgsql
as $function$
declare
  v_year   integer;
  v_inst   integer;
  v_prefix text;
  v_next   bigint;
begin
  -- A code is never edited by hand, by anyone: reads of a stale code must not
  -- be able to point at a different person later.
  if tg_op = 'UPDATE' then
    new.member_code := old.member_code;
  end if;

  select b.year, coalesce(inst.code, b.institution_code, 0)
    into v_year, v_inst
  from public."groups" b
  left join public.institutions inst on inst.id = b.institution_id
  where b.id = new.group_id;

  -- No group year means no code, same as before.
  if v_year is null then
    return new;
  end if;

  v_prefix := lpad(v_year::text, 4, '0') || lpad(coalesce(v_inst, 0)::text, 2, '0');

  -- Already carries a code for this year+institution: keep it.
  if new.member_code is not null and left(new.member_code, 6) = v_prefix then
    return new;
  end if;

  -- Take the next serial in this year+institution. The advisory lock serialises
  -- concurrent inserts into the same partition so two of them cannot read the
  -- same max(); the unique index above is the backstop if one ever slips.
  perform pg_advisory_xact_lock(hashtext('member_code:' || v_prefix));
  select coalesce(max(nullif(substring(member_code from 7), '')::bigint), 0) + 1
    into v_next
  from public.members
  where member_code like v_prefix || '%';

  new.member_code := public.compose_member_code(v_year, v_inst, v_next, null);
  return new;
end $function$;

drop trigger if exists members_assign_code on public.members;
create trigger members_assign_code
  before insert or update of group_id, member_code on public.members
  for each row execute function public.assign_member_code();

-- The directory now reads the stored code instead of composing one.
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
            NULLIF(substring(i.member_code FROM 7), ''::text)::bigint AS serial,
            i.member_code AS stored_member_code
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
    base.stored_member_code AS member_code,
    base.email,
    base.avatar_url,
    base.can_make_roster,
    base.bypass_checkout_window,
    base.can_reset_face
   FROM base;

create or replace function public.my_member_code()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select m.member_code
  from public.members m
  where m.profile_id = auth.uid()
  limit 1;
$function$;

select public.assert_member_codes_unique();
