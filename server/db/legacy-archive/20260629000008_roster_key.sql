-- ============================================================================
-- Roster "key": a short code the superadmin types. It is the matching value in
-- the Excel/CSV sheet used to assign rosters to students (national_id, key).
-- ============================================================================

alter table public.rosters add column if not exists key text;

-- Keys are unique (case-insensitive) so the Excel mapping is unambiguous.
create unique index if not exists rosters_key_unique
  on public.rosters (lower(key))
  where key is not null;
