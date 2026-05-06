-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 0039_g1_fix_complete_practitioner_work_event_type
-- Fix: complete_practitioner_work() inserted event_type = work_type || '_completed'
--      (e.g. 'case_review_completed') which violates case_events_event_type_check.
--      The allowed values are the 7-value enum from the original case_events design.
--      Fix: use 'practitioner_note' — semantically correct for a practitioner
--      completing and annotating a work item.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.complete_practitioner_work(
  p_work_id        uuid,
  p_decision       text,
  p_notes          text,
  p_recommendation text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_case_id   uuid;
  v_work_type text;
  v_event_id  uuid;
BEGIN
  IF p_decision NOT IN ('approved', 'needs_revision', 'escalated') THEN
    RAISE EXCEPTION 'Invalid decision value: %', p_decision;
  END IF;

  SELECT case_id, work_type INTO v_case_id, v_work_type
  FROM case_practitioner_work
  WHERE id = p_work_id
    AND practitioner_id = auth.uid()
    AND status IN ('assigned', 'in_review')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work item not found or not in a completable state';
  END IF;

  INSERT INTO case_events (
    case_id, event_type, source_table, source_id, event_payload
  )
  VALUES (
    v_case_id,
    'practitioner_note',
    'case_practitioner_work',
    p_work_id,
    jsonb_build_object(
      'work_type',      v_work_type,
      'decision',       p_decision,
      'notes_summary',  p_notes,
      'recommendation', p_recommendation
    )
  )
  RETURNING id INTO v_event_id;

  UPDATE case_practitioner_work
  SET
    status          = 'completed',
    completed_at    = now(),
    output_event_id = v_event_id,
    notes           = p_notes
  WHERE id = p_work_id;

  RETURN v_event_id;
END;
$$;
