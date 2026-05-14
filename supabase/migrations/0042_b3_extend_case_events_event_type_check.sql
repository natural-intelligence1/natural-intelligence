-- B.3 — extend case_events event_type check constraint
--
-- Adds 'practitioner_decision' as an allowed event_type.
-- The complete_practitioner_work RPC (migration 0043) will write this type
-- for all completion events going forward.
--
-- Historical rows with event_type = 'practitioner_note' are retained as-is.
-- The CaseHistoryPanel renders both labels:
--   practitioner_note:      'Practitioner note'
--   practitioner_decision:  'Practitioner decision'
--
-- Safe pattern: DROP IF EXISTS then ADD avoids duplicate constraint error
-- on re-run.

ALTER TABLE public.case_events
  DROP CONSTRAINT IF EXISTS case_events_event_type_check;

ALTER TABLE public.case_events
  ADD CONSTRAINT case_events_event_type_check
  CHECK (event_type IN (
    'intake_answer',
    'follow_up_answer',
    'lab_upload',
    'gp_record_upload',
    'grocery_receipt',
    'practitioner_note',
    'practitioner_decision',
    'protocol_update'
  ));
