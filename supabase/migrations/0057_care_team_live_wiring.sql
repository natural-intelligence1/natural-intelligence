-- ──────────────────────────────────────────────────────────────────────────────
-- 0057_care_team_live_wiring.sql  (REVISED per KR/Orchestrator review)
-- SPRINT 6 — Care Team live wiring: client-level relationship, CASE-level
-- roles, and the scoped Active Care Health Profile surface.
--
-- STATUS: FILE ONLY — NOT APPLIED. Requires separate KR authorisation.
--
-- PLAIN ENGLISH: makes the approved workflow real and fail-closed:
--   ADMIN ASSIGNS → CLIENT APPROVES → PRACTITIONER CONTRIBUTES → LEAD COORDINATES
--
-- TWO-LEVEL ARCHITECTURE (revision issue 1):
--   CLIENT LEVEL — "does this client have an approved relationship and
--   data-sharing approval with this practitioner?"
--     • client_practitioner_links (0038) — UNCHANGED by this migration;
--     • consent_records purpose 'practitioner_access' + context_practitioner_id
--       (added here) — the legal authorisation, versioned and withdrawable.
--   CASE LEVEL — "what role does this practitioner hold on THIS case?"
--     • NEW slim table case_team_roles: Lead / Care Team / Student per case,
--       with supervisor, lifecycle (started/ended) and assignment provenance.
--       case_practitioner_work stays what it is — per-item WORK (its rows are
--       assigned→completed tasks); a STANDING clinical role does not fit work
--       semantics, so the smallest robust case-level primitive is this one
--       role table, not a reshaping of the work log and not a generic
--       Care Team platform.
--   EXACTLY ONE ACTIVE LEAD **PER CASE** (partial unique index) — a second
--   case for the same client may hold its own Lead; an ENDED lead never
--   blocks a successor.
--
-- TWO ACCESS MODES (revision issue 2) — kept strictly distinct:
--   MODE 1 (pre-care review): de-identified review pack + minimal case index.
--     Sprint 5 (0052) UNTOUCHED: no policy on any raw source table is
--     created or restored here — practitioners still cannot SELECT
--     intake_responses / intake_answers / client_cases / profiles / lab
--     tables directly.
--   MODE 2 (active care): the NEW scoped view care_team_health_profile —
--     one standard bundle, no field-by-field permissions — readable ONLY
--     while ALL hold: active client-level relationship (link not ended),
--     active case_team_roles row for the caller on that case
--     (admin-assigned), caller still passes the Sprint 4 eligibility
--     function, active client 'practitioner_access' consent for that
--     practitioner, and (students) active supervision. Withdrawal, ending
--     the relationship or ending the role each removes future access
--     immediately on its own.
--
-- Also retained from the approved pre-flight: practitioner_case_index is
-- recreated WITHOUT case_complexity_score (unused remnant, no writer, all
-- zeros; column kept inert). escalation_required stays — it is set only by
-- a human practitioner via complete_practitioner_work (0045), never
-- algorithmically.

-- ═══ 1. CASE-LEVEL ROLES — case_team_roles ═══════════════════════════════════

CREATE TABLE IF NOT EXISTS public.case_team_roles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id),
  team_role       TEXT NOT NULL CHECK (team_role IN ('lead','care_team','student')),
  supervisor_id   UUID REFERENCES public.practitioners(id),
  assigned_by     UUID NOT NULL REFERENCES auth.users(id),
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  end_reason      TEXT,
  CONSTRAINT case_team_student_requires_supervisor
    CHECK (team_role <> 'student' OR supervisor_id IS NOT NULL)
);

-- EXACTLY ONE ACTIVE LEAD PER CASE (not per client): historical/ended leads
-- never block; a second practitioner-led case for the same client may hold
-- its own Lead.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_lead_per_case
  ON public.case_team_roles (case_id)
  WHERE team_role = 'lead' AND ended_at IS NULL;

-- One active role per practitioner per case (a person holds one role at a
-- time on a case; role changes end the old row and insert a new one).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_role_per_practitioner_case
  ON public.case_team_roles (case_id, practitioner_id)
  WHERE ended_at IS NULL;

ALTER TABLE public.case_team_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manage case team roles" ON public.case_team_roles;
CREATE POLICY "Admin manage case team roles"
  ON public.case_team_roles FOR ALL USING (is_admin());
DROP POLICY IF EXISTS "Practitioner reads own case roles" ON public.case_team_roles;
CREATE POLICY "Practitioner reads own case roles"
  ON public.case_team_roles FOR SELECT TO authenticated
  USING (practitioner_id = auth.uid() OR supervisor_id = auth.uid());
-- No practitioner INSERT/UPDATE policies: assignment is admin/service only
-- (V1: ONLY Admin assigns), and the trigger below binds every role.

-- Rules trigger (fires for EVERY role incl. service):
--   • Sprint 4 eligibility gate REUSED (practitioner_assignment_eligibility,
--     0056) — agreement, credentials, indemnity, scope, lifecycle;
--   • Category 3 (unregistered / NI Verified) cannot be the (sole) Lead —
--     with one-active-lead-per-case, the Lead IS the sole Lead; class comes
--     from practitioners.category, never modality;
--   • a student's supervisor must hold an ACTIVE non-student role ON THE
--     SAME CASE (active supervision relationship).
CREATE OR REPLACE FUNCTION public.enforce_case_team_role_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category TEXT;
  v_eligible BOOLEAN;
  v_reasons  TEXT[];
BEGIN
  IF NEW.ended_at IS NOT NULL THEN RETURN NEW; END IF; -- ending is always allowed

  SELECT e.eligible, e.reasons INTO v_eligible, v_reasons
    FROM public.practitioner_assignment_eligibility(NEW.practitioner_id) e;
  IF v_eligible IS NOT TRUE THEN
    RAISE EXCEPTION 'care team: practitioner not assignable: %', array_to_string(v_reasons, ', ')
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.team_role = 'lead' THEN
    SELECT category INTO v_category FROM public.practitioners WHERE id = NEW.practitioner_id;
    IF v_category = 'unregistered' THEN
      RAISE EXCEPTION 'care team: an NI Verified Practitioner (Category 3) cannot be the sole Lead Responsible Practitioner'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.team_role = 'student' THEN
    IF NEW.supervisor_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.case_team_roles s
       WHERE s.case_id = NEW.case_id
         AND s.practitioner_id = NEW.supervisor_id
         AND s.team_role <> 'student'
         AND s.ended_at IS NULL
    ) THEN
      RAISE EXCEPTION 'care team: a Student Practitioner requires a named supervisor holding an active role on the same case'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_case_team_role_rules ON public.case_team_roles;
CREATE TRIGGER trg_case_team_role_rules
  BEFORE INSERT OR UPDATE ON public.case_team_roles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_case_team_role_rules();

-- ═══ 2. CLIENT approval through the EXISTING consent architecture ═══════════
-- New granular purpose 'practitioner_access', scoped per practitioner. The
-- legal authorisation is ALWAYS this consent record — never a boolean on
-- the relationship. Versioned, timestamped, withdrawable via the same RPC.

ALTER TABLE public.consent_records
  ADD COLUMN IF NOT EXISTS context_practitioner_id UUID REFERENCES public.practitioners(id);

ALTER TABLE public.consent_records
  DROP CONSTRAINT IF EXISTS consent_records_consent_type_check;
ALTER TABLE public.consent_records
  ADD CONSTRAINT consent_records_consent_type_check CHECK (consent_type IN (
    'platform_terms', 'data_processing', 'record_holding',
    'deidentified_synopsis_sharing', 'ai_assisted_processing',
    'retention_beyond_episode', 'anonymised_research',
    'practitioner_access'
  )) NOT VALID;

DROP FUNCTION IF EXISTS public.withdraw_own_consent(TEXT);
CREATE OR REPLACE FUNCTION public.withdraw_own_consent(
  p_consent_type TEXT,
  p_context_practitioner_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  IF p_consent_type NOT IN (
    'record_holding', 'deidentified_synopsis_sharing', 'ai_assisted_processing',
    'retention_beyond_episode', 'anonymised_research', 'practitioner_access'
  ) THEN
    IF p_consent_type IN ('platform_terms', 'data_processing') THEN
      RAISE EXCEPTION 'withdraw_own_consent: % must be withdrawn via a rights request, not this function', p_consent_type
        USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'withdraw_own_consent: unknown consent purpose %', p_consent_type
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.consent_records
     SET withdrawn_at = now()
   WHERE profile_id = auth.uid()
     AND consent_type = p_consent_type
     AND withdrawn_at IS NULL
     AND (p_context_practitioner_id IS NULL
          OR context_practitioner_id = p_context_practitioner_id);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_own_consent(TEXT, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.withdraw_own_consent(TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_practitioner_access_consent(
  p_member_id UUID, p_practitioner_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.consent_records c
     WHERE c.profile_id = p_member_id
       AND c.consent_type = 'practitioner_access'
       AND c.context_practitioner_id = p_practitioner_id
       AND c.consented IS TRUE
       AND c.withdrawn_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.has_practitioner_access_consent(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.has_practitioner_access_consent(UUID, UUID) TO authenticated, service_role;

-- ═══ 3. ACTIVE-CARE authorisation predicate (Mode 2 gate, one place) ════════
-- ALL of: active CLIENT-level relationship (client_practitioner_links row,
-- not ended) · active CASE role (admin-assigned) · Sprint 4 eligibility
-- still passing · active client consent for THIS practitioner · (students)
-- active supervision on the same case. Both architecture levels gate the
-- surface: ending the relationship, the case role or the consent each cuts
-- access on its own. Fail-closed.

CREATE OR REPLACE FUNCTION public.can_access_case_care_profile(p_case_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client UUID;
  v_role RECORD;
  v_eligible BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;

  SELECT client_id INTO v_client FROM public.client_cases WHERE id = p_case_id;
  IF v_client IS NULL THEN RETURN FALSE; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.client_practitioner_links l
     WHERE l.client_id = v_client AND l.practitioner_id = auth.uid()
       AND l.ended_at IS NULL
  ) THEN RETURN FALSE; END IF;

  SELECT * INTO v_role FROM public.case_team_roles
   WHERE case_id = p_case_id AND practitioner_id = auth.uid() AND ended_at IS NULL
   LIMIT 1;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  SELECT e.eligible INTO v_eligible FROM public.practitioner_assignment_eligibility(auth.uid()) e;
  IF v_eligible IS NOT TRUE THEN RETURN FALSE; END IF;

  IF NOT public.has_practitioner_access_consent(v_client, auth.uid()) THEN RETURN FALSE; END IF;

  IF v_role.team_role = 'student' THEN
    IF v_role.supervisor_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.case_team_roles s
       WHERE s.case_id = p_case_id AND s.practitioner_id = v_role.supervisor_id
         AND s.team_role <> 'student' AND s.ended_at IS NULL
    ) THEN RETURN FALSE; END IF;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.can_access_case_care_profile(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.can_access_case_care_profile(UUID) TO authenticated, service_role;

-- ═══ 4. MODE 2 — the scoped Active Care Health Profile (ONE bundle) ═════════
-- Purpose-built view; raw tables stay closed (0052 untouched). Owner rights
-- + security_barrier: the WHERE clause IS the access rule. Exposed fields —
-- documented and deliberate:
--   IDENTITY (minimum necessary to know whom you are caring for):
--     client_full_name (profiles.full_name). NO email / phone / address.
--   CASE:    case_id, case_status, presenting_concern (client_cases),
--            escalation_required (human-set).
--   CARE CONTEXT: biological_sex (user_personalisation) — clinically
--     necessary for nutrition practice.
--   FACTUAL INTAKE RECORD (latest COMPLETED intake_responses row — drafts
--     never surface): arrival_emotion, primary_concerns, primary_system,
--     stress_level, sleep_quality, energy_level, current_medications,
--     current_supplements, symptom_onset, diagnosed_conditions,
--     timeline_last_well, timeline_trigger, diet_description,
--     most_want_to_understand.
--   Contributions, corrections and Analysis & Plan live in their own tables
--   below with the same gate.
--   EXPLICITLY NOT EXPOSED: email/phone (auth.users — never joined),
--   address (no such column exists), user_personalisation.religion,
--   religious_content_preference and clinical_notes_on_sex, avatar/bio,
--   credentials/login data, admin notes, other cases, other clients,
--   platform analytics. profiles has no separate preferred-name column
--   today; full_name is the single identity field surfaced.

CREATE OR REPLACE VIEW public.care_team_health_profile
  WITH (security_barrier = true) AS
  SELECT
    cc.id                    AS case_id,
    cc.status                AS case_status,
    cc.primary_concern       AS presenting_concern,
    cc.escalation_required,
    p.full_name              AS client_full_name,
    up.biological_sex,
    ir.arrival_emotion,
    ir.primary_concerns,
    ir.primary_system,
    ir.stress_level,
    ir.sleep_quality,
    ir.energy_level,
    ir.current_medications,
    ir.current_supplements,
    ir.symptom_onset,
    ir.diagnosed_conditions,
    ir.timeline_last_well,
    ir.timeline_trigger,
    ir.diet_description,
    ir.most_want_to_understand
  FROM public.client_cases cc
  JOIN public.profiles p ON p.id = cc.client_id
  LEFT JOIN public.user_personalisation up ON up.user_id = cc.client_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.intake_responses r
     WHERE r.member_id = cc.client_id
       AND r.is_complete IS TRUE
     ORDER BY r.created_at DESC
     LIMIT 1
  ) ir ON true
  WHERE public.can_access_case_care_profile(cc.id);

-- SELECT-only, explicitly (Supabase default privileges would otherwise
-- leave ALL granted; the JOIN makes the view non-updatable regardless).
REVOKE ALL    ON public.care_team_health_profile FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON public.care_team_health_profile TO authenticated;

COMMENT ON VIEW public.care_team_health_profile IS
  'Sprint 6 MODE 2 (active care): the ONE scoped Care Team Health Profile '
  'bundle. Requires active case role + Sprint 4 eligibility + active '
  'practitioner_access consent (+ active supervision for students). Raw '
  'source tables remain closed to practitioners (0052).';

-- Assigned-cases list for the practitioner portal (active care only —
-- includes the client name because assignment AND consent already hold).
CREATE OR REPLACE VIEW public.practitioner_assigned_cases
  WITH (security_barrier = true) AS
  SELECT
    r.id          AS role_id,
    r.case_id,
    r.team_role,
    r.supervisor_id,
    r.started_at  AS assigned_at,
    cc.status     AS case_status,
    p.full_name   AS client_full_name
  FROM public.case_team_roles r
  JOIN public.client_cases cc ON cc.id = r.case_id
  JOIN public.profiles p ON p.id = cc.client_id
  WHERE r.practitioner_id = auth.uid()
    AND r.ended_at IS NULL
    AND public.can_access_case_care_profile(r.case_id);

REVOKE ALL    ON public.practitioner_assigned_cases FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON public.practitioner_assigned_cases TO authenticated;

-- ═══ 5. Contributions — contribute, never overwrite (append-only) ═══════════

CREATE TABLE IF NOT EXISTS public.case_contributions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES public.practitioners(id),
  team_role       TEXT NOT NULL CHECK (team_role IN ('lead','care_team','student')),
  profession      TEXT,
  kind            TEXT NOT NULL CHECK (kind IN ('verification','correction','addition','professional_contribution')),
  content         TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'consultation',
  client_confirmed BOOLEAN NOT NULL DEFAULT false,
  supervisor_verified_by UUID REFERENCES public.practitioners(id),
  supervisor_verified_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.case_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read contributions" ON public.case_contributions;
CREATE POLICY "Admin read contributions"
  ON public.case_contributions FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Active team read contributions" ON public.case_contributions;
CREATE POLICY "Active team read contributions"
  ON public.case_contributions FOR SELECT TO authenticated
  USING (public.can_access_case_care_profile(case_id));
DROP POLICY IF EXISTS "Author inserts own contribution" ON public.case_contributions;
CREATE POLICY "Author inserts own contribution"
  ON public.case_contributions FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND public.can_access_case_care_profile(case_id));
-- Append-only: no UPDATE/DELETE policies; the trigger below also blocks
-- content rewrites for EVERY role (service-role DELETE remains for
-- retention/GDPR operations only).

CREATE OR REPLACE FUNCTION public.block_contribution_rewrite()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.author_id IS DISTINCT FROM OLD.author_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'contributions are append-only: record a new contribution instead of rewriting'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_block_contribution_rewrite ON public.case_contributions;
CREATE TRIGGER trg_block_contribution_rewrite
  BEFORE UPDATE ON public.case_contributions
  FOR EACH ROW EXECUTE FUNCTION public.block_contribution_rewrite();

-- ═══ 6. Analysis & Plan — authoritative practitioner-only authorship ════════

CREATE TABLE IF NOT EXISTS public.case_analysis_plan (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  section    TEXT NOT NULL CHECK (section IN (
               'antecedents','triggers','mediators','systems_under_stress',
               'red_flags_referrals','nutritional_assessment','therapeutic_aims',
               'diet_lifestyle_plan','supplement_plan','review_interval',
               'future_considerations')),
  content    TEXT NOT NULL,
  author_id  UUID NOT NULL REFERENCES public.practitioners(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.case_analysis_plan ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read analysis" ON public.case_analysis_plan;
CREATE POLICY "Admin read analysis"
  ON public.case_analysis_plan FOR SELECT USING (is_admin());
-- Students read the factual record but NOT Analysis & Plan (narrower
-- student scope, simple guard — no permission matrix).
DROP POLICY IF EXISTS "Active team read analysis" ON public.case_analysis_plan;
CREATE POLICY "Active team read analysis"
  ON public.case_analysis_plan FOR SELECT TO authenticated
  USING (
    public.can_access_case_care_profile(case_id)
    AND EXISTS (
      SELECT 1 FROM public.case_team_roles r
       WHERE r.case_id = case_analysis_plan.case_id
         AND r.practitioner_id = auth.uid()
         AND r.ended_at IS NULL
         AND r.team_role <> 'student'
    )
  );
DROP POLICY IF EXISTS "Practitioner authors analysis" ON public.case_analysis_plan;
CREATE POLICY "Practitioner authors analysis"
  ON public.case_analysis_plan FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());

-- The trigger is the gate for EVERY role: service-role (AI, automated jobs,
-- admin server actions, intake, synopsis generation) has NULL auth.uid()
-- and is refused; students refused; only an authenticated practitioner
-- with a full active-care authorisation and a NON-STUDENT role authors.
CREATE OR REPLACE FUNCTION public.enforce_analysis_author()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'analysis is append-only: write a new section version instead of editing'
      USING ERRCODE = 'check_violation';
  END IF;

  IF auth.uid() IS NULL OR NEW.author_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'analysis & plan: only the authenticated authoring practitioner may write'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT public.can_access_case_care_profile(NEW.case_id) OR NOT EXISTS (
    SELECT 1 FROM public.case_team_roles r
     WHERE r.case_id = NEW.case_id AND r.practitioner_id = NEW.author_id
       AND r.ended_at IS NULL AND r.team_role <> 'student'
  ) THEN
    RAISE EXCEPTION 'analysis & plan: author has no active authorised non-student role on this case'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_analysis_author ON public.case_analysis_plan;
CREATE TRIGGER trg_enforce_analysis_author
  BEFORE INSERT OR UPDATE ON public.case_analysis_plan
  FOR EACH ROW EXECUTE FUNCTION public.enforce_analysis_author();

-- ═══ 7. Lead coordination + plan release (per-CASE, workflow-state only) ════

CREATE TABLE IF NOT EXISTS public.care_plan_coordination (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id           UUID NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  lead_id           UUID NOT NULL REFERENCES public.practitioners(id),
  coordination_note TEXT,
  reviewed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at       TIMESTAMPTZ,
  released_by       UUID REFERENCES public.practitioners(id)
);
ALTER TABLE public.care_plan_coordination ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin read coordination" ON public.care_plan_coordination;
CREATE POLICY "Admin read coordination"
  ON public.care_plan_coordination FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Active team read coordination" ON public.care_plan_coordination;
CREATE POLICY "Active team read coordination"
  ON public.care_plan_coordination FOR SELECT TO authenticated
  USING (public.can_access_case_care_profile(case_id));
-- Writes ONLY via the two RPCs (no INSERT/UPDATE policies).

CREATE OR REPLACE FUNCTION public.record_lead_coordination_review(
  p_case_id UUID, p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok BOOLEAN;
  v_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.case_team_roles
     WHERE case_id = p_case_id AND practitioner_id = auth.uid()
       AND team_role = 'lead' AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'coordination review: caller is not the active Lead Responsible Practitioner for this case';
  END IF;
  SELECT e.eligible INTO v_ok FROM public.practitioner_assignment_eligibility(auth.uid()) e;
  IF v_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'coordination review: Lead no longer passes assignment eligibility';
  END IF;

  INSERT INTO public.care_plan_coordination (case_id, lead_id, coordination_note)
  VALUES (p_case_id, auth.uid(), p_note)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_care_plan(p_case_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok BOOLEAN;
  v_coord UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.case_team_roles
     WHERE case_id = p_case_id AND practitioner_id = auth.uid()
       AND team_role = 'lead' AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'plan release: caller is not the active Lead Responsible Practitioner for this case';
  END IF;
  SELECT e.eligible INTO v_ok FROM public.practitioner_assignment_eligibility(auth.uid()) e;
  IF v_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'plan release: Lead no longer passes assignment eligibility';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.case_analysis_plan WHERE case_id = p_case_id) THEN
    RAISE EXCEPTION 'plan release: no practitioner-authored Analysis & Plan content exists for this case';
  END IF;
  SELECT id INTO v_coord FROM public.care_plan_coordination
   WHERE case_id = p_case_id AND lead_id = auth.uid() AND released_at IS NULL
   ORDER BY reviewed_at DESC LIMIT 1;
  IF v_coord IS NULL THEN
    RAISE EXCEPTION 'plan release: no recorded Lead coordination review exists for this case';
  END IF;

  UPDATE public.care_plan_coordination
     SET released_at = now(), released_by = auth.uid()
   WHERE id = v_coord;
  RETURN v_coord;
END;
$$;

REVOKE ALL ON FUNCTION public.record_lead_coordination_review(UUID, TEXT) FROM public;
REVOKE ALL ON FUNCTION public.release_care_plan(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.record_lead_coordination_review(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_care_plan(UUID) TO authenticated;

-- ═══ 8. PRE-FLIGHT (retained): score off the practitioner case index ════════
-- DROP + CREATE, not CREATE OR REPLACE: PostgreSQL refuses to remove or
-- reorder view columns in-place, and this view loses case_complexity_score.
-- No object depends on the view (verified in pg_depend pre-apply).

DROP VIEW IF EXISTS public.practitioner_case_index;
CREATE VIEW public.practitioner_case_index
  WITH (security_barrier = true) AS
  SELECT
    cc.id,
    cc.status,
    cc.escalation_required,
    cc.created_at
  FROM public.client_cases cc
  WHERE EXISTS (
    SELECT 1
    FROM public.case_practitioner_work cpw
    WHERE cpw.case_id         = cc.id
      AND cpw.practitioner_id = auth.uid()
      AND cpw.status IN ('assigned', 'in_review', 'escalated')
  );

-- Privileges restated EXPLICITLY and SELECT-only. Two reasons: Supabase
-- default privileges grant ALL on newly created objects to anon and
-- authenticated, and this single-table view is auto-updatable — with
-- owner rights, anything beyond SELECT would let a practitioner with an
-- active work item WRITE to client_cases through the view. (The 0052
-- incarnation carried those default ALL grants; this recreation closes
-- that too.)
REVOKE ALL    ON public.practitioner_case_index FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON public.practitioner_case_index TO authenticated;

-- ═══ EXPECTED EFFECT ON EXISTING ROWS ════════════════════════════════════════
-- Entirely additive: new table/views/functions; consent CHECK widened (NOT
-- VALID, so historical rows unaffected); withdraw RPC replaced with a
-- superset signature; no existing row is modified; live client_practitioner
-- _links (0 rows) and case_practitioner_work (3 rows) untouched;
-- practitioner_case_index loses one column practitioners never used
-- (all-zero, writerless).

-- ═══ Post-apply assertions (all must hold) ═══════════════════════════════════
-- 1. Second active lead on the SAME case → unique violation
--    (uniq_active_lead_per_case). A DIFFERENT case for the same client may
--    take its own lead; an ended lead never blocks a successor.
-- 2. Category 3 lead refused; ineligible practitioner refused (0056 reuse);
--    student without an active same-case supervisor refused.
-- 3. care_team_health_profile returns rows ONLY under relationship+role+
--    eligibility+consent (+supervision); consent withdrawal, relationship
--    ending or role ending empties it immediately; students see the
--    factual bundle but not analysis rows.
-- 4. The same authorised practitioner still gets ZERO rows selecting
--    intake_responses / intake_answers / client_cases / profiles / lab
--    tables directly (0052 intact — no new policy touches raw tables).
-- 5. Analysis & Plan: service-role/NULL-auth writes refused; student writes
--    refused; non-involved practitioner refused; authorised practitioner
--    passes; UPDATE refused (append-only).
-- 6. release_care_plan refused without a recorded coordination review by
--    the active, still-eligible per-case Lead; succeeds after it.
-- 7. practitioner_case_index no longer lists case_complexity_score.

-- ═══ REVERT BLOCK (do not run unless authorised) ═════════════════════════════
-- DROP VIEW IF EXISTS public.practitioner_assigned_cases;
-- DROP VIEW IF EXISTS public.care_team_health_profile;
-- DROP TRIGGER IF EXISTS trg_case_team_role_rules ON public.case_team_roles;
-- DROP TRIGGER IF EXISTS trg_block_contribution_rewrite ON public.case_contributions;
-- DROP TRIGGER IF EXISTS trg_enforce_analysis_author ON public.case_analysis_plan;
-- DROP FUNCTION IF EXISTS public.enforce_case_team_role_rules();
-- DROP FUNCTION IF EXISTS public.block_contribution_rewrite();
-- DROP FUNCTION IF EXISTS public.enforce_analysis_author();
-- DROP FUNCTION IF EXISTS public.record_lead_coordination_review(UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.release_care_plan(UUID);
-- DROP FUNCTION IF EXISTS public.can_access_case_care_profile(UUID);
-- DROP FUNCTION IF EXISTS public.has_practitioner_access_consent(UUID, UUID);
-- DROP INDEX IF EXISTS uniq_active_lead_per_case;
-- DROP INDEX IF EXISTS uniq_active_role_per_practitioner_case;
-- (consent CHECK / withdraw RPC revert: re-apply the 0051 definitions.
--  case_team_roles / case_contributions / case_analysis_plan /
--  care_plan_coordination become data-bearing once used — no drop without a
--  retention decision. practitioner_case_index revert: DROP VIEW then
--  re-run 0052's CREATE + its REVOKE/GRANT lines, and keep the grants
--  SELECT-only — the 0052 incarnation was auto-updatable with default ALL
--  grants, which this migration deliberately closes.)
