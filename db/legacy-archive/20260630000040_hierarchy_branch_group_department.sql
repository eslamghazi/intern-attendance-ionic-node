-- Correct the hierarchy: Institution → Branch (hospital) → Group (batch), and a
-- Department belongs to exactly ONE branch (hospital), not an institution.
-- Additive/non-breaking: existing columns stay; new parent links are added.

-- Branch (hospital) belongs to an institution.
alter table public.hospitals
  add column if not exists institution_id uuid references public.institutions(id) on delete set null;

-- Group (batch) belongs to a branch (hospital). institution_id stays for the
-- member-code composition and existing data; it can be derived from the branch.
alter table public.batches
  add column if not exists hospital_id uuid references public.hospitals(id) on delete set null;

-- Department belongs to one branch. (Cleaner than many-to-many: "ICU @ branch A"
-- and "ICU @ branch B" are separate rows, and a member is only ever offered
-- their own branch's departments.)
alter table public.departments
  add column if not exists hospital_id uuid references public.hospitals(id) on delete cascade;

-- The earlier (incorrect) department↔institution link is replaced by the branch
-- link above.
drop table if exists public.department_institutions;
