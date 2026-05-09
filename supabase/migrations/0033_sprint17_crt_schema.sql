-- Sprint 17 — Clinical Reasoning Trace (CRT) schema
-- Applied to live DB via Supabase MCP. DDL extracted from information_schema
-- and pg_catalog on 2026-05-09.
--
-- Idempotent: CREATE TABLE / INDEX use IF NOT EXISTS; triggers use
-- DROP IF EXISTS before CREATE; policies use DROP IF EXISTS before CREATE.
-- Safe to apply against both fresh and existing databases.
--
-- Tables created:
--   client_cases, case_events, reasoning_traces, reasoning_trace_entries

-- ─── client_cases ─────────────────────────────────────────────────────────────
-- One active case per client. Tracks primary concern, complexity, escalation.

CREATE TABLE IF NOT EXISTS public.client_cases (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id             uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status                text        NOT NULL DEFAULT 'active'
    CONSTRAINT client_cases_status_check
      CHECK (status = ANY (ARRAY['draft','intake_complete','active','paused','closed'])),
  primary_concern       text,
  case_complexity_score integer     NOT NULL DEFAULT 0,
  escalation_required   boolean     NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_cases_client_id
  ON public.client_cases USING btree (client_id);

DROP TRIGGER IF EXISTS trg_client_cases_updated_at ON public.client_cases;
CREATE TRIGGER trg_client_cases_updated_at
  BEFORE UPDATE ON public.client_cases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.client_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_cases_service_all ON public.client_cases;
CREATE POLICY client_cases_service_all
  ON public.client_cases
  FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS client_cases_member_select ON public.client_cases;
CREATE POLICY client_cases_member_select
  ON public.client_cases
  FOR SELECT
  USING (auth.uid() = client_id);

DROP POLICY IF EXISTS case_practitioner_select ON public.client_cases;
CREATE POLICY case_practitioner_select
  ON public.client_cases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.case_practitioner_work cpw
      WHERE cpw.case_id = client_cases.id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status = ANY (ARRAY['assigned'::text, 'in_review'::text])
    )
  );

-- ─── case_events ──────────────────────────────────────────────────────────────
-- Append-only log of all CRT inputs (intake answers, lab uploads, etc.).

CREATE TABLE IF NOT EXISTS public.case_events (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id       uuid        NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  event_type    text        NOT NULL
    CONSTRAINT case_events_event_type_check
      CHECK (event_type = ANY (ARRAY[
        'intake_answer','follow_up_answer','lab_upload',
        'gp_record_upload','grocery_receipt',
        'practitioner_note','protocol_update'
      ])),
  source_table  text,
  source_id     uuid,
  event_payload jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_events_case_id
  ON public.case_events USING btree (case_id);

ALTER TABLE public.case_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS case_events_service_all ON public.case_events;
CREATE POLICY case_events_service_all
  ON public.case_events
  FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS case_events_member_select ON public.case_events;
CREATE POLICY case_events_member_select
  ON public.case_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.client_cases cc
      WHERE cc.id = case_events.case_id
        AND cc.client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS case_events_practitioner_select ON public.case_events;
CREATE POLICY case_events_practitioner_select
  ON public.case_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.case_practitioner_work cpw
      WHERE cpw.case_id = case_events.case_id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status = ANY (ARRAY['assigned'::text, 'in_review'::text])
    )
  );

-- ─── reasoning_traces ─────────────────────────────────────────────────────────
-- One per major reasoning cycle (intake_analysis, lab_analysis, etc.).

CREATE TABLE IF NOT EXISTS public.reasoning_traces (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id      uuid        NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  trace_type   text        NOT NULL
    CONSTRAINT reasoning_traces_trace_type_check
      CHECK (trace_type = ANY (ARRAY[
        'intake_analysis','lab_analysis','food_analysis',
        'protocol_generation','weekly_review','practitioner_review'
      ])),
  status       text        NOT NULL DEFAULT 'draft'
    CONSTRAINT reasoning_traces_status_check
      CHECK (status = ANY (ARRAY['draft','ready_for_review','reviewed','client_visible'])),
  summary      text,
  generated_by text        NOT NULL DEFAULT 'ai'
    CONSTRAINT reasoning_traces_generated_by_check
      CHECK (generated_by = ANY (ARRAY['ai','practitioner','hybrid'])),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reasoning_traces_case_id
  ON public.reasoning_traces USING btree (case_id);

DROP TRIGGER IF EXISTS trg_reasoning_traces_updated_at ON public.reasoning_traces;
CREATE TRIGGER trg_reasoning_traces_updated_at
  BEFORE UPDATE ON public.reasoning_traces
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.reasoning_traces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reasoning_traces_service_all ON public.reasoning_traces;
CREATE POLICY reasoning_traces_service_all
  ON public.reasoning_traces
  FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS reasoning_traces_member_select ON public.reasoning_traces;
CREATE POLICY reasoning_traces_member_select
  ON public.reasoning_traces
  FOR SELECT
  USING (
    status = 'client_visible'
    AND EXISTS (
      SELECT 1 FROM public.client_cases cc
      WHERE cc.id = reasoning_traces.case_id
        AND cc.client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS reasoning_traces_practitioner_select ON public.reasoning_traces;
CREATE POLICY reasoning_traces_practitioner_select
  ON public.reasoning_traces
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.case_practitioner_work cpw
      WHERE cpw.case_id = reasoning_traces.case_id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status = ANY (ARRAY['assigned'::text, 'in_review'::text])
    )
  );

-- ─── reasoning_trace_entries ──────────────────────────────────────────────────
-- Individual agent writes. Append-only — never overwritten.

CREATE TABLE IF NOT EXISTS public.reasoning_trace_entries (
  id               uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trace_id         uuid        NOT NULL REFERENCES public.reasoning_traces(id) ON DELETE CASCADE,
  case_id          uuid        NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  agent_name       text        NOT NULL
    CONSTRAINT reasoning_trace_entries_agent_name_check
      CHECK (agent_name = ANY (ARRAY[
        'case_historian','medical_records','food_environment',
        'root_cause','protocol_builder','safety_scope','practitioner_review'
      ])),
  entry_type       text        NOT NULL
    CONSTRAINT reasoning_trace_entries_entry_type_check
      CHECK (entry_type = ANY (ARRAY[
        'observation','hypothesis','evidence_for','evidence_against',
        'weighting','decision','uncertainty','recommendation',
        'escalation_flag','practitioner_comment','client_explanation'
      ])),
  system_area      text,
  hypothesis_key   text,
  content          text        NOT NULL,
  evidence_payload jsonb       NOT NULL DEFAULT '{}',
  confidence       numeric
    CONSTRAINT reasoning_trace_entries_confidence_check
      CHECK (confidence >= 0 AND confidence <= 1),
  priority         integer,
  visibility       text        NOT NULL DEFAULT 'practitioner'
    CONSTRAINT reasoning_trace_entries_visibility_check
      CHECK (visibility = ANY (ARRAY['internal','practitioner','client'])),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reasoning_trace_entries_trace_id
  ON public.reasoning_trace_entries USING btree (trace_id);

CREATE INDEX IF NOT EXISTS idx_reasoning_trace_entries_type
  ON public.reasoning_trace_entries USING btree (entry_type);

CREATE INDEX IF NOT EXISTS idx_reasoning_trace_entries_visibility
  ON public.reasoning_trace_entries USING btree (visibility);

ALTER TABLE public.reasoning_trace_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reasoning_trace_entries_service_all ON public.reasoning_trace_entries;
CREATE POLICY reasoning_trace_entries_service_all
  ON public.reasoning_trace_entries
  FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS reasoning_trace_entries_member_select ON public.reasoning_trace_entries;
CREATE POLICY reasoning_trace_entries_member_select
  ON public.reasoning_trace_entries
  FOR SELECT
  USING (
    visibility = 'client'
    AND EXISTS (
      SELECT 1
      FROM public.reasoning_traces rt
      JOIN public.client_cases cc ON cc.id = rt.case_id
      WHERE rt.id = reasoning_trace_entries.trace_id
        AND rt.status = 'client_visible'
        AND cc.client_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS reasoning_trace_entries_practitioner_select ON public.reasoning_trace_entries;
CREATE POLICY reasoning_trace_entries_practitioner_select
  ON public.reasoning_trace_entries
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.case_practitioner_work cpw
      WHERE cpw.case_id = reasoning_trace_entries.case_id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status = ANY (ARRAY['assigned'::text, 'in_review'::text])
    )
  );
