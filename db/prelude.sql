-- ============================================================================
-- Everything the models cannot express, that must exist BEFORE them.
--
-- drizzle-kit models tables, columns, indexes, foreign keys, policies, views
-- and enums. It does not model extensions or roles — yet the very first
-- CREATE TABLE needs `vector` and `geography` to exist, and the very first
-- CREATE POLICY needs `anon` and `authenticated` to exist.
--
-- Idempotent, and applied before every migration run.
--
-- Prerequisites on the server: postgis, pgvector and pg_cron must be installed
-- (see server/docker/Dockerfile.postgres). pg_cron additionally needs
-- shared_preload_libraries = 'pg_cron' and cron.database_name set to this
-- database, then a restart.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
--
-- pgcrypto goes into `public` because functions pinned to `search_path =
-- public` call `crypt()` unqualified, while others call `extensions.crypt()`.
-- One extension lives in one schema, so public wins and thin wrappers below
-- make the qualified form resolve too.
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto with schema public;
create extension if not exists postgis;
create extension if not exists vector;
create extension if not exists pg_cron;

create schema if not exists extensions;
-- Neither `auth` nor `storage` exists any more. Supabase Storage's schema went
-- in migration 0004 (public.attachments replaced it), and `auth` went with the
-- last three functions that read auth.uid() — see db/functions/015_no_rls.sql.
--
-- drizzle-kit still emits CREATE SCHEMA "auth" when it sees the pgSchema in the
-- models; the models no longer declare one.

create or replace function extensions.crypt(text, text) returns text
  language sql immutable strict parallel safe as $$ select public.crypt($1, $2) $$;
create or replace function extensions.gen_salt(text) returns text
  language sql volatile strict parallel restricted as $$ select public.gen_salt($1) $$;
create or replace function extensions.gen_salt(text, integer) returns text
  language sql volatile strict parallel restricted as $$ select public.gen_salt($1, $2) $$;
create or replace function extensions.digest(text, text) returns bytea
  language sql immutable strict parallel safe as $$ select public.digest($1, $2) $$;

-- ---------------------------------------------------------------------------
-- Roles
--
-- `anon` and `authenticated` are what the API switches into per request (see
-- src/db/context.ts), and every policy names one of them. `service_role`
-- matches the old Supabase semantics and is named by three policies.
--
-- `supabase_auth_admin` is NOT created. It was GoTrue's own role and owned the
-- auth schema; GoTrue is gone and so is auth.users. A restored database still
-- has the role — dropping it would need every one of its grants reassigned
-- first, for no gain — but nothing here creates or grants to it any more.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$$;

-- The API's login role must be able to SET ROLE into these.
do $$
begin
  execute format('grant anon, authenticated, service_role to %I', current_user);
exception when others then
  null; -- already a member, or current_user is a superuser
end
$$;

grant usage on schema public, extensions
  to anon, authenticated, service_role;
