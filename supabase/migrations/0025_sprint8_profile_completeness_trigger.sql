-- Sprint 8 — bio column on practitioners + profile_completeness_pct trigger
-- NOTE: This migration was applied directly via Supabase MCP before sprint coding began.
--       This file is a record only. Do NOT apply it again.

-- 1. Add bio column to practitioners table
ALTER TABLE practitioners
  ADD COLUMN IF NOT EXISTS bio text;

-- 2. Function: recalculate profile_completeness_pct and is_directory_ready
--    Required fields: tagline, bio, primary_professions, area_tags,
--                     delivery_mode, city, country  (7 total)
CREATE OR REPLACE FUNCTION recalculate_profile_completeness()
RETURNS TRIGGER AS $$
DECLARE
  filled   integer := 0;
  total    integer := 7;
  pct      integer;
  is_ready boolean;
BEGIN
  IF NEW.tagline          IS NOT NULL AND length(trim(NEW.tagline))   > 0 THEN filled := filled + 1; END IF;
  IF NEW.bio              IS NOT NULL AND length(trim(NEW.bio))       > 0 THEN filled := filled + 1; END IF;
  IF NEW.primary_professions IS NOT NULL AND array_length(NEW.primary_professions, 1) > 0 THEN filled := filled + 1; END IF;
  IF NEW.area_tags        IS NOT NULL AND array_length(NEW.area_tags,  1)             > 0 THEN filled := filled + 1; END IF;
  IF NEW.delivery_mode    IS NOT NULL AND length(trim(NEW.delivery_mode)) > 0           THEN filled := filled + 1; END IF;
  IF NEW.city             IS NOT NULL AND length(trim(NEW.city))      > 0               THEN filled := filled + 1; END IF;
  IF NEW.country          IS NOT NULL AND length(trim(NEW.country))   > 0               THEN filled := filled + 1; END IF;

  pct      := round((filled::numeric / total) * 100);
  is_ready := (pct = 100);

  NEW.profile_completeness_pct := pct;
  NEW.is_directory_ready       := is_ready;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger: fires BEFORE INSERT OR UPDATE on practitioners
DROP TRIGGER IF EXISTS trg_recalculate_profile_completeness ON practitioners;

CREATE TRIGGER trg_recalculate_profile_completeness
  BEFORE INSERT OR UPDATE ON practitioners
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_profile_completeness();

-- 4. Backfill existing rows
UPDATE practitioners SET updated_at = updated_at;
