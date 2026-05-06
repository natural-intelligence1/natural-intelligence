-- ──────────────────────────────────────────────────────────────────────────────
-- 0034_g1_practitioners_rebuild.sql
-- Rebuilds practitioners table: id = auth.users.id, full status lifecycle,
-- complete audit fields, public directory view.
-- Migrates existing 5 test rows. Recreates all dependent functions.
-- ──────────────────────────────────────────────────────────────────────────────

-- Step 1: Capture existing rows before any changes
CREATE TABLE practitioners_v1_backup AS SELECT * FROM practitioners;

-- Step 2: Drop functions that take practitioners as a type argument.
-- CASCADE drops the practitioner_completeness_trigger that calls this function.
DROP FUNCTION IF EXISTS calculate_profile_completeness(practitioners) CASCADE;

-- Step 3: Drop the old table.
-- CASCADE removes: events_practitioner_id_fkey, remaining triggers,
-- RLS policies, indexes.
DROP TABLE practitioners CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 4: New practitioners table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE practitioners (

  -- ── Identity ─────────────────────────────────────────────────────────────
  -- id IS auth.users.id. ON DELETE RESTRICT: auth user cannot be deleted
  -- while a practitioner record exists.
  id                        uuid PRIMARY KEY REFERENCES auth.users(id)
                              ON DELETE RESTRICT,

  -- ── Lifecycle ─────────────────────────────────────────────────────────────
  status                    text NOT NULL DEFAULT 'pending_review'
                              CHECK (status IN (
                                'pending_review', 'approved', 'active',
                                'suspended', 'archived'
                              )),

  -- ── Directory identity ─────────────────────────────────────────────────────
  display_name              text NOT NULL,
  bio                       text,
  credentials_summary       text,
  specialisations           text[] NOT NULL DEFAULT '{}',

  -- ── Audit trail ───────────────────────────────────────────────────────────
  verified_by               uuid REFERENCES auth.users(id),
  verified_at               timestamptz,
  suspended_by              uuid REFERENCES auth.users(id),
  suspended_at              timestamptz,
  suspension_reason         text,
  archived_by               uuid REFERENCES auth.users(id),
  archived_at               timestamptz,
  archive_reason            text,

  -- ── Preserved profile columns ──────────────────────────────────────────────
  trust_level               trust_level NOT NULL DEFAULT 'unvetted',
  credentials               text[] NOT NULL DEFAULT '{}',
  modalities                text,
  years_experience          integer,
  experience_range          text
                              CHECK (experience_range IN
                                ('0-1','1-3','3-5','5-10','10+')),
  delivery_mode             text
                              CHECK (delivery_mode IN
                                ('online','in_person','both')),
  website_url               text,
  linkedin_url              text,
  instagram_url             text,
  other_social_urls         text,
  city                      text,
  country                   text,
  primary_professions       text[] NOT NULL DEFAULT '{}',
  area_tags                 text[] NOT NULL DEFAULT '{}',
  client_types              text[] NOT NULL DEFAULT '{}',
  collaboration_types       text[] NOT NULL DEFAULT '{}',
  accepts_referrals         boolean NOT NULL DEFAULT true,
  open_to_collaboration     boolean NOT NULL DEFAULT false,
  currently_seeing_clients  boolean,
  practitioner_tier         text NOT NULL DEFAULT 'standard'
                              CHECK (practitioner_tier IN
                                ('standard','featured','specialist','senior')),
  practice_name             text,
  tagline                   text,
  referral_contact_method   text
                              CHECK (referral_contact_method IN
                                ('email','website','platform_message')),
  support_needs             text,
  display_order             integer NOT NULL DEFAULT 0,
  profile_completeness_pct  integer NOT NULL DEFAULT 0,
  is_directory_ready        boolean NOT NULL DEFAULT false,
  is_test_data              boolean NOT NULL DEFAULT false,

  -- DEPRECATED: use status = 'active'. Synced by sync_is_active trigger.
  -- Remove after admin app reads status directly.
  is_active                 boolean NOT NULL DEFAULT false,

  -- ── Timestamps ─────────────────────────────────────────────────────────────
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 5: Recreate calculate_profile_completeness for the new table type
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.calculate_profile_completeness(p practitioners)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  score integer := 0;
BEGIN
  IF p.tagline IS NOT NULL AND length(p.tagline) > 10
    THEN score := score + 20; END IF;
  IF p.area_tags IS NOT NULL AND array_length(p.area_tags, 1) > 0
    THEN score := score + 20; END IF;
  IF p.delivery_mode IS NOT NULL
    THEN score := score + 15; END IF;
  IF p.credentials IS NOT NULL AND array_length(p.credentials, 1) > 0
    THEN score := score + 15; END IF;
  IF p.primary_professions IS NOT NULL AND array_length(p.primary_professions, 1) > 0
    THEN score := score + 15; END IF;
  IF p.website_url IS NOT NULL
    THEN score := score + 10; END IF;
  IF p.linkedin_url IS NOT NULL
    THEN score := score + 5; END IF;
  RETURN LEAST(score, 100);
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 6: Recreate update_profile_completeness trigger function
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_profile_completeness()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.profile_completeness_pct := calculate_profile_completeness(NEW);
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 7: sync_is_active — deprecation bridge
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_practitioner_is_active()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.is_active := (NEW.status = 'active');
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 8: is_active_practitioner() — used in RLS policies on case tables
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_active_practitioner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM practitioners
    WHERE id = auth.uid() AND status = 'active'
  )
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 9: Triggers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TRIGGER practitioners_updated_at
  BEFORE UPDATE ON practitioners
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER sync_is_active
  BEFORE INSERT OR UPDATE ON practitioners
  FOR EACH ROW EXECUTE FUNCTION sync_practitioner_is_active();

CREATE TRIGGER practitioner_completeness_trigger
  BEFORE INSERT OR UPDATE ON practitioners
  FOR EACH ROW EXECUTE FUNCTION update_profile_completeness();

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 10: RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;

-- Practitioner reads own full record (care app self-lookup via anon key + JWT)
CREATE POLICY practitioner_self_select ON practitioners
  FOR SELECT USING (id = auth.uid());

-- Service role: unrestricted (admin app uses service_role for all mutations)
CREATE POLICY practitioners_service_all ON practitioners
  FOR ALL USING (auth.role() = 'service_role');

-- NOTE: No anon policy on this table. Anon reads go through practitioners_directory view.

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 11: Indexes
-- ─────────────────────────────────────────────────────────────────────────────
-- Status-based queries (admin list, middleware suspension check)
CREATE INDEX idx_practitioners_status ON practitioners(status);

-- Test data filtering
CREATE INDEX idx_practitioners_is_test_data ON practitioners(is_test_data)
  WHERE is_test_data = true;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 12: Public directory view — anon-safe column set only
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW practitioners_directory AS
SELECT
  id,
  display_name,
  bio,
  credentials_summary,
  specialisations,
  modalities,
  years_experience,
  experience_range,
  delivery_mode,
  city,
  country,
  primary_professions,
  area_tags,
  client_types,
  practice_name,
  tagline,
  practitioner_tier,
  accepts_referrals,
  currently_seeing_clients,
  profile_completeness_pct,
  is_directory_ready
FROM practitioners
WHERE status = 'active'
  AND is_directory_ready = true;

GRANT SELECT ON practitioners_directory TO anon;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 13: Data migration from backup
-- id          = profile_id (was auth.users.id, now the PK)
-- status      = lifecycle_status → mapped values
-- display_name = profiles.full_name (COALESCE to 'Practitioner' if NULL)
-- Audit fields: no historical audit data on test rows; start clean
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO practitioners (
  id, status, display_name, bio, credentials_summary, specialisations,
  verified_by, verified_at,
  trust_level, credentials, modalities, years_experience, experience_range,
  delivery_mode, website_url, linkedin_url, instagram_url, other_social_urls,
  city, country, primary_professions, area_tags, client_types,
  collaboration_types, accepts_referrals, open_to_collaboration,
  currently_seeing_clients, practitioner_tier, practice_name, tagline,
  referral_contact_method, support_needs, display_order,
  profile_completeness_pct, is_directory_ready, is_test_data,
  created_at, updated_at
)
SELECT
  v.profile_id                                  AS id,
  CASE v.lifecycle_status
    WHEN 'approved_pending_profile'             THEN 'approved'
    WHEN 'active'                               THEN 'active'
    WHEN 'paused'                               THEN 'suspended'
    WHEN 'rejected'                             THEN 'archived'
    ELSE                                             'pending_review'
  END                                           AS status,
  COALESCE(pr.full_name, 'Practitioner')        AS display_name,
  v.bio,
  NULL                                          AS credentials_summary,
  '{}'::text[]                                  AS specialisations,
  NULL                                          AS verified_by,
  v.accepted_at                                 AS verified_at,
  v.trust_level,
  COALESCE(v.credentials, '{}')                 AS credentials,
  v.modalities,
  v.years_experience,
  v.experience_range,
  v.delivery_mode,
  v.website_url,
  v.linkedin_url,
  v.instagram_url,
  v.other_social_urls,
  v.city,
  v.country,
  COALESCE(v.primary_professions, '{}')         AS primary_professions,
  COALESCE(v.area_tags, '{}')                   AS area_tags,
  COALESCE(v.client_types, '{}')                AS client_types,
  COALESCE(v.collaboration_types, '{}')         AS collaboration_types,
  v.accepts_referrals,
  v.open_to_collaboration,
  v.currently_seeing_clients,
  v.practitioner_tier,
  v.practice_name,
  v.tagline,
  v.referral_contact_method,
  v.support_needs,
  v.display_order,
  v.profile_completeness_pct,
  v.is_directory_ready,
  v.is_test_data,
  COALESCE(v.created_at, now())                 AS created_at,
  COALESCE(v.updated_at, now())                 AS updated_at
FROM practitioners_v1_backup v
LEFT JOIN profiles pr ON pr.id = v.profile_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 14: Verify row count
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  old_count integer;
  new_count integer;
BEGIN
  SELECT COUNT(*) INTO old_count FROM practitioners_v1_backup;
  SELECT COUNT(*) INTO new_count FROM practitioners;
  IF old_count != new_count THEN
    RAISE EXCEPTION 'Row count mismatch: expected %, got %', old_count, new_count;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 15: Re-add events.practitioner_id FK to new practitioners.id
-- (original was dropped via CASCADE when old table was dropped)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE events
  ADD CONSTRAINT events_practitioner_id_fkey
  FOREIGN KEY (practitioner_id) REFERENCES practitioners(id)
  ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Step 16: Clean up backup table
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE practitioners_v1_backup;
