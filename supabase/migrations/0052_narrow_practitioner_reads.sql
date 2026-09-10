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

-- NOTE for the same apply-window: the practitioner_client_personalisation view
-- and any helper still selecting raw intake/biohub rows for practitioners
-- (getIntakeSummary, getBioHubSignals) must be repointed at review packs first
-- — see the Sprint 3 PR "not completed" register.
