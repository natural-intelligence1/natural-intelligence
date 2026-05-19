-- F1 backfill — close drift between live DB and migrations/
--
-- The F1 fix was applied to the live dev DB on 2026-05-11 as
-- `extend_case_practitioner_select_all_statuses` (DB migration timestamp
-- 20260511010633) but never written to supabase/migrations/. The 0040 slot
-- was used by an unrelated V.8 fix, so the F1 corrective DDL existed only
-- in the live DB until now. `supabase db reset` from a clean checkout would
-- produce a DB where practitioners cannot read client_cases joined to
-- completed/escalated work — breaking the Completed Recently and Escalated
-- inbox sections.
--
-- This migration captures the live policy state verbatim so the migrations
-- directory becomes reproducible.
--
-- Pre-F1 (from 0037_g1_rls_care_extensions.sql line 10):
--   EXISTS subquery had `AND cpw.status IN ('assigned','in_review')` appended.
-- Post-F1 (live, this file):
--   Status clause dropped. A practitioner who holds any work item on a case
--   has clinical-continuity read interest regardless of work status. Cross-
--   practitioner scope still enforced by `cpw.practitioner_id = auth.uid()`.
--
-- Idempotent (DROP IF EXISTS + CREATE): safe to run against the live DB
-- where the policy already exists, and against a fresh DB.

DROP POLICY IF EXISTS case_practitioner_select
  ON public.client_cases;

CREATE POLICY case_practitioner_select
  ON public.client_cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.case_practitioner_work cpw
      WHERE cpw.case_id        = client_cases.id
        AND cpw.practitioner_id = auth.uid()
    )
  );
