-- 0052 — Narrow pre-anonymisation practitioner read grants (Sprint 3, Phase 5)
--
-- ⚠ COMMITTED AS A FILE ONLY — NOT YET APPLIED.
-- ⚠ COUPLING RULE: apply this migration ONLY together with the de-identified
--   review-pack rollout (0051 + practitioner workspace reading
--   practitioner_review_packs). Applying it alone removes practitioner access
--   with nothing to replace it; NOT applying it while packs ship would leave a
--   redaction layer on top of open raw access. One workstream, one switch.
--   (docs/governance/sprint3-safety-floor.md)
--
-- What it does: drops the five `practitioners_read_assigned_client` SELECT
-- policies added by 0048, which grant practitioners direct read access to
-- IDENTIFIED intake and BioHub rows for linked clients. After this migration,
-- practitioner access to client health data flows exclusively through
-- practitioner_review_packs (pseudonymous, de-identified). Member, admin and
-- service-role access is untouched.

DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.intake_responses;
DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.intake_answers;
DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.biomarker_results;
DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.biomarker_trajectory;
DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.lab_reports;

-- ── 0046 audit finding (second review, item 7) ────────────────────────────────
-- `case_practitioner_select` (F1, captured in 0046) grants a practitioner with
-- ANY work history on a case — including cancelled and declined work — SELECT
-- over client_cases rows, which carry client_id (identity linkage) and
-- primary_concern (user-entered free-text HEALTH context). Two problems, two
-- treatments:
--   a) status: cancelled/declined work must grant nothing → recreated below
--      with a status filter. 'completed' is retained deliberately: the care
--      inbox's Completed Recently / clinical-continuity sections need the
--      case row, and the row's non-concern fields (status, dates, complexity)
--      are operational, not clinical.
--   b) primary_concern free text: RLS cannot mask a column. The practitioner
--      workspace repoint (the other half of this coupled workstream) must stop
--      selecting primary_concern from client_cases — the de-identified review
--      pack carries the concern instead. Until the repoint lands, this
--      migration must not be applied (same coupling rule as above).

DROP POLICY IF EXISTS case_practitioner_select ON public.client_cases;
CREATE POLICY case_practitioner_select
  ON public.client_cases FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.case_practitioner_work cpw
      WHERE cpw.case_id         = client_cases.id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status IN ('assigned', 'in_review', 'escalated', 'completed')
    )
  );

-- NOTE for the same apply-window: the practitioner_client_personalisation view
-- and any helper still selecting raw intake/biohub rows for practitioners
-- (getIntakeSummary, getBioHubSignals) must be repointed at review packs first
-- — see the Sprint 3 PR "not completed" register.
