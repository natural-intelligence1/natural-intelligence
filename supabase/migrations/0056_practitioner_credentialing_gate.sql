-- ──────────────────────────────────────────────────────────────────────────────
-- 0056_practitioner_credentialing_gate.sql
-- SPRINT 4 — Practitioner onboarding & credentialing: verification states,
-- scope of practice, and the ONE authoritative assignment-eligibility gate.
--
-- STATUS: FILE ONLY — NOT APPLIED. Applying to the shared database requires
-- KR authorisation (Sprint 4 hard stop 13). Armed live tests self-skip until
-- this migration is applied.
--
-- REUSES (does not replace):
--   • practitioners.category (0051) — the three practitioner classes:
--       regulated_clinician  = Regulated Healthcare Professional
--       voluntary_registered = Accredited Practitioner
--       unregistered         = NI Verified Practitioner
--     (No student class: student/trainee is a supervised training status.)
--   • practitioners lifecycle status (0034): pending_review → approved →
--     active → suspended → archived.
--   • 0051 agreement machinery: immutable versioned agreements, one current
--     per class, RPC-only acceptance, id+version+sha256-hash verification.
--   • 0051 credential capture: insurance_provider/policy/expiry,
--     registration_body/number, dbs_status, dbs_checked_at.
--
-- DOES NOT TOUCH: 0052 (locked), 0046/0048 access grants, review packs,
-- Care Team live wiring, client data.
--
-- CAPTURE != VERIFICATION: everything a practitioner submits stays
-- 'unverified' until an admin verifies it; eligibility fails closed.

-- ═══ 1. Verification, evidence, scope — smallest durable additions ═══════════

ALTER TABLE public.practitioners
  -- Registration status alongside the existing body/number capture.
  ADD COLUMN IF NOT EXISTS registration_status TEXT
    CHECK (registration_status IN ('registered','lapsed','suspended','not_applicable')),
  -- Evidence references (storage refs / document ids — never file blobs here).
  ADD COLUMN IF NOT EXISTS insurance_evidence_ref     TEXT,
  ADD COLUMN IF NOT EXISTS qualification_evidence_ref TEXT,
  -- Admin verification of the credential set as a whole (capture ≠ verification).
  ADD COLUMN IF NOT EXISTS credentials_verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (credentials_verification_status IN ('unverified','verified','rejected')),
  ADD COLUMN IF NOT EXISTS credentials_verified_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS credentials_verified_at TIMESTAMPTZ,
  -- Indemnity is required by default; admin may mark genuinely exempt setups.
  ADD COLUMN IF NOT EXISTS indemnity_required BOOLEAN NOT NULL DEFAULT true,
  -- Scope of practice — separate from class, modality, qualifications and
  -- Care Team role. Smallest durable model: a reviewed statement + status.
  ADD COLUMN IF NOT EXISTS scope_of_practice TEXT,
  ADD COLUMN IF NOT EXISTS scope_status TEXT NOT NULL DEFAULT 'none'
    CHECK (scope_status IN ('none','submitted','approved','revoked')),
  ADD COLUMN IF NOT EXISTS scope_approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS scope_approved_at TIMESTAMPTZ;

-- DBS: extend the 0051 states with 'required' (recorded as required but not
-- yet begun). 'clear' remains the verified-good state; 'flagged' blocks.
ALTER TABLE public.practitioners DROP CONSTRAINT IF EXISTS practitioners_dbs_status_check;
ALTER TABLE public.practitioners ADD CONSTRAINT practitioners_dbs_status_check
  CHECK (dbs_status IN ('required','not_required','pending','clear','flagged'));

-- ═══ 2. Acceptance check for an ARBITRARY practitioner ═══════════════════════
-- 0051's has_accepted_current_agreement() answers for auth.uid() (the gate).
-- Eligibility must answer for the practitioner BEING ASSIGNED, with the same
-- strictness: current agreement for their class, matching version AND the
-- sha256 hash of the exact current body. Obsolete version, superseded
-- agreement or hash mismatch all fail.

CREATE OR REPLACE FUNCTION public.practitioner_has_current_acceptance(p_practitioner_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.practitioner_agreements a
      JOIN public.practitioners p
        ON p.id = p_practitioner_id AND p.category = a.category
      JOIN public.practitioner_agreement_acceptances acc
        ON acc.practitioner_id    = p_practitioner_id
       AND acc.agreement_id       = a.id
       AND acc.agreement_version  = a.version
       AND acc.accepted_text_hash = encode(extensions.digest(a.body, 'sha256'), 'hex')
     WHERE a.is_current
  );
$$;

REVOKE ALL ON FUNCTION public.practitioner_has_current_acceptance(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.practitioner_has_current_acceptance(UUID) TO authenticated, service_role;

-- ═══ 3. THE authoritative assignment-eligibility function ════════════════════
-- One path. Everything below the UI calls this; nothing else decides.
-- Fail-closed: a missing practitioner, missing class, missing agreement,
-- unverified credentials, expired/missing required indemnity, outstanding
-- DBS or unapproved scope each refuses assignment with a named reason.

CREATE OR REPLACE FUNCTION public.practitioner_assignment_eligibility(p_practitioner_id UUID)
RETURNS TABLE (eligible BOOLEAN, reasons TEXT[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  pr RECORD;
  r  TEXT[] := '{}';
BEGIN
  SELECT * INTO pr FROM public.practitioners WHERE id = p_practitioner_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, ARRAY['practitioner_not_found']; RETURN;
  END IF;

  -- Lifecycle: only an approved, ACTIVE practitioner is assignable.
  IF pr.status <> 'active' OR pr.is_active IS NOT TRUE THEN
    r := array_append(r, 'practitioner_not_active');
  END IF;

  -- Class must be determined (never inferred from modality).
  IF pr.category IS NULL THEN
    r := array_append(r, 'practitioner_class_not_set');
  END IF;

  -- Current class agreement accepted (id + version + exact-text hash).
  IF pr.category IS NOT NULL
     AND NOT public.practitioner_has_current_acceptance(p_practitioner_id) THEN
    r := array_append(r, 'no_current_agreement_acceptance');
  END IF;

  -- Credential set admin-verified (capture alone never counts).
  IF pr.credentials_verification_status IS DISTINCT FROM 'verified' THEN
    r := array_append(r, 'credentials_not_verified');
  END IF;

  -- HARD control: required indemnity must exist and be in date.
  IF pr.indemnity_required IS NOT FALSE THEN
    IF pr.insurance_expiry IS NULL THEN
      r := array_append(r, 'indemnity_missing');
    ELSIF pr.insurance_expiry < CURRENT_DATE THEN
      r := array_append(r, 'indemnity_expired');
    END IF;
  END IF;

  -- Registered classes must hold a current registration.
  IF pr.category IN ('regulated_clinician','voluntary_registered') THEN
    IF pr.registration_number IS NULL OR pr.registration_body IS NULL
       OR pr.registration_status IS DISTINCT FROM 'registered' THEN
      r := array_append(r, 'registration_not_current');
    END IF;
  END IF;

  -- DBS: outstanding or flagged blocks; 'clear' or 'not_required' passes.
  IF pr.dbs_status IN ('required','pending','flagged') THEN
    r := array_append(r, 'dbs_outstanding');
  END IF;

  -- Scope must be admin-approved.
  IF pr.scope_status IS DISTINCT FROM 'approved' THEN
    r := array_append(r, 'scope_not_approved');
  END IF;

  RETURN QUERY SELECT (cardinality(r) = 0), r;
END;
$$;

REVOKE ALL ON FUNCTION public.practitioner_assignment_eligibility(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.practitioner_assignment_eligibility(UUID) TO authenticated, service_role;

-- ═══ 4. DB-level enforcement — the gate the UI cannot bypass ═════════════════
-- BEFORE INSERT triggers on both assignment surfaces. Triggers fire for
-- EVERY role including service_role: hiding an Assign button proves
-- nothing; this refusal is the sprint's closure evidence.

CREATE OR REPLACE FUNCTION public.enforce_practitioner_assignable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_eligible BOOLEAN;
  v_reasons  TEXT[];
BEGIN
  SELECT e.eligible, e.reasons INTO v_eligible, v_reasons
    FROM public.practitioner_assignment_eligibility(NEW.practitioner_id) e;
  IF v_eligible IS NOT TRUE THEN
    RAISE EXCEPTION 'practitioner not assignable: %', array_to_string(v_reasons, ', ')
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_assignable_work ON public.case_practitioner_work;
CREATE TRIGGER trg_enforce_assignable_work
  BEFORE INSERT ON public.case_practitioner_work
  FOR EACH ROW EXECUTE FUNCTION public.enforce_practitioner_assignable();

DROP TRIGGER IF EXISTS trg_enforce_assignable_link ON public.client_practitioner_links;
CREATE TRIGGER trg_enforce_assignable_link
  BEFORE INSERT ON public.client_practitioner_links
  FOR EACH ROW EXECUTE FUNCTION public.enforce_practitioner_assignable();

-- ═══ 5. Post-apply assertions (run manually after applying) ══════════════════
-- 1. SELECT * FROM practitioner_assignment_eligibility('<synthetic-id>');
--    → eligible=false with named reasons for a fresh practitioner.
-- 2. INSERT INTO case_practitioner_work(...) for an ineligible synthetic
--    practitioner → ERROR 'practitioner not assignable: ...'.
-- 3. Same insert after making the synthetic practitioner fully eligible
--    → succeeds; then clean up.
-- 4. Existing rows are untouched (trigger is INSERT-only).
-- 5. The armed live suite packages/db/src/practitioners/credentialing
--    live tests stop self-skipping and pass (matrix A–F).

-- ═══ REVERT BLOCK (kept with the migration; do not run unless authorised) ════
-- DROP TRIGGER IF EXISTS trg_enforce_assignable_work ON public.case_practitioner_work;
-- DROP TRIGGER IF EXISTS trg_enforce_assignable_link ON public.client_practitioner_links;
-- DROP FUNCTION IF EXISTS public.enforce_practitioner_assignable();
-- DROP FUNCTION IF EXISTS public.practitioner_assignment_eligibility(UUID);
-- DROP FUNCTION IF EXISTS public.practitioner_has_current_acceptance(UUID);
-- (Column drops intentionally omitted — data-bearing once applied.)
