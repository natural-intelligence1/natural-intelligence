-- 0055 — Source/methodology metadata for NI educational comparison ranges
--
-- ⚠ COMMITTED AS A FILE ONLY — NOT YET APPLIED.
--
-- Legal clearance (13 Sep 2026): BioHub may display a separately labelled
-- "NI Educational Comparison Range" (or Educational Sufficiency /
-- Nutritional Comparison Range) ONLY where the range carries identifiable
-- source/methodology metadata. The BioHub report page is already
-- source-gated: it selects these columns and shows a range only when
-- source_label is present — so pre-apply, and for any row left uncurated
-- after apply, members see "No NI educational comparison range is currently
-- available for this marker." (default deny).
--
-- Published deficiency/sufficiency thresholds (cleared output 6) should be
-- curated as their own rows with range_type set accordingly.

ALTER TABLE public.functional_ranges
  ADD COLUMN IF NOT EXISTS range_type        TEXT NOT NULL DEFAULT 'ni_educational'
    CHECK (range_type IN (
      'ni_educational',                   -- NI Educational Comparison Range
      'ni_educational_sufficiency',       -- NI Educational Sufficiency Range
      'ni_nutritional',                   -- NI Nutritional Comparison Range
      'published_deficiency_threshold',   -- published, source-identified
      'published_sufficiency_threshold'   -- published, source-identified
    )),
  ADD COLUMN IF NOT EXISTS source_label      TEXT,   -- short label shown in UI ("Source: …")
  ADD COLUMN IF NOT EXISTS source_reference  TEXT,   -- citation / methodology note (internal + tooltip)
  ADD COLUMN IF NOT EXISTS last_reviewed_at  DATE,
  ADD COLUMN IF NOT EXISTS reviewed_by       TEXT;

COMMENT ON COLUMN public.functional_ranges.source_label IS
  'Required before an NI educational range may be DISPLAYED to members — the '
  'BioHub UI hides any range whose source_label is NULL.';

-- ── Post-apply steps ──────────────────────────────────────────────────────────
-- 1. Curate source_label / source_reference / last_reviewed_at / reviewed_by
--    for each marker whose educational range should show. Uncurated rows stay
--    hidden automatically.
-- 2. Assertion: ranges without sources are invisible — the UI gate is
--    source_label IS NOT NULL; verify with
--      SELECT marker_key, source_label FROM public.functional_ranges
--      WHERE ni_range_low IS NOT NULL AND source_label IS NULL;
--    → these markers must show the "No NI educational comparison range…"
--      line in the report view.
