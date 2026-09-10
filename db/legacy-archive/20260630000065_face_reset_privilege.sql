-- Privilege: a trusted member may look up a student by national ID (name +
-- whether a face is enrolled) and delete that enrolled face. Same opt-in style
-- as can_generate_qr / can_make_roster. Enforced in the member-face-tool edge fn.
alter table public.members add column if not exists can_reset_face boolean not null default false;

-- Expose the new flag through the directory view the admin grid reads.
create or replace view public.member_directory as
with base as (
  select i.id as member_id, i.profile_id, i.branch_id, i.group_id,
    i.is_active, i.enrollment_status,
    (exists (select 1 from face_templates ft where ft.member_id = i.id)) as has_face,
    i.created_at, i.bypass_face, i.bypass_location, i.bypass_checkout_window,
    i.frozen_at, i.can_generate_qr,
    p.full_name, p.national_id, p.phone, p.email, p.avatar_url,
    b.name as group_name, b.year as group_year,
    coalesce(inst.code, b.institution_code, 0) as institution_code,
    coalesce(inst.name, b.institution_name) as institution_name,
    h.name as branch_name,
    i.can_make_roster,
    i.can_reset_face,
    row_number() over (partition by i.group_id order by p.full_name, i.id) as serial
  from members i
    join profiles p on p.id = i.profile_id
    left join groups b on b.id = i.group_id
    left join institutions inst on inst.id = b.institution_id
    left join branches h on h.id = i.branch_id
)
-- New columns MUST be appended at the END so create-or-replace keeps the
-- existing column positions/names unchanged.
select base.member_id, base.profile_id, base.branch_id, base.group_id,
  base.is_active, base.enrollment_status, base.has_face, base.created_at,
  base.bypass_face, base.bypass_location, base.frozen_at, base.can_generate_qr,
  base.full_name, base.national_id, base.phone, base.group_name, base.group_year,
  base.institution_code, base.institution_name, base.branch_name, base.serial,
  case when base.group_year is not null
    then (base.group_year::text || base.institution_code::text) || lpad(base.serial::text, 3, '0')
    else null::text end as member_code,
  base.email,
  base.avatar_url,
  base.can_make_roster,
  base.bypass_checkout_window,
  base.can_reset_face
from base;

notify pgrst, 'reload schema';
