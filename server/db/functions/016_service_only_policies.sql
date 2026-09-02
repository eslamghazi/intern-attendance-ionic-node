-- ============================================================================
-- presence_checks, presence_confirmations, qr_tokens. AUTHORED — not generated.
--
-- These three arrived from Supabase with RLS ENABLED AND NO POLICIES, which
-- denies every row to everyone who does not bypass RLS. That is why every route
-- touching them runs as the service role: it is the only way they work at all.
--
-- The cost of that was not obvious until it was looked for. Because those
-- requests bypass RLS, `admin_can_access` — the rule that keeps an admin inside
-- their own branches — never applied to them, and `requireRole('admin')` was
-- the entire check. An admin assigned to one branch could open a spot-check
-- against another branch's members and read back their names, and mint a
-- check-in QR for a branch they do not run.
--
-- That is fixed in the API (src/services/accessService.ts, applied at six call
-- sites). These policies are the SECOND answer to the same question.
--
-- WHY BOTHER, IF THE SERVICE ROLE BYPASSES THEM ANYWAY
--
-- Because "deny everything" and "deny everything, because nobody has said what
-- is allowed" look identical from the database and mean very different things.
-- Written down:
--
--   * a route that switches to asCaller — the natural thing to reach for when
--     adding a read endpoint — is scoped correctly instead of silently empty,
--     which is the failure that sends someone to `asService` to "fix" it;
--   * the reach of each table is stated where the other 46 policies are stated,
--     rather than being a property of which helper a route happened to call;
--   * and if the API's check is ever removed or bypassed, this still holds.
--
-- Numbered 016 so it runs after 015, and skipped by the extractor
-- (AUTHORED_POLICIES) so a re-extract does not duplicate it.
-- ============================================================================

alter table public.presence_checks       enable row level security;
alter table public.presence_confirmations enable row level security;
alter table public.qr_tokens             enable row level security;


-- ---------------------------------------------------------------------------
-- presence_checks — a spot-check an admin opens against everyone on shift.
--
-- Readable by the admin who created it and by anyone whose reach covers the
-- branch or group it targets. A check with NEITHER set is faculty-wide, so only
-- an unrestricted scope sees it: admin_can_access(null, null) is true exactly
-- for a superadmin and for an admin with no assignments, which is the rule
-- already in force everywhere else.
-- ---------------------------------------------------------------------------
drop policy if exists "presence_checks_select" on public.presence_checks;
create policy "presence_checks_select" on public.presence_checks
  as permissive for select to authenticated
  using (created_by = auth.uid() or admin_can_access(group_id, branch_id));

drop policy if exists "presence_checks_insert" on public.presence_checks;
create policy "presence_checks_insert" on public.presence_checks
  as permissive for insert to authenticated
  with check (created_by = auth.uid() and admin_can_access(group_id, branch_id));

-- Only the admin who opened it may close or decide it. Not every admin who can
-- SEE it: resolving someone else's spot-check is not a mistake anyone makes by
-- accident, and there is no workflow that needs it.
drop policy if exists "presence_checks_update_own" on public.presence_checks;
create policy "presence_checks_update_own" on public.presence_checks
  as permissive for update to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "presence_checks_delete_own" on public.presence_checks;
create policy "presence_checks_delete_own" on public.presence_checks
  as permissive for delete to authenticated
  using (created_by = auth.uid() or is_superadmin());


-- ---------------------------------------------------------------------------
-- presence_confirmations — "I am here", answered by the member.
--
-- A member sees and writes only their OWN confirmation; the admin who opened
-- the check sees them all. Nothing lets a member see who else has answered:
-- that a colleague has not yet confirmed is the admin's information, not the
-- ward's.
-- ---------------------------------------------------------------------------
drop policy if exists "presence_confirmations_select" on public.presence_confirmations;
create policy "presence_confirmations_select" on public.presence_confirmations
  as permissive for select to authenticated
  using (
    member_id = my_member_id()
    or exists (
      select 1 from public.presence_checks c
       where c.id = check_id
         and (c.created_by = auth.uid() or admin_can_access(c.group_id, c.branch_id))
    )
  );

-- Confirming is the member's own act, and only against a check that actually
-- targets them — otherwise anyone could answer any check by guessing its id.
drop policy if exists "presence_confirmations_insert_self" on public.presence_confirmations;
create policy "presence_confirmations_insert_self" on public.presence_confirmations
  as permissive for insert to authenticated
  with check (
    member_id = my_member_id()
    and exists (
      select 1 from public.presence_checks c
       where c.id = check_id and my_member_id() = any (c.target_member_ids)
    )
  );


-- ---------------------------------------------------------------------------
-- qr_tokens — a short-lived check-in code for a branch.
--
-- No SELECT policy for `authenticated`, deliberately, and this is the one place
-- that absence is a decision rather than an oversight: the token column IS the
-- credential. Reading the table would hand a member every live code in the
-- faculty, which is exactly the geofence bypass QR check-in exists to control.
-- Redemption happens in the API as the service role, which looks the token up
-- by value — the only way it should ever be found.
--
-- Staff need to see the codes they issued to display them, and that is scoped
-- to the issuer.
-- ---------------------------------------------------------------------------
drop policy if exists "qr_tokens_select_own" on public.qr_tokens;
create policy "qr_tokens_select_own" on public.qr_tokens
  as permissive for select to authenticated
  using (created_by = auth.uid());

drop policy if exists "qr_tokens_insert_scoped" on public.qr_tokens;
create policy "qr_tokens_insert_scoped" on public.qr_tokens
  as permissive for insert to authenticated
  with check (created_by = auth.uid() and admin_can_access(null, branch_id));

drop policy if exists "qr_tokens_delete_own" on public.qr_tokens;
create policy "qr_tokens_delete_own" on public.qr_tokens
  as permissive for delete to authenticated
  using (created_by = auth.uid() or is_superadmin());
