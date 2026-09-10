-- Per-day roster totals for the admin roster grid.
--
-- The grid pages 12 members at a time, so counting the rows on screen would
-- answer the wrong question: "how many people are on duty that day" is about the
-- WHOLE filtered set. Aggregating in the database keeps it to one small round
-- trip instead of pulling every roster row into the browser.
--
-- SECURITY INVOKER (the default): the caller only ever counts rows their own RLS
-- lets them see.
create or replace function public.roster_day_totals(
  p_year integer,
  p_month integer,
  p_branch_id uuid default null,
  p_search text default '',
  p_field text default 'name',
  p_department_id uuid default null
)
returns table (day integer, shift_id uuid, cnt bigint)
language sql
stable
set search_path to 'public'
as $function$
  with picked as (
    select d.member_id
    from public.member_directory d
    where (p_branch_id is null or d.branch_id = p_branch_id)
      and (
        coalesce(p_search, '') = ''
        or (p_field = 'national_id' and d.national_id ilike '%' || p_search || '%')
        or (p_field = 'code' and d.member_code ilike '%' || p_search || '%')
        or (p_field not in ('national_id', 'code') and d.full_name ilike '%' || p_search || '%')
      )
      and (
        p_department_id is null
        or exists (
          select 1
          from public.member_departments md
          where md.member_id = d.member_id
            and md.year = p_year
            and md.month = p_month
            and md.department_id = p_department_id
        )
      )
  )
  select
    extract(day from rd.date)::integer as day,
    rd.shift_id,
    count(*)::bigint as cnt
  from public.roster_days rd
  join picked p on p.member_id = rd.member_id
  where rd.date >= make_date(p_year, p_month, 1)
    and rd.date < (make_date(p_year, p_month, 1) + interval '1 month')
  group by 1, 2;
$function$;

grant execute on function public.roster_day_totals(integer, integer, uuid, text, text, uuid) to authenticated;
