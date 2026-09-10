-- Per-member privilege: can build a roster (like can_generate_qr for the QR).
alter table public.members add column if not exists can_make_roster boolean not null default false;

-- Data a privileged member needs to build a roster for their branch's members.
-- SECURITY DEFINER + the can_make_roster gate controls access (no broad RLS).
create or replace function public.roster_maker_data(p_year int, p_month int)
returns json language plpgsql stable security definer set search_path to 'public' as $function$
declare
  v_branch uuid;
  v_can    boolean;
begin
  select branch_id, can_make_roster into v_branch, v_can
  from public.members where profile_id = auth.uid();
  if not coalesce(v_can, false) then
    return json_build_object('members', '[]'::json, 'shifts', '[]'::json, 'roster', '[]'::json);
  end if;
  return json_build_object(
    'members', coalesce((
      select json_agg(json_build_object('member_id', md.member_id, 'code', md.member_code, 'full_name', md.full_name)
             order by md.full_name)
      from public.member_directory md where md.branch_id = v_branch), '[]'::json),
    'shifts', coalesce((
      select json_agg(json_build_object('id', s.id, 'key', s.key, 'name', s.name) order by s.name)
      from public.shifts s where s.key is not null), '[]'::json),
    'roster', coalesce((
      select json_agg(json_build_object('member_id', rd.member_id, 'day', extract(day from rd.date)::int, 'key', sh.key))
      from public.roster_days rd
      join public.shifts sh on sh.id = rd.shift_id
      join public.members m on m.id = rd.member_id
      where m.branch_id = v_branch
        and rd.date >= make_date(p_year, p_month, 1)
        and rd.date < (make_date(p_year, p_month, 1) + interval '1 month')), '[]'::json)
  );
end $function$;

grant execute on function public.roster_maker_data(int, int) to authenticated;

notify pgrst, 'reload schema';
