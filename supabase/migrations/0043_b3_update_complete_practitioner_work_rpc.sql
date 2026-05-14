-- B.3 — update complete_practitioner_work RPC
--
-- Changes:
--   1. event_type: 'practitioner_note' → 'practitioner_decision'
--   2. Payload: structured 8-field shape (replaces minimal 4-field shape)
--      Fields: work_item_id, work_type, decision, notes, recommendation,
--              practitioner_id, practitioner_display_name, completed_at
--   3. Resolves practitioner display_name via direct practitioners table read
--      (safe inside SECURITY DEFINER — no RLS friction).
--
-- Authorisation Layer 2 unchanged:
--   WHERE id = p_work_id AND practitioner_id = auth.uid()
--     AND status IN ('assigned', 'in_review') FOR UPDATE
--   Prevents any practitioner completing another's work item.
--
-- B.4 forward-compatibility: decision enum includes 'escalated' so the
-- escalation flow (B.4) requires no further constraint migration.

CREATE OR REPLACE FUNCTION public.complete_practitioner_work(
  p_work_id        uuid,
  p_decision       text,
  p_notes          text,
  p_recommendation text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_id                   uuid;
  v_work_type                 text;
  v_event_id                  uuid;
  v_practitioner_display_name text;
BEGIN
  -- Decision validation
  IF p_decision NOT IN ('approved', 'needs_revision', 'escalated') THEN
    RAISE EXCEPTION 'Invalid decision value: %', p_decision;
  END IF;

  -- Authorisation Layer 2: work item must belong to the calling practitioner
  -- and be in a completable state. FOR UPDATE prevents races.
  SELECT case_id, work_type
    INTO v_case_id, v_work_type
    FROM public.case_practitioner_work
   WHERE id              = p_work_id
     AND practitioner_id = auth.uid()
     AND status          IN ('assigned', 'in_review')
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work item not found or not in a completable state';
  END IF;

  -- Resolve practitioner display name for the audit payload.
  -- SECURITY DEFINER reads practitioners without RLS friction.
  -- display_name is NOT NULL in the practitioners table; SELECT INTO
  -- leaves v_practitioner_display_name NULL if no row found (defensive).
  SELECT display_name
    INTO v_practitioner_display_name
    FROM public.practitioners
   WHERE id = auth.uid();

  -- Write structured practitioner_decision event
  INSERT INTO public.case_events (
    case_id,
    event_type,
    source_table,
    source_id,
    event_payload
  )
  VALUES (
    v_case_id,
    'practitioner_decision',
    'case_practitioner_work',
    p_work_id,
    jsonb_build_object(
      'work_item_id',              p_work_id,
      'work_type',                 v_work_type,
      'decision',                  p_decision,
      'notes',                     p_notes,
      'recommendation',            p_recommendation,
      'practitioner_id',           auth.uid(),
      'practitioner_display_name', v_practitioner_display_name,
      'completed_at',              now()
    )
  )
  RETURNING id INTO v_event_id;

  -- Stamp completion on the work item
  UPDATE public.case_practitioner_work
     SET status          = 'completed',
         completed_at    = now(),
         output_event_id = v_event_id,
         notes           = p_notes
   WHERE id = p_work_id;

  RETURN v_event_id;
END;
$$;
