-- 0053 — FOUNDER-PREVIEW intake write allowlist (TEMPORARY, pre-Sprint 3)
--
-- ⚠ COMMITTED AS A FILE ONLY — NOT YET APPLIED.
-- ⚠ TEMPORARY measure: this exists ONLY so that one named founder-preview
--   account can walk the intake journey while intake stays closed for
--   everyone else. It must be REVERTED OR SUPERSEDED when Sprint 3 lands /
--   intake opens properly (see the revert block at the bottom).
--
-- Why: the app layer already allowlists a single account
-- (INTAKE_PREVIEW_ALLOWLIST_EMAILS, exact matching), but the live RLS
-- policies "Members manage own intake [answers|sessions]" are FOR ALL, so
-- any authenticated member could still hand-craft own-row intake writes with
-- their own token, bypassing the app. RLS cannot read env vars, so the
-- allowlist must be mirrored here as an explicit policy condition.
--
-- What it does (and does NOT do):
--   • Member WRITES (INSERT/UPDATE/DELETE) on intake_responses,
--     intake_answers and intake_sessions become own-row AND
--     allowlisted-account-only.
--   • Member READS of their own rows are unchanged (dashboards keep working).
--   • Admin read policies, practitioner read policies and service-role
--     policies are untouched.
--   • ai_summaries needs no change: it has NO authenticated write policy
--     (service-role writes only) — verified against live pg_policies.
--   • INTAKE_COLLECTION_ENABLED / INTAKE_ASSIGNMENT_ENABLED are untouched;
--     no assignment, no case_practitioner_work, no practitioner visibility
--     arises from this migration.

-- ── Allowlist predicate ───────────────────────────────────────────────────────
-- Exact, lower-cased email match against the ONE named account. JWT email is
-- set by Supabase Auth; a missing email denies. GRANTed to authenticated so
-- tests can probe it (it reveals only the caller's own membership: boolean).
CREATE OR REPLACE FUNCTION public.is_intake_preview_account()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'saimakhalil@gmail.com'
$$;

REVOKE ALL ON FUNCTION public.is_intake_preview_account() FROM public;
GRANT EXECUTE ON FUNCTION public.is_intake_preview_account() TO authenticated;

-- ── intake_responses ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members manage own intake" ON public.intake_responses;
CREATE POLICY "Members read own intake"
  ON public.intake_responses FOR SELECT TO authenticated
  USING (member_id = auth.uid());
CREATE POLICY "Founder preview writes own intake"
  ON public.intake_responses FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid() AND public.is_intake_preview_account());
CREATE POLICY "Founder preview updates own intake"
  ON public.intake_responses FOR UPDATE TO authenticated
  USING (member_id = auth.uid() AND public.is_intake_preview_account())
  WITH CHECK (member_id = auth.uid() AND public.is_intake_preview_account());
CREATE POLICY "Founder preview deletes own intake"
  ON public.intake_responses FOR DELETE TO authenticated
  USING (member_id = auth.uid() AND public.is_intake_preview_account());

-- ── intake_answers ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members manage own intake answers" ON public.intake_answers;
CREATE POLICY "Members read own intake answers"
  ON public.intake_answers FOR SELECT TO authenticated
  USING (member_id = auth.uid());
CREATE POLICY "Founder preview writes own intake answers"
  ON public.intake_answers FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid() AND public.is_intake_preview_account());
CREATE POLICY "Founder preview updates own intake answers"
  ON public.intake_answers FOR UPDATE TO authenticated
  USING (member_id = auth.uid() AND public.is_intake_preview_account())
  WITH CHECK (member_id = auth.uid() AND public.is_intake_preview_account());
CREATE POLICY "Founder preview deletes own intake answers"
  ON public.intake_answers FOR DELETE TO authenticated
  USING (member_id = auth.uid() AND public.is_intake_preview_account());

-- ── intake_sessions ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members manage own intake sessions" ON public.intake_sessions;
CREATE POLICY "Members read own intake sessions"
  ON public.intake_sessions FOR SELECT TO authenticated
  USING (member_id = auth.uid());
CREATE POLICY "Founder preview writes own intake sessions"
  ON public.intake_sessions FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid() AND public.is_intake_preview_account());
CREATE POLICY "Founder preview updates own intake sessions"
  ON public.intake_sessions FOR UPDATE TO authenticated
  USING (member_id = auth.uid() AND public.is_intake_preview_account())
  WITH CHECK (member_id = auth.uid() AND public.is_intake_preview_account());
CREATE POLICY "Founder preview deletes own intake sessions"
  ON public.intake_sessions FOR DELETE TO authenticated
  USING (member_id = auth.uid() AND public.is_intake_preview_account());

-- ── Post-apply assertions (run manually; all must hold) ──────────────────────
-- 1. No FOR ALL member policy remains on the three intake tables:
--      SELECT tablename, policyname, cmd FROM pg_policies
--      WHERE schemaname='public'
--        AND tablename IN ('intake_responses','intake_answers','intake_sessions')
--      ORDER BY tablename, cmd;
--    → member writes appear ONLY as the "Founder preview …" policies.
-- 2. ai_summaries still has no authenticated INSERT policy.
-- 3. As a synthetic non-allowlisted member: INSERT into each table is refused
--    (the self-skipping tests in packages/db/src/rls/founderPreviewIntake.test.ts
--    prove exactly this and arm automatically once this migration is applied).

-- ── REVERT (when Sprint 3 lands / intake opens properly) ─────────────────────
-- Drop the nine "Founder preview …" + three "Members read own …" policies and
-- restore the original member policies, e.g. for intake_responses:
--   CREATE POLICY "Members manage own intake" ON public.intake_responses
--     FOR ALL TO authenticated
--     USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());
-- (and equivalents for intake_answers / intake_sessions), then
--   DROP FUNCTION public.is_intake_preview_account();
-- Sprint 3's consent gates are the permanent replacement for this file.
