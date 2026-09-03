-- ============================================================================
-- Functions this project ADDS. AUTHORED — not generated.
--
-- 010_functions.sql is generated from a reference database: it is the set the
-- Supabase schema already had. These three are new, so they live in their own
-- file, and scripts/extract-programmables.mjs skips them by name — otherwise a
-- re-extract would either duplicate them or capture a stale copy.
--
-- Numbered 012 so it runs after 010, which defines auth.uid().
--
-- set_member_password() used to live here too. It has moved to
-- src/services/authService.ts with the other five password functions; there is
-- no password handling left in SQL. See 005_drop_retired.sql.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- time_minutes / slot_concluded
--
-- "Can this slot still be checked into?" A member who has not checked in is
-- only ABSENT once they can no longer check in — after that shift's check-out
-- window closes. Until then the slot is pending: they might walk in five
-- minutes from now.
--
-- The rule already existed TWICE — in the record-attendance Edge Function and
-- again in the client — and the two had to be kept in step by hand, because one
-- decides whether a check-in is accepted and the other decides whether the UI
-- may call the slot an absence. Having it in SQL means the reports are computed
-- in the database instead of downloading a month of roster rows to the phone,
-- and there is one definition instead of two that can drift.
--
-- Defaults match the recorder: check-in opens 30 minutes before the late
-- boundary, check-out closes 180 minutes after it opens, and a window that
-- reads earlier on the clock than check-in open belongs to the next day —
-- which is what makes overnight shifts work.
-- ---------------------------------------------------------------------------
create or replace function public.time_minutes(p_time text)
returns integer language sql immutable parallel safe as $$
  select case
           when p_time is null or p_time = '' then 0
           else extract(hour from p_time::time)::int * 60
              + extract(minute from p_time::time)::int
         end
$$;

create or replace function public.slot_concluded(p_date date, p_shift_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  enforce  boolean;
  d_start  text;
  d_end    text;
  sh       record;
  cairo    timestamp;
  today    date;
  now_min  int;
  ci_late  int;
  co_open  int;
  ci_open  int;
  co_close int;
  slot_end int;
  end_date date;
begin
  select coalesce(s.enforce_shift_window, true), s.shift_start::text, s.shift_end::text
    into enforce, d_start, d_end
    from public.app_settings s where s.id = 1;

  cairo   := now() at time zone 'Africa/Cairo';
  today   := cairo::date;
  now_min := extract(hour from cairo)::int * 60 + extract(minute from cairo)::int;

  if p_shift_id is not null then
    select checkin_open::text   as checkin_open,
           checkin_late::text   as checkin_late,
           checkout_open::text  as checkout_open,
           checkout_close::text as checkout_close
      into sh
      from public.shifts where id = p_shift_id;
  end if;

  -- With shift windows NOT enforced there is no deadline before midnight — a
  -- member may check in any time that day — so the whole date has to pass.
  if p_shift_id is null or sh is null or not coalesce(enforce, true) then
    return p_date < today;
  end if;

  ci_late  := public.time_minutes(coalesce(sh.checkin_late, d_start));
  co_open  := public.time_minutes(coalesce(sh.checkout_open, d_end));
  ci_open  := case when sh.checkin_open is not null
                   then public.time_minutes(sh.checkin_open)
                   else ((ci_late - 30) % 1440 + 1440) % 1440 end;
  co_close := case when sh.checkout_close is not null
                   then public.time_minutes(sh.checkout_close)
                   else ((co_open + 180) % 1440 + 1440) % 1440 end;

  -- Anchored at check-in open: a close time that reads earlier is the next day.
  slot_end := case when co_close < ci_open then co_close + 1440 else co_close end;
  end_date := p_date + (slot_end / 1440);

  if today <> end_date then
    return today > end_date;
  end if;
  return now_min >= (slot_end % 1440);
end $$;

grant execute on function public.time_minutes(text)
  to authenticated, anon, service_role;
grant execute on function public.slot_concluded(date, uuid)
  to authenticated, anon, service_role;

-- attachment_folder() lived here. It existed only so the attachment policies
-- could read a member id out of a path; that is pathOwner() in
-- domain/access/attachment.ts now. See 015_no_rls.sql.
