-- ──────────────────────────────────────────────────────────────────────────────
-- 0036_g1_client_cases_status.sql
-- Extends client_cases.status CHECK constraint with draft and intake_complete.
-- ──────────────────────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────────────────────
-- client_cases.status — persisted lifecycle states
--
-- Stored states (this column):
--   draft            case created; intake not yet complete
--   intake_complete  intake submitted; AI analysis pending or complete
--   active           ongoing case; protocol delivered or in delivery
--   paused           client or NI has paused the case temporarily
--   closed           case concluded (discharged, inactive, or resolved)
--
-- Derived states (NOT stored here — computed from related tables):
--   analysing        derived: reasoning_traces row exists with status != 'client_visible'
--   awaiting_review  derived: case_practitioner_work rows with status IN ('assigned','in_review')
--   follow_up_due    derived: follow-up date in case_events has passed without response
--
-- Never add derived states to this column. They are observable from the data.
-- ──────────────────────────────────────────────────────────────────────────────

ALTER TABLE client_cases
  DROP CONSTRAINT IF EXISTS client_cases_status_check,
  ADD CONSTRAINT client_cases_status_check
    CHECK (status IN ('draft', 'intake_complete', 'active', 'paused', 'closed'));
