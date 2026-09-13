-- 0052 — Narrow pre-anonymisation practitioner read grants (Sprint 3, Phase 5)
--
-- ⚠ COMMITTED AS A FILE ONLY — NOT YET APPLIED.
-- ⚠ COUPLING RULE: apply this migration ONLY together with the de-identified
--   review-pack rollout (0051 + practitioner workspace reading
--   practitioner_review_packs). Applying it alone removes practitioner access
--   with nothing to replace it; NOT applying it while packs ship would leave a
--   redaction layer on top of open raw access. One workstream, one switch.
--   (docs/governance/sprint3-safety-floor.md)
--
-- What it does: drops the five `practitioners_read_assigned_client` SELECT
-- policies added by 0048, which grant practitioners direct read access to
-- IDENTIFIED intake and BioHub rows for linked clients. After this migration,
-- practitioner access to client health data flows exclusively through
-- practitioner_review_packs (pseudonymous, de-identified). Member, admin and
-- service-role access is untouched.

DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.intake_responses;
DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.intake_answers;
DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.biomarker_results;
DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.biomarker_trajectory;
DROP POLICY IF EXISTS practitioners_read_assigned_client ON public.lab_reports;

-- ── 0046 audit finding (second review, item 7; HARDENED overnight) ──────────
-- `case_practitioner_select` (F1, captured in 0046) grants a practitioner with
-- ANY work history on a case SELECT over client_cases rows, which carry
-- client_id (identity linkage) and primary_concern (user-entered free-text
-- HEALTH context). RLS cannot mask a column, so a status-filtered recreation
-- of the policy would STILL let practitioners select primary_concern and
-- client_id directly. Resolution (final review, item 3): practitioners get NO
-- SELECT policy on client_cases at all. Operational case data flows through
-- the column-scoped `practitioner_case_index` view below; clinical content
-- flows exclusively through practitioner_review_packs; identity flows through
-- practitioner_client_identity (F2) only where the identified mode still
-- lawfully operates (and that mode is retired by the pack rollout this
-- migration is coupled to).

DROP POLICY IF EXISTS case_practitioner_select ON public.client_cases;
-- Deliberately NOT recreated. Member-own and admin/service-role access to
-- client_cases is defined elsewhere and untouched by this migration.

-- ── practitioner_case_index — column-scoped operational view ─────────────────
-- Exposes ONLY non-health operational fields, and ONLY for cases where the
-- caller holds an ACTIVE work item. No client_id, no primary_concern. The
-- view runs with owner rights (bypassing client_cases RLS), so the WHERE
-- clause IS the access rule — treat any edit to it as a security change.
-- security_barrier prevents predicate pushdown leaks.
--
-- DECISION (final hardening, item 4): 'completed' is NOT included. A finished
-- piece of work grants no further client-data access — there is no signed
-- retention/continuity requirement, the pack-mode inbox and pages are
-- active-only, and the 0051 pack SELECT policy is active-only, so all three
-- surfaces agree. If a continuity requirement is later signed off,
-- reintroduce completed HERE with an explicit completed_at time window
-- (e.g. 7 days) in the same review that signs the requirement — never
-- silently.
CREATE OR REPLACE VIEW public.practitioner_case_index
  WITH (security_barrier = true) AS
  SELECT
    cc.id,
    cc.status,
    cc.case_complexity_score,
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

REVOKE ALL    ON public.practitioner_case_index FROM anon;
GRANT  SELECT ON public.practitioner_case_index TO authenticated;

COMMENT ON VIEW public.practitioner_case_index IS
  'Sprint 3: the ONLY practitioner-facing surface over client_cases. '
  'Operational columns only — no client_id, no primary_concern. '
  'ACTIVE work only: completed, cancelled and declined grant nothing.';

-- ── Identity + personalisation views: practitioner branch REMOVED ────────────
-- (PA-pass polish, item 1.) Two owner-rights views from the identified era
-- grant practitioners rows keyed on ANY work history, with no status filter:
--   • practitioner_client_identity (0041): client full_name + avatar_url —
--     direct identity;
--   • practitioner_client_personalisation (0047): biological_sex + clinical
--     notes keyed by user_id — an identity linkage practitioners must not
--     hold in pack mode.
-- Views cannot read env flags, so DB-level pseudonymity requires the
-- practitioner branch to GO when this migration applies (it applies only
-- together with the pack rollout, at which point the identified care mode is
-- retired). Both views are recreated WITHOUT the practitioner work-history
-- branch: members keep self-access, admins keep access, practitioners get
-- nothing. If a future identified-care mode is signed off, it must arrive as
-- a NEW, separately gated surface through governance — never by silently
-- restoring these branches.

CREATE OR REPLACE VIEW public.practitioner_client_identity
WITH (security_invoker = false) AS
SELECT p.id, p.full_name, p.avatar_url, p.role
FROM public.profiles p
WHERE auth.uid() = p.id OR is_admin();

COMMENT ON VIEW public.practitioner_client_identity IS
  'Sprint 3 (0052): practitioner work-history branch removed — pack mode is '
  'pseudonymous at DB level. Self + admin only. Name kept for compatibility.';

CREATE OR REPLACE VIEW public.practitioner_client_personalisation
WITH (security_invoker = false) AS
SELECT up.user_id, up.biological_sex, up.clinical_notes_on_sex, up.updated_at
FROM public.user_personalisation up
WHERE auth.uid() = up.user_id OR is_admin();

COMMENT ON VIEW public.practitioner_client_personalisation IS
  'Sprint 3 (0052): practitioner work-history branch removed — clinical '
  'personalisation reaches practitioners only via de-identified review packs.';

-- ── Post-apply assertions (run manually after applying; all must hold) ───────
-- 1. No practitioner-reachable SELECT policy remains on client_cases:
--      SELECT polname FROM pg_policies
--      WHERE schemaname='public' AND tablename='client_cases' AND cmd='SELECT';
--    → must list ONLY member-own / admin policies (nothing work-item-based).
-- 2. The view exposes no restricted columns:
--      SELECT column_name FROM information_schema.columns
--      WHERE table_name='practitioner_case_index';
--    → must NOT include client_id or primary_concern.
-- 3. The view's access rule is active-only:
--      SELECT pg_get_viewdef('public.practitioner_case_index');
--    → the status list must be exactly ('assigned','in_review','escalated');
--      'completed' must NOT appear.
-- 4. Practitioners cannot reach identity through the identity view:
--      SELECT pg_get_viewdef('public.practitioner_client_identity');
--    → the WHERE clause must be exactly self-or-admin
--      (auth.uid() = p.id OR is_admin()); no case_practitioner_work branch.
--    Then, as a practitioner session holding an ACTIVE work item:
--      SELECT * FROM practitioner_client_identity WHERE id = '<that client>';
--    → must return ZERO rows.
-- 5. Same for the personalisation view:
--      SELECT pg_get_viewdef('public.practitioner_client_personalisation');
--    → self-or-admin only; no case_practitioner_work branch.

-- NOTE for the same apply-window: any helper still selecting raw intake/biohub
-- rows for practitioners (getIntakeSummary, getBioHubSignals) is dead code once
-- the 0048 policies above are dropped — the care surfaces already run in pack
-- mode when PRACTITIONER_REVIEW_PACKS_ENABLED is on, which is a precondition
-- for applying this migration (governance sequencing B/C).
