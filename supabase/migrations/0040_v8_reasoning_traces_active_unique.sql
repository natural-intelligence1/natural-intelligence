-- V.8 M2 — Partial unique index: one client_visible trace per case per type
--
-- Prevents concurrent generateBodyStory calls from writing duplicate
-- client_visible traces.  A partial index (WHERE status = 'client_visible')
-- allows multiple draft/ready_for_review rows while enforcing uniqueness
-- only on the single promoted trace.

CREATE UNIQUE INDEX IF NOT EXISTS idx_reasoning_traces_one_active_per_case_type
  ON public.reasoning_traces (case_id, trace_type)
  WHERE status = 'client_visible';
