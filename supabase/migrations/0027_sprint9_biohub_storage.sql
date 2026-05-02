-- Sprint 9 — BioHub: lab-reports storage bucket
-- NOTE: This migration was applied directly via Supabase MCP before sprint coding began.
--       This file is a record only. DO NOT apply it again.

-- 1. Create private storage bucket for lab report PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lab-reports',
  'lab-reports',
  false,                          -- private bucket — never public
  10485760,                       -- 10 MB limit
  ARRAY['application/pdf']        -- PDF only
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS: members can upload to their own folder (userId/timestamp_filename)
CREATE POLICY "Members upload own reports"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lab-reports'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 3. RLS: service role can read all (for Claude parsing via admin client)
--    Members cannot read storage directly — they access results via biomarker_results rows.
CREATE POLICY "Service role read all lab reports"
  ON storage.objects FOR SELECT
  TO service_role
  USING (bucket_id = 'lab-reports');
