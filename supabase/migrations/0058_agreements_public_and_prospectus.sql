-- ──────────────────────────────────────────────────────────────────────────────
-- 0058_agreements_public_and_prospectus.sql
-- Practitioner Agreements (public version history) + Corporate Prospectus
-- enquiries. Additive only.
--
-- SCOPE DISCIPLINE: this sprint's brief allows only schema work the two
-- features genuinely require. That is exactly three things:
--   §1 anon SELECT on practitioner_agreements — the brief requires PERMANENT
--      PUBLIC agreement URLs where a practitioner can inspect what they
--      previously accepted WITHOUT contacting NI. Today only `authenticated`
--      can read the table, so a public page is impossible.
--   §2 prospectus_enquiries — the enquiry record the brief requires
--      (organisation type, audience, size, interests, timing, contact, free
--      text, routed documents, requested/sent times, follow-up status).
--   §3 a private storage bucket for the four prospectus PDFs, so the
--      documents are replaceable WITHOUT rebuilding the application.
--
-- NOT changed here: the agreement immutability trigger, the acceptance RPCs,
-- has_accepted_current_agreement, the 0056 eligibility gate, or anything in
-- Intake / Care Team / review packs.
--
-- Note on "acceptance records practitioner class": no column is added. Every
-- agreement row is class-specific (practitioner_agreements.category) and the
-- row is immutable, so acceptance.agreement_id already pins the class AS AT
-- the moment of acceptance — which is stronger than copying a mutable
-- practitioners.category onto the acceptance.

-- ═══ 1. Public (anon) read of ALL agreement versions ════════════════════════
-- Current AND superseded, so the published history is permanently inspectable.
-- The table holds no personal data: category, version, title, body,
-- is_current, created_at. Acceptances (who signed what) stay private — their
-- policies are untouched: admin-only plus "practitioners view own".

DROP POLICY IF EXISTS "Public read agreement versions" ON public.practitioner_agreements;
CREATE POLICY "Public read agreement versions"
  ON public.practitioner_agreements FOR SELECT TO anon
  USING (true);

-- Read-only for both user roles; writes stay admin/service only.
REVOKE ALL    ON public.practitioner_agreements FROM PUBLIC, anon, authenticated;
GRANT  SELECT ON public.practitioner_agreements TO anon, authenticated;

-- ═══ 2. Corporate prospectus enquiries ══════════════════════════════════════
-- BUSINESS CONTACT DATA ONLY. This table must never carry health information
-- about an individual, and is deliberately kept out of the client health data
-- model (no profile_id, no member_id, no case linkage, no health columns).
-- `interests` holds the organisation's stated topic interests from a fixed
-- option list — an organisational enquiry attribute, not anyone's health data.

CREATE TABLE IF NOT EXISTS public.prospectus_enquiries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Five routing answers
  organisation_type  TEXT NOT NULL CHECK (organisation_type IN
                       ('care_setting','workplace','school_college',
                        'community_faith','charity','other')),
  audience           TEXT NOT NULL,
  size_band          TEXT NOT NULL CHECK (size_band IN
                       ('under_25','25_75','75_200','over_200')),
  interests          TEXT[] NOT NULL DEFAULT '{}',
  timing             TEXT NOT NULL CHECK (timing IN
                       ('within_a_month','next_few_months','exploring','have_a_date')),

  -- Business contact details (no budget field — deliberately excluded)
  contact_name       TEXT NOT NULL,
  organisation_name  TEXT NOT NULL,
  role               TEXT NOT NULL,
  email              TEXT NOT NULL,
  phone              TEXT,
  anything_else      TEXT,

  -- Marketing consent is SEPARATE from prospectus fulfilment, optional, and
  -- defaults to false (unticked). Never required to receive the prospectus.
  marketing_opt_in   BOOLEAN NOT NULL DEFAULT false,

  -- Routing outcome + fulfilment tracking
  routed_documents   TEXT[] NOT NULL DEFAULT '{}',
  requested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at            TIMESTAMPTZ,
  send_error         TEXT,
  follow_up_status   TEXT NOT NULL DEFAULT 'new' CHECK (follow_up_status IN
                       ('new','in_progress','responded','closed')),
  follow_up_note     TEXT,
  needs_manual_review BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospectus_enquiries_requested
  ON public.prospectus_enquiries (requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospectus_enquiries_follow_up
  ON public.prospectus_enquiries (follow_up_status) WHERE follow_up_status <> 'closed';

ALTER TABLE public.prospectus_enquiries ENABLE ROW LEVEL SECURITY;

-- Admin reads and manages follow-up. There is deliberately NO anon/authenticated
-- policy: the public form submits through a SECURITY DEFINER server action, so
-- nobody can read the enquiry list or harvest contact details from the client.
DROP POLICY IF EXISTS "Admin manage prospectus enquiries" ON public.prospectus_enquiries;
CREATE POLICY "Admin manage prospectus enquiries"
  ON public.prospectus_enquiries FOR ALL USING (is_admin());

REVOKE ALL ON public.prospectus_enquiries FROM PUBLIC, anon, authenticated;

-- ═══ 3. Replaceable prospectus documents (private storage bucket) ═══════════
-- Fixed object keys so the four PDFs can be swapped by uploading over them —
-- no rebuild, no code change, no redeploy. Private: delivery uses short-lived
-- signed URLs generated server-side.

INSERT INTO storage.buckets (id, name, public)
VALUES ('prospectus', 'prospectus', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Admin manage prospectus documents" ON storage.objects;
CREATE POLICY "Admin manage prospectus documents"
  ON storage.objects FOR ALL
  USING (bucket_id = 'prospectus' AND public.is_admin())
  WITH CHECK (bucket_id = 'prospectus' AND public.is_admin());

-- ═══ Post-apply assertions ══════════════════════════════════════════════════
-- 1. anon can SELECT practitioner_agreements (current AND superseded) and
--    cannot INSERT/UPDATE/DELETE through it.
-- 2. anon/authenticated get ZERO rows from prospectus_enquiries; admin reads.
-- 3. The agreement immutability trigger and both acceptance RPCs are
--    unchanged (body/version edits still refused).
-- 4. The 0056 eligibility gate is unchanged, including expired-indemnity.
-- 5. Bucket 'prospectus' exists and is private.

-- ═══ REVERT (do not run unless authorised) ══════════════════════════════════
-- DROP POLICY IF EXISTS "Public read agreement versions" ON public.practitioner_agreements;
-- REVOKE SELECT ON public.practitioner_agreements FROM anon;
-- DROP POLICY IF EXISTS "Admin manage prospectus documents" ON storage.objects;
-- DROP TABLE IF EXISTS public.prospectus_enquiries;  -- data-bearing once live
-- DELETE FROM storage.buckets WHERE id = 'prospectus' AND NOT EXISTS
--   (SELECT 1 FROM storage.objects WHERE bucket_id = 'prospectus');
