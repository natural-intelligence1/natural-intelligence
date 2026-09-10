-- 0051 — Sprint 3 safety floor: consent versioning, client rights requests,
-- practitioner agreements, de-identified review packs.
--
-- ⚠ COMMITTED AS A FILE ONLY — NOT YET APPLIED. Applying this migration is a
-- production-database change and requires Founder authorisation after PR
-- review (see docs/governance/sprint3-safety-floor.md).
--
-- All statements are idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).

-- ═══ 1. consent_records — version, text, purpose context, withdrawal ═════════
-- Extends the existing signup-consent table (0004/0005). Existing rows and the
-- existing signup write path keep working unchanged; new columns are nullable.

ALTER TABLE public.consent_records
  ADD COLUMN IF NOT EXISTS consent_version TEXT,
  ADD COLUMN IF NOT EXISTS consent_text    TEXT,
  ADD COLUMN IF NOT EXISTS source          TEXT,   -- e.g. 'signup', 'intake_start', 'privacy_page'
  ADD COLUMN IF NOT EXISTS actor           TEXT,   -- e.g. 'member', 'admin'
  ADD COLUMN IF NOT EXISTS organisation_context TEXT,
  ADD COLUMN IF NOT EXISTS withdrawn_at    TIMESTAMPTZ;

COMMENT ON COLUMN public.consent_records.consent_version IS
  'Version identifier of the exact consent wording shown (Sprint 3).';
COMMENT ON COLUMN public.consent_records.withdrawn_at IS
  'Set when this specific consent grant is withdrawn; the row is never deleted.';

-- Consent evidence is APPEND-ONLY to members: no member UPDATE policy exists.
-- Withdrawal is the single narrow mutation allowed, exposed via a SECURITY
-- DEFINER function that can ONLY set withdrawn_at on the caller's own rows
-- for one consent purpose. (Review amendment 2 — replaces an earlier broad
-- member UPDATE policy.)
CREATE OR REPLACE FUNCTION public.withdraw_own_consent(p_consent_type TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.consent_records
     SET withdrawn_at = now()
   WHERE profile_id = auth.uid()
     AND consent_type = p_consent_type
     AND withdrawn_at IS NULL;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

REVOKE ALL ON FUNCTION public.withdraw_own_consent(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.withdraw_own_consent(TEXT) TO authenticated;

-- ═══ 2. client_rights_requests — withdrawal + GDPR rights channel ════════════

CREATE TABLE IF NOT EXISTS public.client_rights_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type    TEXT NOT NULL CHECK (request_type IN
                    ('access','correction','export','erasure','restriction','consent_withdrawal')),
  details         TEXT,
  consent_type    TEXT,           -- for consent_withdrawal: which consent purpose
  status          TEXT NOT NULL DEFAULT 'new' CHECK (status IN
                    ('new','acknowledged','in_progress','fulfilled','refused','withdrawn')),
  resolution_note TEXT,
  handled_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crr_member  ON public.client_rights_requests(member_id);
CREATE INDEX IF NOT EXISTS idx_crr_status  ON public.client_rights_requests(status);

ALTER TABLE public.client_rights_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members create own rights requests" ON public.client_rights_requests;
CREATE POLICY "Members create own rights requests"
  ON public.client_rights_requests FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid());

DROP POLICY IF EXISTS "Members view own rights requests" ON public.client_rights_requests;
CREATE POLICY "Members view own rights requests"
  ON public.client_rights_requests FOR SELECT TO authenticated
  USING (member_id = auth.uid());

DROP POLICY IF EXISTS "Admin full access to rights requests" ON public.client_rights_requests;
CREATE POLICY "Admin full access to rights requests"
  ON public.client_rights_requests FOR ALL USING (is_admin());

-- ═══ 3. Practitioner agreements — documents, categories, acceptances ═════════

-- Practitioner classification + credential capture.
ALTER TABLE public.practitioners
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN
    ('regulated_clinician','voluntary_registered','unregistered')),
  ADD COLUMN IF NOT EXISTS insurance_provider      TEXT,
  ADD COLUMN IF NOT EXISTS insurance_policy_number TEXT,
  ADD COLUMN IF NOT EXISTS insurance_expiry        DATE,
  ADD COLUMN IF NOT EXISTS registration_body       TEXT,
  ADD COLUMN IF NOT EXISTS registration_number     TEXT,
  ADD COLUMN IF NOT EXISTS dbs_status              TEXT CHECK (dbs_status IN
    ('not_required','pending','clear','flagged')),
  ADD COLUMN IF NOT EXISTS dbs_checked_at          DATE;

CREATE TABLE IF NOT EXISTS public.practitioner_agreements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category       TEXT NOT NULL CHECK (category IN
                   ('regulated_clinician','voluntary_registered','unregistered')),
  version        TEXT NOT NULL,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL,   -- exact agreement text (DRAFT until solicitor sign-off)
  is_current     BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, version)
);

CREATE TABLE IF NOT EXISTS public.practitioner_agreement_acceptances (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id UUID NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  agreement_id    UUID NOT NULL REFERENCES public.practitioner_agreements(id),
  agreement_version TEXT NOT NULL,
  accepted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_text_hash TEXT,        -- integrity check of the exact text accepted
  UNIQUE (practitioner_id, agreement_id)
);

ALTER TABLE public.practitioner_agreements            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practitioner_agreement_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read current agreements" ON public.practitioner_agreements;
CREATE POLICY "Authenticated read current agreements"
  ON public.practitioner_agreements FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage agreements" ON public.practitioner_agreements;
CREATE POLICY "Admin manage agreements"
  ON public.practitioner_agreements FOR ALL USING (is_admin());

DROP POLICY IF EXISTS "Practitioners accept own agreements" ON public.practitioner_agreement_acceptances;
CREATE POLICY "Practitioners accept own agreements"
  ON public.practitioner_agreement_acceptances FOR INSERT TO authenticated
  WITH CHECK (practitioner_id = auth.uid());

DROP POLICY IF EXISTS "Practitioners view own acceptances" ON public.practitioner_agreement_acceptances;
CREATE POLICY "Practitioners view own acceptances"
  ON public.practitioner_agreement_acceptances FOR SELECT TO authenticated
  USING (practitioner_id = auth.uid());

DROP POLICY IF EXISTS "Admin full access to acceptances" ON public.practitioner_agreement_acceptances;
CREATE POLICY "Admin full access to acceptances"
  ON public.practitioner_agreement_acceptances FOR ALL USING (is_admin());

-- ═══ 4. De-identified practitioner review packs ══════════════════════════════
-- Practitioner-facing output is PSEUDONYMOUS personal health data, not
-- anonymous: NI retains full attribution + audit internally (case_id,
-- source_intake_id, generated_by). Practitioners read packs via work-item
-- linkage — the same shape as 0048, but against de-identified content.

-- Review amendments 6+7: the practitioner-readable table carries ONLY safe
-- columns (no internal audit fields — those live in review_pack_audit, which
-- has no authenticated policies at all), and practitioner SELECT requires an
-- ACTIVE work item — cancelled / declined / completed work grants nothing.

CREATE TABLE IF NOT EXISTS public.practitioner_review_packs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id      UUID NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  pseudonym    TEXT NOT NULL,       -- e.g. 'NI-4F7A2C' — never the client name
  pack         JSONB NOT NULL,      -- de-identified content (buildReviewPack output)
  pack_version INTEGER NOT NULL DEFAULT 1,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (case_id, pack_version)
);

-- Internal audit trail — ADMIN/SERVICE ONLY. Never practitioner-readable.
CREATE TABLE IF NOT EXISTS public.review_pack_audit (
  pack_id            UUID PRIMARY KEY REFERENCES public.practitioner_review_packs(id) ON DELETE CASCADE,
  source_intake_id   UUID,
  suppressed_fields  TEXT[] DEFAULT '{}',
  transformed_fields TEXT[] DEFAULT '{}',
  generated_by       TEXT NOT NULL DEFAULT 'system',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.practitioner_review_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_pack_audit         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Practitioners read packs for their work" ON public.practitioner_review_packs;
CREATE POLICY "Practitioners read packs for their work"
  ON public.practitioner_review_packs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.case_practitioner_work cpw
      WHERE cpw.case_id = practitioner_review_packs.case_id
        AND cpw.practitioner_id = auth.uid()
        AND cpw.status IN ('assigned', 'in_review', 'escalated')
    )
  );

DROP POLICY IF EXISTS "Admin full access to review packs" ON public.practitioner_review_packs;
CREATE POLICY "Admin full access to review packs"
  ON public.practitioner_review_packs FOR ALL USING (is_admin());

-- review_pack_audit: admin only. Deliberately NO authenticated policy —
-- practitioners can never read audit rows.
DROP POLICY IF EXISTS "Admin full access to review pack audit" ON public.review_pack_audit;
CREATE POLICY "Admin full access to review pack audit"
  ON public.review_pack_audit FOR ALL USING (is_admin());
