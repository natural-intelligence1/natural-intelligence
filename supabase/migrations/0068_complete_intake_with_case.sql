-- ─── 0068_complete_intake_with_case.sql ──────────────────────────────────────
-- Make Intake completion ONE transaction.
--
-- WHY
--
-- Stage 1 established case identity on the completion path, but it did so as
-- five separate PostgREST requests — response completion, case lookup, case
-- insert, link, session update. Each is its own transaction, so a failure
-- after the second one left the database in exactly the state the invariant
-- forbids: intake_responses.is_complete = true with case_id NULL. An
-- application-level throw does not undo a committed row.
--
-- It was also not concurrency-safe at the point that matters. The link write
-- was guarded by `.is('case_id', null)`, which protects the LINK, but two
-- genuinely concurrent first completions could both read "no open case" and
-- both INSERT one. The loser's case would then be orphaned — a second
-- non-closed case for the same client, created silently.
--
-- This function does the whole mandatory spine in one transaction, under a
-- lock scoped to the client.
--
-- WHAT THIS IS NOT
--
-- SECURITY INVOKER, deliberately. It is not a privilege grant and must never
-- become one: it runs with the caller's own rights, RLS applies as usual, and
-- a caller that is not the service role may only complete THEIR OWN Intake.
-- It touches nothing practitioner-related — no eligibility, no assignment, no
-- case team, no sign-off.
--
-- It adds no uniqueness constraint. Production still holds duplicate active
-- cases requiring separate reconciliation, and that ruling is unchanged.

BEGIN;

CREATE OR REPLACE FUNCTION public.complete_intake_with_case(
  p_member_id          uuid,
  p_consent_to_ai      boolean     DEFAULT NULL,
  p_consent_given_at   timestamptz DEFAULT NULL,
  p_completed_sections integer     DEFAULT 6
)
RETURNS TABLE (case_id uuid, outcome text, case_status text, already_linked boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role     text := coalesce(auth.role(), '');
  v_caller   uuid := auth.uid();
  v_response public.intake_responses%ROWTYPE;
  v_case_id  uuid;
  v_status   text;
  v_outcome  text;
  v_already  boolean := false;
BEGIN
  -- ── Identity ───────────────────────────────────────────────────────────
  -- The server action calls this with the service role. Anyone else may only
  -- complete their own Intake: the member id is an argument, so without this
  -- check the function would be a way to complete somebody else's.
  IF v_role <> 'service_role'
     AND (v_caller IS NULL OR v_caller <> p_member_id) THEN
    RAISE EXCEPTION 'complete_intake_with_case: may only complete your own Intake'
      USING ERRCODE = '42501';
  END IF;

  -- ── Serialise, narrowly ────────────────────────────────────────────────
  -- Transaction-scoped and keyed on THIS client, so two completions for the
  -- same person queue while completions for different people run freely.
  -- Released automatically on commit or rollback. Taken BEFORE the first read,
  -- which is the whole point: the loser must not read a stale "no case here".
  PERFORM pg_advisory_xact_lock(hashtextextended(p_member_id::text, 0));

  SELECT * INTO v_response
    FROM public.intake_responses
   WHERE member_id = p_member_id;

  IF NOT FOUND THEN
    INSERT INTO public.intake_responses (
      member_id, is_complete, completed_sections,
      consent_to_ai_analysis, consent_given_at, updated_at
    ) VALUES (
      p_member_id, true, p_completed_sections,
      p_consent_to_ai, p_consent_given_at, now()
    )
    RETURNING * INTO v_response;
  END IF;

  -- ── Resolve the canonical case ─────────────────────────────────────────
  IF v_response.case_id IS NOT NULL THEN
    -- Already linked. Idempotent: a retry must not create or move anything.
    v_case_id := v_response.case_id;
    SELECT cc.status INTO v_status
      FROM public.client_cases cc WHERE cc.id = v_case_id;
    v_outcome := 'resumed';
    v_already := true;
  ELSE
    SELECT cc.id, cc.status INTO v_case_id, v_status
      FROM public.client_cases cc
     WHERE cc.client_id = p_member_id
       AND cc.status IN ('draft', 'intake_complete', 'active', 'paused')
     ORDER BY cc.created_at DESC
     LIMIT 1;

    IF v_case_id IS NULL THEN
      INSERT INTO public.client_cases (client_id, status)
      VALUES (p_member_id, 'intake_complete')
      RETURNING id, status INTO v_case_id, v_status;
      v_outcome := 'created';
    ELSE
      -- A draft advances; anything further along keeps its status, because
      -- re-submitting an Intake must not demote a client in live care.
      IF v_status = 'draft' THEN
        UPDATE public.client_cases
           SET status = 'intake_complete'
         WHERE id = v_case_id AND status = 'draft';
        v_status := 'intake_complete';
      END IF;
      v_outcome := 'resumed';
    END IF;
  END IF;

  -- ── Completion and link, same transaction ──────────────────────────────
  -- coalesce on case_id so a re-run is a no-op rather than a reassignment:
  -- 0067's trigger refuses any change to a set link, including to NULL.
  --
  -- The table alias is NOT cosmetic. This function RETURNS TABLE (case_id …),
  -- so `case_id` on the right-hand side would be ambiguous between that output
  -- parameter and the column, and PostgreSQL rejects the statement at runtime.
  -- Every read of a column that shares a name with an output parameter is
  -- therefore qualified.
  UPDATE public.intake_responses AS r
     SET is_complete            = true,
         completed_sections     = p_completed_sections,
         consent_to_ai_analysis = coalesce(p_consent_to_ai, r.consent_to_ai_analysis),
         consent_given_at       = coalesce(p_consent_given_at, r.consent_given_at),
         case_id                = coalesce(r.case_id, v_case_id),
         updated_at             = now()
   WHERE r.id = v_response.id;

  -- ── Session consistency ────────────────────────────────────────────────
  -- Scoped to in_progress so a completed or abandoned session is never
  -- rewritten, and a repeat call matches zero rows.
  UPDATE public.intake_sessions
     SET status       = 'completed',
         completed_at = now(),
         updated_at   = now()
   WHERE member_id = p_member_id
     AND status    = 'in_progress';

  RETURN QUERY SELECT v_case_id, v_outcome, v_status, v_already;
END;
$$;

COMMENT ON FUNCTION public.complete_intake_with_case(uuid, boolean, timestamptz, integer) IS
  'The mandatory Intake-completion spine as ONE transaction: response '
  'completion, canonical case create/resume, immutable case link and session '
  'completion. Serialised per client by a transaction-scoped advisory lock. '
  'SECURITY INVOKER — not a privilege grant; non-service callers may only '
  'complete their own Intake. See migration 0068.';

-- Not executable by anonymous callers. The server action uses the service
-- role; `authenticated` is granted so the function can also be called with a
-- member's own session without becoming a back door for anyone else's.
REVOKE ALL ON FUNCTION public.complete_intake_with_case(uuid, boolean, timestamptz, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_intake_with_case(uuid, boolean, timestamptz, integer)
  TO authenticated, service_role;

COMMIT;
