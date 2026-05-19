-- PS.1 — Personalisation Substrate: user_personalisation table + RLS + view + RPC
--
-- Single migration covering all PS.1 schema deliverables. Apply order
-- matches the addendum:
--   1. CREATE TABLE
--   2. ENABLE RLS                     (A.1)
--   3. Member + admin policies        (§5; no DELETE per A.2)
--   4. updated_at trigger             (A.3)
--   5. set_clinical_notes_on_sex RPC  (A.4)
--   6. practitioner_client_personalisation view (§5; F2 pattern)
--   7. Extend handle_new_user()       (PS.1 Option α)
--   8. One-time backfill
--
-- All statements idempotent (DROP IF EXISTS / CREATE OR REPLACE / ON CONFLICT
-- DO NOTHING / CREATE TABLE IF NOT EXISTS).

-- ── 1. CREATE TABLE ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_personalisation (
  user_id                       uuid        PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  biological_sex                text        CHECK (biological_sex IN ('male','female')),
  religion                      text        NOT NULL DEFAULT 'prefer_not_to_say'
                                            CHECK (religion IN (
                                              'muslim','christian','jewish','hindu','buddhist','sikh',
                                              'secular','prefer_not_to_say','other'
                                            )),
  religious_content_preference  text        NOT NULL DEFAULT 'hide'
                                            CHECK (religious_content_preference IN ('show','hide')),
  clinical_notes_on_sex         text,
  created_at                    timestamptz NOT NULL DEFAULT now(),
  updated_at                    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.user_personalisation IS
  'Per-user personalisation state: biological_sex (clinical), religion + content preference (UX framing), '
  'clinical_notes_on_sex (practitioner annotation). Read access split: clients read own row; '
  'practitioners read column-scoped subset via practitioner_client_personalisation view; '
  'admins via is_admin(). One row per user; row created eagerly by handle_new_user() trigger.';

-- ── 2. ENABLE RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.user_personalisation ENABLE ROW LEVEL SECURITY;

-- ── 3. Member + admin policies (no DELETE per addendum A.2) ──────────────────

DROP POLICY IF EXISTS up_member_select ON public.user_personalisation;
CREATE POLICY up_member_select  ON public.user_personalisation FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS up_member_insert ON public.user_personalisation;
CREATE POLICY up_member_insert  ON public.user_personalisation FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS up_member_update ON public.user_personalisation;
CREATE POLICY up_member_update  ON public.user_personalisation FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS up_admin_all ON public.user_personalisation;
CREATE POLICY up_admin_all      ON public.user_personalisation FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ── 4. updated_at trigger (A.3) ──────────────────────────────────────────────

DROP TRIGGER IF EXISTS set_user_personalisation_updated_at ON public.user_personalisation;
CREATE TRIGGER set_user_personalisation_updated_at
  BEFORE UPDATE ON public.user_personalisation
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ── 5. set_clinical_notes_on_sex RPC (A.4) ───────────────────────────────────

DROP FUNCTION IF EXISTS public.set_clinical_notes_on_sex(uuid, text);

CREATE FUNCTION public.set_clinical_notes_on_sex(
  p_user_id uuid,
  p_notes   text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id  uuid := auth.uid();
  v_authorised boolean;
BEGIN
  -- Layer 1: reject anonymous callers
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Layer 2: caller must be an assigned practitioner on a case for the
  -- target client. Any work status grants this (F1 spirit — clinical-
  -- continuity access for any work, not just active).
  SELECT EXISTS (
    SELECT 1
    FROM case_practitioner_work cpw
    JOIN client_cases cc ON cc.id = cpw.case_id
    WHERE cc.client_id = p_user_id
      AND cpw.practitioner_id = v_caller_id
  ) INTO v_authorised;

  IF NOT v_authorised THEN
    RAISE EXCEPTION 'Not authorised to update clinical notes for this client';
  END IF;

  -- Upsert: create the row if absent (e.g., the eager trigger somehow missed
  -- it, or pre-trigger account), otherwise update only clinical_notes_on_sex.
  -- Defaults for religion + religious_content_preference apply on INSERT.
  -- Explicit updated_at = now() documents intent (trigger fires too).
  INSERT INTO public.user_personalisation (user_id, clinical_notes_on_sex)
  VALUES (p_user_id, p_notes)
  ON CONFLICT (user_id) DO UPDATE
    SET clinical_notes_on_sex = EXCLUDED.clinical_notes_on_sex,
        updated_at            = now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_clinical_notes_on_sex(uuid, text) TO authenticated;

-- ── 6. practitioner_client_personalisation view (F2 pattern) ─────────────────
--
-- Column-scoped: exposes ONLY (user_id, biological_sex, clinical_notes_on_sex,
-- updated_at). religion and religious_content_preference are NOT in this view.
-- security_invoker = false → view's WHERE clause is the access gate (same as
-- practitioner_client_identity from migration 0041).

CREATE OR REPLACE VIEW public.practitioner_client_personalisation
WITH (security_invoker = false) AS
SELECT up.user_id, up.biological_sex, up.clinical_notes_on_sex, up.updated_at
FROM public.user_personalisation up
WHERE
  EXISTS (
    SELECT 1
    FROM public.case_practitioner_work cpw
    JOIN public.client_cases cc ON cc.id = cpw.case_id
    WHERE cc.client_id = up.user_id
      AND cpw.practitioner_id = auth.uid()
  )
  OR is_admin();

GRANT SELECT ON public.practitioner_client_personalisation TO authenticated;

-- ── 7. Extend handle_new_user() to also create personalisation row ───────────
--
-- Preserves the existing profile creation. Adds a single personalisation
-- INSERT with ON CONFLICT DO NOTHING (defensive against any race). Defaults
-- from the CREATE TABLE apply: religion = 'prefer_not_to_say',
-- religious_content_preference = 'hide', biological_sex = NULL.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    'user',
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );

  INSERT INTO public.user_personalisation (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── 8. One-time backfill for existing profiles ───────────────────────────────
--
-- Every profile that lacks a personalisation row gets one with defaults.
-- Safe to re-run (ON CONFLICT guard).

INSERT INTO public.user_personalisation (user_id)
SELECT p.id
FROM public.profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_personalisation up WHERE up.user_id = p.id
)
ON CONFLICT (user_id) DO NOTHING;
