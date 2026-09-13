-- 0054 — Revert the temporary founder-preview intake allowlist (0053)
--
-- PURPOSE: 0053 restricted intake writes to one named founder-preview
-- account while intake was closed to everyone else. FOUNDER RULING
-- (KR, 13 September 2026, recorded in
-- docs/governance/open-intake-founder-ruling.md): intake now opens to ALL
-- authenticated users, gated in the app by INTAKE_COLLECTION_ENABLED.
-- This migration restores the pre-0053 policy surface exactly.
--
-- What it does:
--   • restores the original "Members manage own …" FOR ALL own-row policies
--     on intake_responses, intake_answers and intake_sessions;
--   • removes the twelve 0053 policies and the allowlist function.
-- What it does NOT do:
--   • no change to admin / practitioner / service-role policies;
--   • ai_summaries keeps its service-role-only write posture (untouched);
--   • INTAKE_ASSIGNMENT_ENABLED remains off — nothing here routes, assigns,
--     creates client_cases/case_practitioner_work or grants practitioner
--     visibility.
--
-- ROLLBACK: re-apply the policy section of 0053 verbatim (the function and
-- twelve policies) — it is retained in the repo for exactly that purpose.

-- ── intake_responses ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members read own intake"              ON public.intake_responses;
DROP POLICY IF EXISTS "Founder preview writes own intake"    ON public.intake_responses;
DROP POLICY IF EXISTS "Founder preview updates own intake"   ON public.intake_responses;
DROP POLICY IF EXISTS "Founder preview deletes own intake"   ON public.intake_responses;
DROP POLICY IF EXISTS "Members manage own intake"            ON public.intake_responses;
CREATE POLICY "Members manage own intake"
  ON public.intake_responses FOR ALL TO authenticated
  USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());

-- ── intake_answers ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members read own intake answers"              ON public.intake_answers;
DROP POLICY IF EXISTS "Founder preview writes own intake answers"    ON public.intake_answers;
DROP POLICY IF EXISTS "Founder preview updates own intake answers"   ON public.intake_answers;
DROP POLICY IF EXISTS "Founder preview deletes own intake answers"   ON public.intake_answers;
DROP POLICY IF EXISTS "Members manage own intake answers"            ON public.intake_answers;
CREATE POLICY "Members manage own intake answers"
  ON public.intake_answers FOR ALL TO authenticated
  USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());

-- ── intake_sessions ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Members read own intake sessions"              ON public.intake_sessions;
DROP POLICY IF EXISTS "Founder preview writes own intake sessions"    ON public.intake_sessions;
DROP POLICY IF EXISTS "Founder preview updates own intake sessions"   ON public.intake_sessions;
DROP POLICY IF EXISTS "Founder preview deletes own intake sessions"   ON public.intake_sessions;
DROP POLICY IF EXISTS "Members manage own intake sessions"            ON public.intake_sessions;
CREATE POLICY "Members manage own intake sessions"
  ON public.intake_sessions FOR ALL TO authenticated
  USING (member_id = auth.uid()) WITH CHECK (member_id = auth.uid());

-- ── Allowlist function ────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.is_intake_preview_account();

-- ── Post-apply assertions (all must hold) ─────────────────────────────────────
-- 1. Each intake table has exactly ONE member policy again ('Members manage
--    own …', cmd = ALL) plus its pre-existing admin/practitioner/service
--    policies; no 'Founder preview' or 'Members read own' policy remains:
--      SELECT tablename, policyname, cmd FROM pg_policies
--      WHERE schemaname='public'
--        AND tablename IN ('intake_responses','intake_answers','intake_sessions')
--      ORDER BY tablename, policyname;
-- 2. The allowlist function is gone:
--      SELECT count(*) FROM pg_proc WHERE proname='is_intake_preview_account';
--      → 0
-- 3. ai_summaries still has NO authenticated write policy (service-role only).
