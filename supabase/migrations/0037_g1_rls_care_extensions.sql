-- ──────────────────────────────────────────────────────────────────────────────
-- 0037_g1_rls_care_extensions.sql
-- Adds practitioner SELECT policies to case tables.
-- Practitioners may read a case only when they have active work on it.
-- Defence-in-depth: middleware gate ensures only active practitioners reach
-- apps/care; these policies enforce row-level isolation within the DB.
-- ──────────────────────────────────────────────────────────────────────────────

-- client_cases: practitioner can read a case if they have active work on it
CREATE POLICY case_practitioner_select ON client_cases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM case_practitioner_work cpw
      WHERE cpw.case_id = client_cases.id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status IN ('assigned', 'in_review')
    )
  );

-- case_events: same scope
CREATE POLICY case_events_practitioner_select ON case_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM case_practitioner_work cpw
      WHERE cpw.case_id = case_events.case_id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status IN ('assigned', 'in_review')
    )
  );

-- reasoning_traces: same scope
CREATE POLICY reasoning_traces_practitioner_select ON reasoning_traces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM case_practitioner_work cpw
      WHERE cpw.case_id = reasoning_traces.case_id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status IN ('assigned', 'in_review')
    )
  );

-- reasoning_trace_entries: same scope
-- Practitioners see ALL visibility levels (internal, practitioner, client)
-- for cases they are actively working on. This is intentional.
CREATE POLICY reasoning_trace_entries_practitioner_select
  ON reasoning_trace_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM case_practitioner_work cpw
      WHERE cpw.case_id = reasoning_trace_entries.case_id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status IN ('assigned', 'in_review')
    )
  );
