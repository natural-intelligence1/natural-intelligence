-- Sprint B Phase 2 — Chapter 2 expansion: Best Self Baseline fields
--
-- The intake journey architecture §7 specifies a six-question Best Self
-- Baseline. Sprint B Phase 1 shipped only question 1 (timeline_last_well).
-- This migration adds the storage for the remaining five questions, which
-- are the heart of the chapter — they turn timeline_last_well from a data
-- point into a remembered baseline the body story can measure against.
--
-- Fields (all nullable, all default null — the chapter is optional and a
-- returning user predating this migration simply has NULLs here):
--   best_self_description    — Q2 free-text: "what was different back then"
--   best_self_sleep          — Q3 comparative: better_than_now|about_the_same|not_sure
--   best_self_energy         — Q4 comparative (same enum, stored as free text)
--   best_self_mood           — Q5 comparative (same enum, stored as free text)
--   best_self_recovery_goal  — Q6 free-text: "one thing you'd most want to get back"
--
-- Stored as text (not an enum type) to match the existing intake_responses
-- convention — timeline_last_well, symptom_pattern, etc. are all text. The
-- comparative values are validated at the UI (single-select chips); the
-- column stays permissive so a future option set doesn't need a type change.
--
-- Downstream consumers (all handle NULL gracefully):
--   • generateBodyStory   — buildBestSelfBlock() context block
--   • generateHealthSynopsis — same
--   • Practitioner workspace ClientSummaryPanel — "BEST SELF" section,
--     rendered only when at least one field is populated
--   • What We Heard rule engine — Pattern F

ALTER TABLE public.intake_responses
  ADD COLUMN IF NOT EXISTS best_self_description   text,
  ADD COLUMN IF NOT EXISTS best_self_sleep         text,
  ADD COLUMN IF NOT EXISTS best_self_energy        text,
  ADD COLUMN IF NOT EXISTS best_self_mood          text,
  ADD COLUMN IF NOT EXISTS best_self_recovery_goal text;

COMMENT ON COLUMN public.intake_responses.best_self_description IS
  'Sprint B Phase 2 — Best Self Baseline Q2. Free-text: what was different about the user''s life when they last felt well. Tier A. Quoted in body story, synopsis, practitioner workspace.';
COMMENT ON COLUMN public.intake_responses.best_self_sleep IS
  'Sprint B Phase 2 — Best Self Baseline Q3. Comparative: better_than_now | about_the_same | not_sure.';
COMMENT ON COLUMN public.intake_responses.best_self_energy IS
  'Sprint B Phase 2 — Best Self Baseline Q4. Comparative: better_than_now | about_the_same | not_sure.';
COMMENT ON COLUMN public.intake_responses.best_self_mood IS
  'Sprint B Phase 2 — Best Self Baseline Q5. Comparative: better_than_now | about_the_same | not_sure.';
COMMENT ON COLUMN public.intake_responses.best_self_recovery_goal IS
  'Sprint B Phase 2 — Best Self Baseline Q6. Free-text motivational anchor: the one thing the user would most want to get back.';
