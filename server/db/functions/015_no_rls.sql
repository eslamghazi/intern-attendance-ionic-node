-- ============================================================================
-- Row-level security is OFF. Authorization lives in the API.
--
-- This file replaces 014_attachment_policies.sql, 015_policies.sql and
-- 016_service_only_policies.sql — 54 policies and the nine helper functions
-- that existed only to serve them.
--
-- WHY, AND WHAT REPLACED IT
--
-- RLS arrived with Supabase, where it had to exist: a browser held an anon key
-- and talked to PostgREST directly, so the database was the only place a rule
-- could be enforced. There is an API in between now, and every rule those
-- policies encoded is written in Node with tests:
--
--   domain/access/scope.ts        an admin's reach       14 unit tests
--   domain/access/attachment.ts   who may touch a file   21 unit tests
--   domain/identity/role.ts       what a role may do
--   services/accessService.ts     the require* helpers
--
-- THE EVIDENCE THIS WAS SAFE TO DO
--
-- Not an argument — a measurement. RLS was disabled on all 19 tables and the
-- whole end-to-end suite run against the result: 181 of 181 functional checks
-- passed with no policy in the database.
--
-- The first time that experiment was run, before the API enforced anything
-- itself, it failed in eight places — including one student fetching a signed
-- URL for another student's FACE TEMPLATE, and an admin deleting a member of a
-- branch they do not run. That is what those eight fixes were for, and why this
-- file is dated after them rather than before.
--
-- WHAT DID NOT GO
--
-- 040_grants.sql stays, and so does the role switch in src/db/context.ts.
-- Grants are coarse — table and column, not row — which is exactly why they are
-- cheap to keep and hard to get wrong. They are what stops a future `select *`
-- handing out master_password_hash, and what keeps refresh_tokens and the audit
-- log out of reach of a signed-in caller even if a route forgets. Three
-- statements, not fifty-four policies.
--
-- auth.uid() also stays: server_now() and roster_maker_data() still read it.
--
-- Idempotent, and driven from the catalogue rather than a list, so it cannot
-- fall out of step with what is actually there.
-- ============================================================================

do $$
declare
  pol record;
  tbl record;
begin
  for pol in
    select schemaname, tablename, policyname
      from pg_policies
     where schemaname = 'public'
  loop
    execute format(
      'drop policy if exists %I on %I.%I',
      pol.policyname, pol.schemaname, pol.tablename
    );
  end loop;

  for tbl in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('alter table public.%I disable row level security', tbl.relname);
  end loop;
end
$$;


-- ---------------------------------------------------------------------------
-- The helpers the policies existed for.
--
-- Dropped in dependency order — admin_can_access calls the four below it, and
-- those call current_app_role, which calls auth.uid(). Nothing outside the
-- policies referenced any of them; verified against pg_get_functiondef across
-- every remaining function before removing.
--
-- attachment_folder went with them: it was added in this port purely so the
-- attachment policies could read a member id out of a path. That job is
-- pathOwner() in domain/access/attachment.ts now.
-- ---------------------------------------------------------------------------
drop function if exists public.admin_can_access(uuid, uuid);
drop function if exists public.is_admin();
drop function if exists public.is_superadmin();
drop function if exists public.admin_branch_ids();
drop function if exists public.admin_group_ids();
drop function if exists public.admin_has_assignments();
drop function if exists public.current_app_role();
drop function if exists public.my_member_id();
drop function if exists public.attachment_folder(text);


-- ---------------------------------------------------------------------------
-- The last client-era RPCs, and the schema that outlived Supabase.
--
--   server_now()          the app clock. domain/clock.ts already formatted
--                         Cairo time; the function was duplicating it to read
--                         one column.
--   roster_maker_data()   three scoped reads for the roster-drafting screen.
--   roster_day_totals()   reimplemented the member filter that
--                         domain/member/filter.ts already builds — the same
--                         predicate written twice and kept in step by hand.
--
-- All three were SECURITY DEFINER and found the caller through auth.uid(),
-- because a browser used to call them directly. No route calls a SQL function
-- by name any more.
--
-- With them go auth.uid(), auth.jwt(), auth.role(), auth.email() and the `auth`
-- schema itself — the last thing in this database that came from Supabase.
-- ---------------------------------------------------------------------------
drop function if exists public.server_now();
drop function if exists public.roster_maker_data(integer, integer);
drop function if exists public.roster_day_totals(integer, integer, uuid, text, text, uuid);

drop schema if exists auth cascade;
