-- Sprint B Phase 1 — signature question dedicated field
--
-- Adds intake_responses.most_want_to_understand text column to capture the
-- new Chapter 1 question:
--   "If we get this right, what would you most want to understand about
--    what's happening to you?"
--
-- HARD DEPENDENCY (per Sprint B Phase 1 spec): the field is read by:
--   • Practitioner workspace (Client Summary panel) — quoted verbatim
--   • generateBodyStory prompt builder — context parameter
--   • generateHealthSynopsis prompt builder — context parameter
-- A question the platform asks but never quotes back is worse than not
-- asking it at all.
--
-- Nullable: the question is not required (per spec). Absence is itself
-- a signal — the practitioner panel shows the field only when populated.
--
-- No defaults backfill needed: pre-Sprint-B users simply have NULL here;
-- downstream consumers handle that case gracefully.

ALTER TABLE public.intake_responses
  ADD COLUMN IF NOT EXISTS most_want_to_understand text;

COMMENT ON COLUMN public.intake_responses.most_want_to_understand IS
  'Sprint B Phase 1 — signature question. The user''s answer to "what would you most want to understand". '
  'Quoted verbatim in practitioner workspace, body story opening, and synopsis opening.';
