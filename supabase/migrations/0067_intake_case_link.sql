-- ─── 0067_intake_case_link.sql ───────────────────────────────────────────────
-- Give a completed Intake an explicit, stable link to its canonical case.
--
-- WHY
--
-- Until now the only relationship between an Intake and a case was
-- intake_responses.member_id = client_cases.client_id — a link by PERSON, not
-- by record. That is unambiguous only while a client has exactly one case.
-- Production already disproves that: the "Natural Intelligence" account holds
-- TWO cases and one completed Intake, so "which case did this Intake feed?"
-- currently has no answer.
--
-- Stage 0 confirmed there is no existing linkage table to reuse. The only
-- other intake-shaped foreign key, intake_symptom_details.intake_id, points at
-- an Intake, not at a case.
--
-- WHAT THIS DOES NOT DO
--
-- It does not add a uniqueness constraint on active cases. Production holds
-- two active cases for one client, and altering historical case status purely
-- so an index can build would be falsifying history to satisfy a schema.
-- Duplicate-case reconciliation is a separate controlled mission.
--
-- It does not backfill ambiguous rows. See the backfill note at the foot:
-- every current row is deliberately left NULL, and each has a stated reason.

BEGIN;

-- ─── 1. The column ───────────────────────────────────────────────────────────
-- Nullable, because historical Intakes genuinely have no resolvable case and
-- inventing one would manufacture provenance.
--
-- ON DELETE RESTRICT, not SET NULL: a case that an Intake points at must not
-- be deletable out from under the link, and silently nulling the pointer would
-- destroy exactly the traceability this column exists to provide.

ALTER TABLE public.intake_responses
  ADD COLUMN IF NOT EXISTS case_id uuid
    REFERENCES public.client_cases(id) ON DELETE RESTRICT;

COMMENT ON COLUMN public.intake_responses.case_id IS
  'Canonical client_cases row this completed Intake established or resumed. '
  'NULL for historical Intakes whose case is absent or ambiguous — see '
  'migration 0067. Set once at Intake completion and never silently reassigned.';

-- ─── 2. Index ────────────────────────────────────────────────────────────────
-- Partial: the lookup is always "which Intake fed this case?", and NULL rows
-- are the historical remainder, never a query target.

CREATE INDEX IF NOT EXISTS intake_responses_case_id_idx
  ON public.intake_responses (case_id)
  WHERE case_id IS NOT NULL;

-- ─── 3. Integrity ────────────────────────────────────────────────────────────
-- Two invariants a CHECK cannot express, because both need another table or
-- the previous row version.
--
--   (a) the case must belong to the SAME person as the Intake. Without this a
--       member could be linked to another member's case, which is a privacy
--       breach wearing a foreign key.
--   (b) once set, the link is STABLE. Re-pointing a completed Intake at a
--       different case would rewrite history after the fact. Clearing it back
--       to NULL is refused for the same reason.
--
-- Deliberately NOT security definer: this is an integrity rule, not an
-- authority grant, and it must run with the caller's own rights.

CREATE OR REPLACE FUNCTION public.enforce_intake_case_link()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_case_client uuid;
BEGIN
  -- (b) stability — checked first, so an attempted reassignment is reported
  -- as a reassignment rather than as whatever the new case happens to be.
  IF TG_OP = 'UPDATE'
     AND OLD.case_id IS NOT NULL
     AND NEW.case_id IS DISTINCT FROM OLD.case_id THEN
    RAISE EXCEPTION
      'intake_responses.case_id is immutable once set (intake %, case % -> %)',
      OLD.id, OLD.case_id, NEW.case_id
      USING ERRCODE = '23514';
  END IF;

  -- (a) same-owner
  IF NEW.case_id IS NOT NULL THEN
    SELECT client_id INTO v_case_client
      FROM public.client_cases
     WHERE id = NEW.case_id;

    IF v_case_client IS NULL THEN
      RAISE EXCEPTION 'intake_responses.case_id % does not exist', NEW.case_id
        USING ERRCODE = '23503';
    END IF;

    IF v_case_client <> NEW.member_id THEN
      RAISE EXCEPTION
        'intake_responses.case_id % belongs to a different member', NEW.case_id
        USING ERRCODE = '23514';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_intake_case_link ON public.intake_responses;
CREATE TRIGGER trg_enforce_intake_case_link
  BEFORE INSERT OR UPDATE ON public.intake_responses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_intake_case_link();

-- ─── 4. Backfill — deliberately empty ────────────────────────────────────────
--
-- No row is backfilled. Every Intake currently in Production falls into one of
-- three states, and none is provably unambiguous:
--
--   AMBIGUOUS  "Natural Intelligence" (1854aa09…) — completed Intake, but the
--              account holds TWO active cases (10d4456a… created 6 May, and
--              cccccccc-0000-4000-8000-000000000003 created 11 May from a demo
--              bundle no longer present in the codebase). Nothing in the data
--              says which case the Intake fed. Guessing would invent
--              provenance, so it stays NULL.
--
--   ABSENT     Saima Khalil (01048cd3…) — completed Intake on 13 September,
--              and NO case exists. Her completion generated four
--              health_synopsis rows but zero body_story rows, and body-story
--              generation was the only path that created a case. There is
--              nothing to link to. Stays NULL.
--
--   INCOMPLETE Tree Khan (e94b50e0…) — Intake in progress, is_complete false.
--              A case is established at COMPLETION, so an incomplete Intake
--              correctly has none yet. Stays NULL, and will be populated by
--              the completion path, not by this migration.
--
-- These three rows are the documented reconciliation backlog. They remain
-- valid: the column is nullable precisely so that history can stay honest.

COMMIT;
