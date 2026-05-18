-- B.4 — extend complete_practitioner_work RPC for escalation path
--
-- Two atomic behaviour changes when p_decision = 'escalated':
--   1. case_practitioner_work.status → 'escalated' (was always 'completed')
--   2. client_cases.escalation_required → true   (new — was never touched)
--
-- For 'approved' and 'needs_revision', existing behaviour is preserved.
--
-- All three writes (case_events insert, case_practitioner_work update,
-- client_cases update for the escalation case) happen inside the same
-- SECURITY DEFINER transaction. If any one fails, none commit.
--
-- The Layer 2 auth check remains: WHERE id = p_work_id AND
-- practitioner_id = auth.uid() AND status IN ('assigned','in_review') FOR
-- UPDATE. Escalation paths must go through the same gate — a practitioner
-- cannot escalate someone else's work.

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

  -- Stamp the work item.
  --   Escalated decisions → status='escalated'
  --   Approved / needs_revision → status='completed'
  -- completed_at is stamped in either case — the escalation IS the completion
  -- of this practitioner's work on the item.
  UPDATE public.case_practitioner_work
     SET status          = CASE WHEN p_decision = 'escalated'
                                THEN 'escalated'
                                ELSE 'completed'
                           END,
         completed_at    = now(),
         output_event_id = v_event_id,
         notes           = p_notes
   WHERE id = p_work_id;

  -- Escalation: raise the case-level flag so admin queries can find this case.
  -- Atomic with the work-item update above (same transaction).
  IF p_decision = 'escalated' THEN
    UPDATE public.client_cases
       SET escalation_required = true
     WHERE id = v_case_id;
  END IF;

  RETURN v_event_id;
END;
$$;
