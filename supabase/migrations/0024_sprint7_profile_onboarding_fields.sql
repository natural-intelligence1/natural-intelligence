-- Sprint 7 — add onboarding fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_intent        text,
  ADD COLUMN IF NOT EXISTS heard_about              text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at  timestamptz;
