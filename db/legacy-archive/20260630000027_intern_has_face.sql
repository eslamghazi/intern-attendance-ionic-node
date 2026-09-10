-- The `enrollment_status` flag can drift from reality (e.g. seeded 'enrolled'
-- rows with no face template). The TRUE "has a face print" signal is whether a
-- face_templates row exists — expose it on the directory view as `has_face`.
drop view if exists public.intern_directory;
create view public.intern_directory
with (security_invoker = on) as
with base as (
  select
    i.id            as intern_id,
    i.profile_id,
    i.hospital_id,
    i.batch_id,
    i.is_active,
    i.enrollment_status,
    exists (select 1 from public.face_templates ft where ft.intern_id = i.id) as has_face,
    i.created_at,
    i.bypass_face,
    i.bypass_location,
    i.frozen_at,
    i.can_generate_qr,
    p.full_name,
    p.national_id,
    p.phone,
    b.name          as batch_name,
    b.year          as batch_year,
    coalesce(inst.code, b.institution_code, 0) as institution_code,
    coalesce(inst.name, b.institution_name)    as institution_name,
    h.name          as hospital_name,
    row_number() over (partition by i.batch_id order by p.full_name asc, i.id asc) as serial
  from public.interns i
  join public.profiles p on p.id = i.profile_id
  left join public.batches b on b.id = i.batch_id
  left join public.institutions inst on inst.id = b.institution_id
  left join public.hospitals h on h.id = i.hospital_id
)
select
  base.*,
  case
    when base.batch_year is not null
      then base.batch_year::text || base.institution_code::text
           || lpad(base.serial::text, 3, '0')
    else null
  end as student_code
from base;

grant select on public.intern_directory to authenticated, anon;

notify pgrst, 'reload schema';
