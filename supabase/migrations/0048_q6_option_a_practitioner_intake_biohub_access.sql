-- Q6 Option A — practitioner-scoped RLS on intake + biohub tables
--
-- Closes the Q6 sunset condition documented in the Phase B addendum.
-- Five tables (intake_responses, intake_answers, biomarker_results,
-- biomarker_trajectory, lab_reports) gain a practitioner SELECT policy
-- granting read access to rows whose member_id maps (via
-- client_cases.client_id) to a case_practitioner_work row owned by the
-- calling practitioner.
--
-- Direct-join pattern across all 5 tables:
--   • Each table has a member_id uuid column populated by the member.
--   • client_cases.client_id is the same uuid (a member's user id).
--   • case_practitioner_work links practitioner ↔ case ↔ client.
--
-- No status filter on cpw — matches the F1 principle: any work history on
-- a case grants read access to the linked client's intake + biohub data.
-- This is the same access shape the practitioner_client_personalisation
-- view uses (PS.1) and case_practitioner_select on client_cases uses (F1).
--
-- Idempotent: DROP POLICY IF EXISTS + CREATE POLICY for each table.
-- Re-running this migration against a DB that already has the policies
-- recreates them with identical bodies.
--
-- Effect on existing callers:
--   • Member policies preserved unchanged (each member still reads own row)
--   • Admin policies preserved unchanged (admin role retains full access)
--   • Service-role policies preserved unchanged (admin client still works)
--   • NEW: authenticated practitioner reads only the rows for clients they
--     have case_practitioner_work for. Cross-practitioner enumeration stays
--     blocked.

-- ── 1. intake_responses ──────────────────────────────────────────────────────

DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.intake_responses;
CREATE POLICY practitioners_read_assigned_client
  ON public.intake_responses FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.case_practitioner_work cpw
      JOIN public.client_cases cc ON cc.id = cpw.case_id
      WHERE cc.client_id        = intake_responses.member_id
        AND cpw.practitioner_id = auth.uid()
    )
  );

-- ── 2. intake_answers ────────────────────────────────────────────────────────
-- Direct member_id join (NOT via intake_response_id) — the table carries
-- member_id directly, matching the existing "Members manage own intake
-- answers" policy shape.

DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.intake_answers;
CREATE POLICY practitioners_read_assigned_client
  ON public.intake_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.case_practitioner_work cpw
      JOIN public.client_cases cc ON cc.id = cpw.case_id
      WHERE cc.client_id        = intake_answers.member_id
        AND cpw.practitioner_id = auth.uid()
    )
  );

-- ── 3. biomarker_results ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.biomarker_results;
CREATE POLICY practitioners_read_assigned_client
  ON public.biomarker_results FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.case_practitioner_work cpw
      JOIN public.client_cases cc ON cc.id = cpw.case_id
      WHERE cc.client_id        = biomarker_results.member_id
        AND cpw.practitioner_id = auth.uid()
    )
  );

-- ── 4. biomarker_trajectory ──────────────────────────────────────────────────
-- Not consumed by any current practitioner helper, but added per the Q6
-- sunset condition so future helpers (Phase D / protocol layer) have
-- practitioner-scoped access without further migration.

DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.biomarker_trajectory;
CREATE POLICY practitioners_read_assigned_client
  ON public.biomarker_trajectory FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.case_practitioner_work cpw
      JOIN public.client_cases cc ON cc.id = cpw.case_id
      WHERE cc.client_id        = biomarker_trajectory.member_id
        AND cpw.practitioner_id = auth.uid()
    )
  );

-- ── 5. lab_reports ───────────────────────────────────────────────────────────
-- Read access needed so the biomarker_results FK join in getBioHubSignals
-- (lab_reports ( report_date )) resolves under PostgREST's row-level
-- security model. Write access (insert/update) remains member-only.

DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.lab_reports;
CREATE POLICY practitioners_read_assigned_client
  ON public.lab_reports FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.case_practitioner_work cpw
      JOIN public.client_cases cc ON cc.id = cpw.case_id
      WHERE cc.client_id        = lab_reports.member_id
        AND cpw.practitioner_id = auth.uid()
    )
  );
