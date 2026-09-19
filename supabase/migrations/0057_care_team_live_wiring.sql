-- ──────────────────────────────────────────────────────────────────────────────
-- 0057_care_team_live_wiring.sql
-- SPRINT 6 — Care Team live wiring, on the EXISTING relationship architecture.
--
-- STATUS: FILE ONLY — NOT APPLIED. Applying to the shared database requires
-- separate KR authorisation (Sprint 6 §14 founder stop).
--
-- PLAIN ENGLISH: this migration makes the approved simple workflow
--   ADMIN ASSIGNS → CLIENT APPROVES → PRACTITIONER CONTRIBUTES → LEAD COORDINATES
-- real and fail-closed at the database, by:
--   1. extending client_practitioner_links with the 'student' team role and a
--      named supervisor, and enforcing: at most ONE active Lead per client,
--      no NI Verified (Category 3) practitioner as the (sole) Lead, and no
--      student without an actively-linked supervisor;
--   2. recording the client's approval through the EXISTING versioned consent
--      machinery — a new granular purpose 'practitioner_access' scoped to one
--      practitioner (context_practitioner_id), withdrawable through the same
--      withdraw_own_consent RPC — never a bare boolean;
--   3. a pseudonymous practitioner_assigned_clients view (assignment + consent
--      + active link required; NO client identity columns — Sprint 5 stands);
--   4. an append-only case_contributions table (contribute, never overwrite);
--   5. an authoritative case_analysis_plan table where ONLY the authenticated
--      authoring practitioner with an active non-student involvement can
--      write (service-role/AI/admin/student/intake writes refused by trigger);
--   6. a two-step plan-release workflow gate: the active, still-eligible Lead
--      records a coordination review, then releases — pure workflow state,
--      no software judgement of the plan;
--   7. PRE-FLIGHT FINDING APPLIED: practitioner_case_index is recreated
--      WITHOUT case_complexity_score (a never-written schema remnant named
--      for a prohibited auto-scoring concept; the column itself is kept,
--      inert, off the practitioner surface). escalation_required stays: it
--      is set only by a human practitioner through the 0045 escalation path.
--
-- REUSED, NOT REPLACED: client_practitioner_links (0038, incl. its existing
-- 'lead' role and ended_at lifecycle), the 0056 eligibility trigger (already
-- fires on links INSERT — Sprint 4 gate is inherited automatically),
-- consent_records + withdraw_own_consent (0051), case_practitioner_work,
-- and the Sprint 5 pack-only data-access model (untouched).

-- ═══ 1. Team roles + supervisor on the EXISTING links table ═════════════════

ALTER TABLE public.client_practitioner_links
  DROP CONSTRAINT IF EXISTS client_practitioner_links_role_check;
ALTER TABLE public.client_practitioner_links
  ADD CONSTRAINT client_practitioner_links_role_check CHECK (role IN (
    'lead',        -- Lead Responsible Practitioner
    'specialist',  -- Care Team Practitioner (existing value, kept)
    'reviewer', 'temporary',  -- existing values, kept valid
    'student'      -- NEW: supervised training status — never a class
  ));

ALTER TABLE public.client_practitioner_links
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES public.practitioners(id);

ALTER TABLE public.client_practitioner_links
  DROP CONSTRAINT IF EXISTS links_student_requires_supervisor;
ALTER TABLE public.client_practitioner_links
  ADD CONSTRAINT links_student_requires_supervisor
  CHECK (role <> 'student' OR supervisor_id IS NOT NULL);

-- ═══ 2. ONE active Lead per client — database-enforced ══════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_lead_per_client
  ON public.client_practitioner_links (client_id)
  WHERE role = 'lead' AND ended_at IS NULL;

-- ═══ 3. Care-team link rules trigger (fires for EVERY role) ═════════════════
-- • Category 3 (unregistered / NI Verified) cannot be the Lead: with the
--   one-active-Lead rule above, the Lead IS the sole Lead, so the approved
--   "cannot be sole Lead" rule means: cannot hold the lead role at all.
--   Class comes from practitioners.category — never inferred from modality.
-- • A student's supervisor must themselves hold an ACTIVE non-student link
--   for the same client (active supervision relationship).

CREATE OR REPLACE FUNCTION public.enforce_care_team_link_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category TEXT;
BEGIN
  IF NEW.ended_at IS NOT NULL THEN RETURN NEW; END IF; -- ending is always allowed

  IF NEW.role = 'lead' THEN
    SELECT category INTO v_category FROM public.practitioners WHERE id = NEW.practitioner_id;
    IF v_category = 'unregistered' THEN
      RAISE EXCEPTION 'care team: an NI Verified Practitioner (Category 3) cannot be the sole Lead Responsible Practitioner'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.role = 'student' THEN
    IF NEW.supervisor_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.client_practitioner_links s
       WHERE s.practitioner_id = NEW.supervisor_id
         AND s.client_id = NEW.client_id
         AND s.role <> 'student'
         AND s.ended_at IS NULL
    ) THEN
      RAISE EXCEPTION 'care team: a Student Practitioner requires a named supervisor with an active link on the same client'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_care_team_link_rules ON public.client_practitioner_links;
CREATE TRIGGER trg_care_team_link_rules
  BEFORE INSERT OR UPDATE ON public.client_practitioner_links
  FOR EACH ROW EXECUTE FUNCTION public.enforce_care_team_link_rules();
-- NOTE: the Sprint 4 eligibility trigger (0056) already fires BEFORE INSERT
-- on this table — expired indemnity, unverified credentials, missing
-- agreement etc. refuse the link with no new code here.

-- ═══ 4. Client approval through the EXISTING consent architecture ═══════════
-- New granular purpose 'practitioner_access', scoped per practitioner via
-- context_practitioner_id. Versioned, timestamped, withdrawable — the same
-- machinery, constraints and RPC as every other purpose. No new legal
-- wording is introduced here: the approval text version is recorded by the
-- application (consent_version) exactly as for other purposes.

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

-- withdraw_own_consent: add the new purpose to the withdrawable set; add an
-- optional practitioner scope (NULL = withdraw for all practitioners).
-- platform_terms / data_processing still refuse (rights-request channel).
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

-- Fail-closed helper: is THIS practitioner currently approved by THIS member?
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

-- ═══ 5. Practitioner visibility — ASSIGNED CLIENTS only, pseudonymous ═══════
-- Assignment active AND client approval active. NO client identity columns
-- (no client_id, no name): the row is located by link id + the client's
-- active case id, matching the Sprint 5 case-index/pack surfaces. The 0056
-- eligibility gate ran at link creation; Sprint 5 RLS governs everything
-- deeper. security_barrier; owner rights — the WHERE clause IS the rule.

CREATE OR REPLACE VIEW public.practitioner_assigned_clients
  WITH (security_barrier = true) AS
  SELECT
    l.id          AS link_id,
    l.role        AS team_role,
    l.supervisor_id,
    l.created_at  AS assigned_at,
    cc.id         AS case_id,
    cc.status     AS case_status
  FROM public.client_practitioner_links l
  LEFT JOIN public.client_cases cc
    ON cc.client_id = l.client_id AND cc.status = 'active'
  WHERE l.practitioner_id = auth.uid()
    AND l.ended_at IS NULL
    AND public.has_practitioner_access_consent(l.client_id, l.practitioner_id);

REVOKE ALL    ON public.practitioner_assigned_clients FROM anon;
GRANT  SELECT ON public.practitioner_assigned_clients TO authenticated;

COMMENT ON VIEW public.practitioner_assigned_clients IS
  'Sprint 6: the ONLY practitioner list of their clients. Requires active '
  'admin assignment AND active practitioner_access consent. Pseudonymous — '
  'no client identity columns; deeper access stays pack-only (Sprint 5).';

-- ═══ 6. Contributions — contribute, never overwrite (append-only) ═══════════

CREATE TABLE IF NOT EXISTS public.case_contributions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES public.practitioners(id),
  team_role       TEXT NOT NULL CHECK (team_role IN ('lead','specialist','reviewer','temporary','student')),
  profession      TEXT,
  kind            TEXT NOT NULL CHECK (kind IN ('verification','correction','addition','professional_contribution')),
  content         TEXT NOT NULL,
  source          TEXT NOT NULL DEFAULT 'consultation',
  client_confirmed BOOLEAN NOT NULL DEFAULT false,       -- student entries: client review/confirm
  supervisor_verified_by UUID REFERENCES public.practitioners(id),
  supervisor_verified_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.case_contributions ENABLE ROW LEVEL SECURITY;

-- Read: admins, and practitioners with an ACTIVE link to the case's client.
DROP POLICY IF EXISTS "Admin read contributions" ON public.case_contributions;
CREATE POLICY "Admin read contributions"
  ON public.case_contributions FOR SELECT USING (is_admin());
DROP POLICY IF EXISTS "Active team read contributions" ON public.case_contributions;
CREATE POLICY "Active team read contributions"
  ON public.case_contributions FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.client_cases cc
    JOIN public.client_practitioner_links l
      ON l.client_id = cc.client_id AND l.practitioner_id = auth.uid() AND l.ended_at IS NULL
    WHERE cc.id = case_contributions.case_id
  ));
-- Write: ONLY the authoring practitioner, with an active consented link.
DROP POLICY IF EXISTS "Author inserts own contribution" ON public.case_contributions;
CREATE POLICY "Author inserts own contribution"
  ON public.case_contributions FOR INSERT TO authenticated WITH CHECK (
    author_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.client_cases cc
      JOIN public.client_practitioner_links l
        ON l.client_id = cc.client_id AND l.practitioner_id = auth.uid() AND l.ended_at IS NULL
      WHERE cc.id = case_contributions.case_id
        AND public.has_practitioner_access_consent(cc.client_id, auth.uid())
    )
  );
-- No UPDATE/DELETE policies: append-only for every API user. A trigger also
-- blocks UPDATE for ALL roles — one practitioner can never silently rewrite
-- another's contribution (service-role DELETE remains for retention/GDPR ops).

CREATE OR REPLACE FUNCTION public.block_contribution_rewrite()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Only supervisor verification and client confirmation may ever change.
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

-- ═══ 7. Analysis & Plan — authoritative practitioner-only authorship ════════
-- Append-only sections; a new row supersedes (never edits) an older one.
-- The trigger is the gate for EVERY role: service-role (AI, automated jobs,
-- admin server actions, intake, synopsis generation) has auth.uid() NULL and
-- is refused; students are refused; only an authenticated practitioner with
-- an ACTIVE consented NON-STUDENT involvement on the case may author.

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
DROP POLICY IF EXISTS "Active team read analysis" ON public.case_analysis_plan;
CREATE POLICY "Active team read analysis"
  ON public.case_analysis_plan FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.client_cases cc
    JOIN public.client_practitioner_links l
      ON l.client_id = cc.client_id AND l.practitioner_id = auth.uid() AND l.ended_at IS NULL
    WHERE cc.id = case_analysis_plan.case_id
  ));
DROP POLICY IF EXISTS "Practitioner authors analysis" ON public.case_analysis_plan;
CREATE POLICY "Practitioner authors analysis"
  ON public.case_analysis_plan FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid());
-- (The trigger below carries the full rule; the policy pins authorship.)

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

  -- Service-role / AI / automated / intake / synopsis writes: auth.uid() is
  -- NULL on those connections — refused outright.
  IF auth.uid() IS NULL OR NEW.author_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'analysis & plan: only the authenticated authoring practitioner may write'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Author must be a practitioner with an ACTIVE, consented, NON-STUDENT
  -- involvement on this case (students never author Analysis & Plan).
  IF NOT EXISTS (
    SELECT 1 FROM public.client_cases cc
    JOIN public.client_practitioner_links l
      ON l.client_id = cc.client_id
     AND l.practitioner_id = NEW.author_id
     AND l.ended_at IS NULL
     AND l.role <> 'student'
    WHERE cc.id = NEW.case_id
      AND public.has_practitioner_access_consent(cc.client_id, NEW.author_id)
  ) THEN
    RAISE EXCEPTION 'analysis & plan: author has no active authorised non-student involvement on this case'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_analysis_author ON public.case_analysis_plan;
CREATE TRIGGER trg_enforce_analysis_author
  BEFORE INSERT OR UPDATE ON public.case_analysis_plan
  FOR EACH ROW EXECUTE FUNCTION public.enforce_analysis_author();

-- ═══ 8. Plan release — workflow-state gate only ═════════════════════════════
-- Two explicit steps by the ACTIVE, STILL-ELIGIBLE Lead. The software checks
-- workflow state only — never the clinical content of the plan.

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
  ON public.care_plan_coordination FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.client_cases cc
    JOIN public.client_practitioner_links l
      ON l.client_id = cc.client_id AND l.practitioner_id = auth.uid() AND l.ended_at IS NULL
    WHERE cc.id = care_plan_coordination.case_id
  ));
-- Writes ONLY via the two RPCs below (no INSERT/UPDATE policies).

CREATE OR REPLACE FUNCTION public.record_lead_coordination_review(
  p_case_id UUID, p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client UUID;
  v_ok BOOLEAN;
  v_id UUID;
BEGIN
  SELECT client_id INTO v_client FROM public.client_cases WHERE id = p_case_id;
  IF v_client IS NULL THEN RAISE EXCEPTION 'coordination review: case not found'; END IF;

  -- Caller must be the ACTIVE Lead for this client…
  IF NOT EXISTS (
    SELECT 1 FROM public.client_practitioner_links
     WHERE client_id = v_client AND practitioner_id = auth.uid()
       AND role = 'lead' AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'coordination review: caller is not the active Lead Responsible Practitioner';
  END IF;
  -- …and still pass the Sprint 4 eligibility gate.
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
  v_client UUID;
  v_ok BOOLEAN;
  v_coord UUID;
BEGIN
  SELECT client_id INTO v_client FROM public.client_cases WHERE id = p_case_id;
  IF v_client IS NULL THEN RAISE EXCEPTION 'plan release: case not found'; END IF;

  -- Release actor must be the ACTIVE, still-eligible Lead.
  IF NOT EXISTS (
    SELECT 1 FROM public.client_practitioner_links
     WHERE client_id = v_client AND practitioner_id = auth.uid()
       AND role = 'lead' AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'plan release: caller is not the active Lead Responsible Practitioner';
  END IF;
  SELECT e.eligible INTO v_ok FROM public.practitioner_assignment_eligibility(auth.uid()) e;
  IF v_ok IS NOT TRUE THEN
    RAISE EXCEPTION 'plan release: Lead no longer passes assignment eligibility';
  END IF;

  -- Required practitioner content exists (workflow requirement, not judgement).
  IF NOT EXISTS (SELECT 1 FROM public.case_analysis_plan WHERE case_id = p_case_id) THEN
    RAISE EXCEPTION 'plan release: no practitioner-authored Analysis & Plan content exists for this case';
  END IF;

  -- The Lead's coordination review must already be RECORDED and unreleased.
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

-- ═══ 9. PRE-FLIGHT: remove the never-written score from the surface ═════════
-- case_complexity_score: defined 0033, DEFAULT 0, NO writer anywhere in the
-- codebase, all live values 0 — a remnant named for an auto-scoring concept
-- NI's boundary prohibits. Removed from the practitioner view; the column
-- itself is kept (inert, admin/service-visible only) so no data is lost.
-- escalation_required is RETAINED: written only by the 0045
-- complete_practitioner_work RPC when a human practitioner chooses the
-- escalation path — human workflow state, not software scoring.

CREATE OR REPLACE VIEW public.practitioner_case_index
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
-- (Grants on the view are preserved from 0052; recreation keeps them.)

-- ═══ Post-apply assertions (run after applying; all must hold) ═══════════════
-- 1. Second active lead refused: two 'lead' links, same client, ended_at NULL
--    → unique-violation on uniq_active_lead_per_client.
-- 2. Category 3 lead refused: link role='lead' for category='unregistered'
--    → 'cannot be the sole Lead'.
-- 3. Student without supervisor refused (CHECK + trigger).
-- 4. consent CHECK includes 'practitioner_access'; withdraw_own_consent
--    withdraws it (optionally per practitioner); helper flips to false.
-- 5. case_analysis_plan: service-role INSERT refused (auth.uid() NULL);
--    student refused; active consented practitioner succeeds; UPDATE refused.
-- 6. release_care_plan refused without a recorded coordination review;
--    succeeds after record_lead_coordination_review by the eligible Lead.
-- 7. practitioner_case_index no longer lists case_complexity_score.
-- 8. Existing rows untouched (all changes additive; index applies to new
--    state only — live table has 0 link rows).

-- ═══ REVERT BLOCK (do not run unless authorised) ═════════════════════════════
-- DROP TRIGGER IF EXISTS trg_care_team_link_rules ON public.client_practitioner_links;
-- DROP TRIGGER IF EXISTS trg_block_contribution_rewrite ON public.case_contributions;
-- DROP TRIGGER IF EXISTS trg_enforce_analysis_author ON public.case_analysis_plan;
-- DROP FUNCTION IF EXISTS public.enforce_care_team_link_rules();
-- DROP FUNCTION IF EXISTS public.block_contribution_rewrite();
-- DROP FUNCTION IF EXISTS public.enforce_analysis_author();
-- DROP FUNCTION IF EXISTS public.record_lead_coordination_review(UUID, TEXT);
-- DROP FUNCTION IF EXISTS public.release_care_plan(UUID);
-- DROP FUNCTION IF EXISTS public.has_practitioner_access_consent(UUID, UUID);
-- DROP VIEW IF EXISTS public.practitioner_assigned_clients;
-- DROP INDEX IF EXISTS uniq_active_lead_per_client;
-- (consent CHECK / withdraw RPC revert: re-apply the 0051 definitions.
--  Tables case_contributions / case_analysis_plan / care_plan_coordination
--  are data-bearing once used — do not drop without a retention decision.
--  practitioner_case_index revert: re-run the 0052 view definition.)
