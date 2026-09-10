-- Expose avatar_url through the member directory so admin lists/forms can show it.
create or replace view public.member_directory as
with base as (
  select i.id as member_id, i.profile_id, i.branch_id, i.group_id,
    i.is_active, i.enrollment_status,
    (exists (select 1 from face_templates ft where ft.member_id = i.id)) as has_face,
    i.created_at, i.bypass_face, i.bypass_location, i.frozen_at, i.can_generate_qr,
    p.full_name, p.national_id, p.phone, p.email, p.avatar_url,
    b.name as group_name, b.year as group_year,
    coalesce(inst.code, b.institution_code, 0) as institution_code,
    coalesce(inst.name, b.institution_name) as institution_name,
    h.name as branch_name,
    row_number() over (partition by i.group_id order by p.full_name, i.id) as serial
  from members i
    join profiles p on p.id = i.profile_id
    left join groups b on b.id = i.group_id
    left join institutions inst on inst.id = b.institution_id
    left join branches h on h.id = i.branch_id
)
select base.member_id, base.profile_id, base.branch_id, base.group_id,
  base.is_active, base.enrollment_status, base.has_face, base.created_at,
  base.bypass_face, base.bypass_location, base.frozen_at, base.can_generate_qr,
  base.full_name, base.national_id, base.phone, base.group_name, base.group_year,
  base.institution_code, base.institution_name, base.branch_name, base.serial,
  case when base.group_year is not null
    then (base.group_year::text || base.institution_code::text) || lpad(base.serial::text, 3, '0')
    else null::text end as member_code,
  base.email,
  base.avatar_url
from base;

notify pgrst, 'reload schema';
