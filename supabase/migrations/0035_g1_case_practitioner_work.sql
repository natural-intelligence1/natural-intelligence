-- ──────────────────────────────────────────────────────────────────────────────
-- 0035_g1_case_practitioner_work.sql
-- Creates case_practitioner_work table and complete_practitioner_work() RPC.
-- ──────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1: Table
-- ─────────────────────────────────────────────────────────────────────────────
-- ──────────────────────────────────────────────────────────────────────────────
-- case_practitioner_work
-- Records every work item assigned to a practitioner on a case.
-- Append-only audit log: rows are never deleted, only status-transitioned.
-- Active work: WHERE status IN ('assigned', 'in_review')
-- Full history: unrestricted
-- Practitioner inbox: WHERE practitioner_id = $uid AND status IN (...)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE case_practitioner_work (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Core references ────────────────────────────────────────────────────────
  case_id             uuid NOT NULL REFERENCES client_cases(id)
                        ON DELETE CASCADE,
  practitioner_id     uuid NOT NULL REFERENCES practitioners(id)
                        ON DELETE RESTRICT,

  -- ── Work classification ────────────────────────────────────────────────────
  work_type           text NOT NULL CHECK (work_type IN (
                        'case_review',
                        'safety_review',
                        'protocol_review',
                        'escalation_review',
                        'follow_up_review',
                        'specialist_consult'
                      )),

  -- ── Status ─────────────────────────────────────────────────────────────────
  status              text NOT NULL DEFAULT 'assigned' CHECK (status IN (
                        'assigned',
                        'in_review',
                        'completed',
                        'escalated',
                        'declined',
                        'cancelled'
                      )),

  -- ── Assignment provenance ──────────────────────────────────────────────────
  assigned_by         uuid NOT NULL REFERENCES auth.users(id)
                        ON DELETE RESTRICT,
  assignment_source   text NOT NULL DEFAULT 'admin' CHECK (
                        assignment_source IN (
                          'admin',
                          'matching_engine',
                          'auto_complexity_threshold'
                        )
                      ),

  -- ── Scheduling ────────────────────────────────────────────────────────────
  due_at              timestamptz,

  -- ── Audit timestamps ──────────────────────────────────────────────────────
  assigned_at         timestamptz NOT NULL DEFAULT now(),
  started_at          timestamptz,
  completed_at        timestamptz,
  escalated_at        timestamptz,
  escalation_reason   text,
  declined_at         timestamptz,
  decline_reason      text,
  cancelled_at        timestamptz,

  -- ── Output linkage ────────────────────────────────────────────────────────
  -- Populated atomically with status = 'completed'. Points to the case_events
  -- row that records the practitioner's structured output.
  output_event_id     uuid REFERENCES case_events(id),

  -- ── Practitioner notes ─────────────────────────────────────────────────────
  -- Internal only. Not client-visible.
  notes               text,

  -- ── Timestamps ─────────────────────────────────────────────────────────────
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2: Indexes
-- ─────────────────────────────────────────────────────────────────────────────
-- Practitioner inbox: all open work for a practitioner
CREATE INDEX idx_cpw_practitioner_status
  ON case_practitioner_work(practitioner_id, status);

-- Case detail view: all work on a case
CREATE INDEX idx_cpw_case_status
  ON case_practitioner_work(case_id, status);

-- Overdue detection
CREATE INDEX idx_cpw_status_due
  ON case_practitioner_work(status, due_at)
  WHERE due_at IS NOT NULL;

-- Prevent duplicate active work:
-- A practitioner cannot have two open items of the same type on the same case.
CREATE UNIQUE INDEX idx_cpw_no_duplicate_active
  ON case_practitioner_work(case_id, practitioner_id, work_type)
  WHERE status IN ('assigned', 'in_review');

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 3: Trigger
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TRIGGER case_practitioner_work_updated_at
  BEFORE UPDATE ON case_practitioner_work
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE case_practitioner_work ENABLE ROW LEVEL SECURITY;

-- Practitioner reads their own assigned work
CREATE POLICY work_practitioner_select ON case_practitioner_work
  FOR SELECT USING (practitioner_id = auth.uid());

-- Practitioner updates their own work
CREATE POLICY work_practitioner_update ON case_practitioner_work
  FOR UPDATE USING (practitioner_id = auth.uid());

-- Service role: unrestricted (admin app creates assignments)
CREATE POLICY work_service_all ON case_practitioner_work
  FOR ALL USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: complete_practitioner_work() RPC
-- Atomic: inserts case_events row + marks work complete in one transaction.
-- SECURITY DEFINER so the practitioner's anon-key session can execute it.
-- Validates p_decision before any writes (defence in depth).
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
  -- Validate decision value
  IF p_decision NOT IN ('approved', 'needs_revision', 'escalated') THEN
    RAISE EXCEPTION 'Invalid decision value: %', p_decision;
  END IF;

  -- Verify caller owns this work item and it is in a completable state
  SELECT case_id, work_type INTO v_case_id, v_work_type
  FROM case_practitioner_work
  WHERE id = p_work_id
    AND practitioner_id = auth.uid()
    AND status IN ('assigned', 'in_review')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work item not found or not in a completable state';
  END IF;

  -- Step A: Insert case_events row
  INSERT INTO case_events (
    case_id, event_type, source_table, source_id, event_payload
  )
  VALUES (
    v_case_id,
    v_work_type || '_completed',
    'case_practitioner_work',
    p_work_id,
    jsonb_build_object(
      'decision',       p_decision,
      'notes_summary',  p_notes,
      'recommendation', p_recommendation
    )
  )
  RETURNING id INTO v_event_id;

  -- Step B: Update work row atomically
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
