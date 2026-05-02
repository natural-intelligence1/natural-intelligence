-- Sprint 9 — BioHub: lab_reports, biomarker_results, functional_ranges tables
-- NOTE: This migration was applied directly via Supabase MCP before sprint coding began.
--       This file is a record only. DO NOT apply it again.

-- 1. lab_reports — tracks uploaded PDF lab reports per member
CREATE TABLE IF NOT EXISTS lab_reports (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name      text NOT NULL,
  file_path      text NOT NULL,
  file_size      integer,
  upload_status  text NOT NULL DEFAULT 'uploaded',  -- uploaded | processing | parsed | failed
  parse_error    text,
  parsed_at      timestamptz,
  report_date    date,
  lab_name       text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- RLS: members can only read/insert their own reports
ALTER TABLE lab_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own lab_reports"
  ON lab_reports FOR SELECT
  USING (member_id = auth.uid());

CREATE POLICY "Members insert own lab_reports"
  ON lab_reports FOR INSERT
  WITH CHECK (member_id = auth.uid());

-- 2. functional_ranges — NI reference ranges for known biomarker keys
CREATE TABLE IF NOT EXISTS functional_ranges (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marker_key       text NOT NULL UNIQUE,
  marker_name      text NOT NULL,
  unit             text,
  gp_range_low     numeric,
  gp_range_high    numeric,
  ni_range_low     numeric,
  ni_range_high    numeric,
  ni_optimal_low   numeric,
  ni_optimal_high  numeric,
  zone_1_max       numeric,
  zone_2_max       numeric,
  zone_3_max       numeric,
  zone_4_min       numeric,
  zone_4_max       numeric,
  zone_5_max       numeric,
  notes            text,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- Public read — no sensitive data
ALTER TABLE functional_ranges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read functional_ranges"
  ON functional_ranges FOR SELECT USING (true);

-- 3. biomarker_results — extracted + cross-referenced results per report
CREATE TABLE IF NOT EXISTS biomarker_results (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id          uuid NOT NULL REFERENCES lab_reports(id) ON DELETE CASCADE,
  member_id          uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  marker_name        text NOT NULL,
  marker_key         text,
  value              numeric,
  unit               text,
  raw_value          text,
  gp_range_low       numeric,
  gp_range_high      numeric,
  gp_interpretation  text,
  ni_range_low       numeric,
  ni_range_high      numeric,
  ni_optimal_low     numeric,
  ni_optimal_high    numeric,
  functional_zone    integer,  -- 1–6
  ni_interpretation  text,
  created_at         timestamptz DEFAULT now()
);

ALTER TABLE biomarker_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own biomarker_results"
  ON biomarker_results FOR SELECT
  USING (member_id = auth.uid());
