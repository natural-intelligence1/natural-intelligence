-- F3 — extend case_events_practitioner_select RLS policy
--
-- Finding: practitioners cannot read case_events once their work item is
-- completed or escalated. The policy gated on status IN ('assigned','in_review'),
-- which mirrors the pre-F1 bug on case_practitioner_work.
--
-- Impact: CaseHistoryPanel shows "No events recorded" for completed work items.
-- Practitioners lose visibility of the full case timeline — including the
-- practitioner_decision event they just wrote — immediately after submitting.
--
-- Fix: extend status filter to match the F1 pattern (all non-terminal statuses
-- visible to the assigned practitioner). Cancelled/declined items excluded to
-- avoid surfacing events for abandoned work.
--
-- Pattern: DROP + CREATE (idempotent on re-run).

DROP POLICY IF EXISTS case_events_practitioner_select ON public.case_events;

CREATE POLICY case_events_practitioner_select ON public.case_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.case_practitioner_work cpw
      WHERE cpw.case_id        = case_events.case_id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status          IN ('assigned', 'in_review', 'completed', 'escalated')
    )
  );
