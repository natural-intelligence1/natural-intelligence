-- ─── 0066_case_taking_persistence.sql ────────────────────────────────────────
-- Case-taking persistence. Written 6 November 2026 on Orchestrator approval of
-- the V2 proposal (docs/planning/case-taking-persistence-proposal-v2.md).
--
-- STATUS WHEN WRITTEN: not applied. Per README rule 2, do not trust this line
-- later — ask the database.
--
-- FILENAME: 0066 was chosen after reconciling the namespace, not by adding one
-- to the highest file in this folder. On the branch this was written on the
-- files stop at 0063, but 0064 and 0065 exist on main and are APPLIED, and
-- 0061 exists on a feature branch unapplied. 0066 is unused in every ref and
-- in the applied history. (0059 exists under two different filenames in
-- different refs — the collision this check is here to avoid.)
--
-- WHAT THIS IS
-- One shared case-taking artefact per consultation, with fast current state
-- and immutable history. The central design decision, and the thing that was
-- rejected in V1: a case-taking session is NOT a practitioner's private
-- draft. It is the consultation record. A practitioner captures, submits to
-- the Lead, and the Lead reviews and signs THE SAME ROW. Nothing keys on
-- practitioner_id, which is what makes that handoff possible rather than
-- merely intended.
--
-- SCOPE — exactly the approved list, nothing else:
--   A. case_taking_sessions
--   B. case_taking_answers
--   C. indexes + CHECK constraints
--   D. RLS
--   E. sign-off authority / immutability / revision triggers
--   F. case_contributions: session_id, entry_id, question_id + two indexes
--   G. CREATE OR REPLACE block_contribution_rewrite() to freeze those three
--
-- NOT IN SCOPE: no change to client_cases, case_team_roles,
-- client_practitioner_links, practitioners, member_protocols, case_events,
-- intake tables, consent tables, or any existing policy or function other
-- than block_contribution_rewrite().

BEGIN;

-- ─── A. case_taking_sessions ─────────────────────────────────────────────────

CREATE TABLE public.case_taking_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Case + consultation identity. No canonical consultation/episode/encounter
  -- table exists in this schema: client_cases is the whole relationship and
  -- case_practitioner_work is one practitioner's assigned task (and creating
  -- rows in it is itself an assignment artefact). Neither fits, so the
  -- consultation is identified here. If consultations later need their own
  -- scheduled time, attendees, location or appointment state, these two
  -- columns lift out into a case_consultations table and this table gains a
  -- foreign key — without reshaping anything else.
  case_id            uuid NOT NULL REFERENCES public.client_cases(id) ON DELETE CASCADE,
  consultation_seq   integer NOT NULL CHECK (consultation_seq >= 1),

  -- The CLINICAL TYPE of the consultation. 'reopened' is deliberately absent:
  -- reopening is lifecycle state, not a kind of consultation, and conflating
  -- the two would make "why was this consultation held" unanswerable.
  consultation_kind  text NOT NULL
                       CHECK (consultation_kind IN ('initial','follow_up','review')),

  -- ATTRIBUTION, NOT OWNERSHIP. Who opened the artefact. It confers no
  -- exclusive rights and does not gate who may continue it.
  started_by         uuid NOT NULL REFERENCES public.practitioners(id),

  -- Workflow state. These five values are already defined and unit-tested as
  -- CASE_TAKING_STATES in packages/db/src/cockpit/caseTaking.ts, which also
  -- holds the transition rules. Application authority for the transition to
  -- 'signed_off' is packages/db/src/cockpit/caseTakingSignOff.ts — required
  -- because the trigger below cannot gate a service-role caller.
  state              text NOT NULL DEFAULT 'in_progress'
                       CHECK (state IN ('in_progress','submitted_to_lead',
                                        'lead_review','ready_for_sign_off','signed_off')),

  -- Resume position. Opaque to the database.
  current_position   text,

  -- Submission / review transitions.
  submitted_by       uuid REFERENCES public.practitioners(id),
  submitted_at       timestamptz,
  review_started_by  uuid REFERENCES public.practitioners(id),
  review_started_at  timestamptz,
  ready_at           timestamptz,

  -- Sign-off. Authority is enforced by trigger below, not by convention.
  signed_off_by      uuid REFERENCES public.practitioners(id),
  signed_off_at      timestamptz,

  -- Versioning — mirrors member_protocols.
  version            integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  supersedes         uuid REFERENCES public.case_taking_sessions(id),

  -- Optimistic concurrency. Supplied with every write; a stale value is
  -- refused rather than overwriting another practitioner's newer edit.
  revision           integer NOT NULL DEFAULT 1 CHECK (revision >= 1),

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),

  -- A signature is both columns or neither.
  CONSTRAINT case_taking_signoff_complete
    CHECK ((signed_off_by IS NULL) = (signed_off_at IS NULL)),

  -- state = 'signed_off' and the signature must agree, in both directions.
  CONSTRAINT case_taking_signoff_state
    CHECK ((state = 'signed_off') = (signed_off_at IS NOT NULL)),

  -- Version 1 starts a chain; every later version supersedes exactly one row.
  CONSTRAINT case_taking_version_chain
    CHECK ((version = 1 AND supersedes IS NULL) OR (version > 1 AND supersedes IS NOT NULL)),

  -- A submission must say who submitted it, and a review who took it up.
  CONSTRAINT case_taking_submitted_complete
    CHECK ((submitted_by IS NULL) = (submitted_at IS NULL)),
  CONSTRAINT case_taking_review_complete
    CHECK ((review_started_by IS NULL) = (review_started_at IS NULL)),

  -- A row cannot supersede itself.
  CONSTRAINT case_taking_no_self_supersede
    CHECK (supersedes IS DISTINCT FROM id)
);

COMMENT ON TABLE public.case_taking_sessions IS
  'One case-taking/consultation artefact per (case_id, consultation_seq), versioned. '
  'Shared, not practitioner-owned: the capturing practitioner and the reviewing Lead '
  'work on the same row. Practitioner attribution lives on started_by, the transition '
  'columns, case_taking_answers.updated_by and case_contributions.author_id.';

COMMENT ON COLUMN public.case_taking_sessions.consultation_kind IS
  'Clinical type of the consultation: initial, follow_up or review. Reopening is '
  'lifecycle state and is deliberately NOT a kind.';

-- ─── B. case_taking_answers ──────────────────────────────────────────────────

CREATE TABLE public.case_taking_answers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES public.case_taking_sessions(id) ON DELETE CASCADE,

  -- Entry identity. This replaces the rejected question_id = 'obs:<uuid>'
  -- overload, which pushed an object type into a canonical Question Graph
  -- identifier and would have made every consumer of question_id parse it.
  entry_kind    text NOT NULL CHECK (entry_kind IN ('answer','observation','safety')),
  entry_id      uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Canonical Question Graph identity. NULL only for free-standing observations.
  question_id   text,
  section_id    text,

  -- Canonical SAFETY identity for Annex-driven capture, alongside the question
  -- identity rather than instead of it.
  annex_rule_id text,

  -- The current working value. jsonb so a scale, a multi-select and free text
  -- all land in one column, as intake_answers already does.
  value         jsonb,
  provenance    text,

  -- Set ONLY when the practitioner actually asked. See the CHECK below.
  asked_at      timestamptz,

  -- Attribution of the CURRENT value. Earlier values are never overwritten in
  -- the audit record — they live in case_contributions, which is append-only.
  updated_by    uuid NOT NULL REFERENCES public.practitioners(id),

  revision      integer NOT NULL DEFAULT 1 CHECK (revision >= 1),

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  -- An answer (safety or not) answers a canonical question; an observation
  -- does not and must not borrow a question's identity.
  CONSTRAINT case_taking_entry_question_shape CHECK (
    (entry_kind IN ('answer','safety') AND question_id IS NOT NULL)
    OR (entry_kind = 'observation' AND question_id IS NULL)
  ),

  -- THE SAFETY INVARIANT. A safety row cannot exist without an explicit
  -- asked_at, so rendering, prefetching or reading a safety item can never
  -- produce an asked state. Enforced in the database precisely so that no
  -- interface mistake, prefetch or optimistic render can bypass it.
  CONSTRAINT case_taking_safety_requires_asked
    CHECK (entry_kind <> 'safety' OR asked_at IS NOT NULL),

  -- annex_rule_id is meaningful only for safety capture.
  CONSTRAINT case_taking_annex_scope
    CHECK (annex_rule_id IS NULL OR entry_kind = 'safety')
);

COMMENT ON CONSTRAINT case_taking_safety_requires_asked ON public.case_taking_answers IS
  'Reading or rendering a safety item must NEVER mark it asked. A safety entry row '
  'cannot be created without an explicit asked_at timestamp.';

-- ─── C. Indexes ──────────────────────────────────────────────────────────────

-- THE REVISED UNIQUENESS RULE. One open (unsigned) version per consultation.
-- This is the replacement for the rejected UNIQUE (case_id, practitioner_id)
-- WHERE signed_off_at IS NULL. It is what makes "another authorised
-- practitioner continues" resolve to the SAME artefact, and what stops the
-- Lead acquiring a second practitioner-owned session.
--
-- It also permits the amendment chain: a SIGNED row drops out of this partial
-- index, which frees the slot for version n+1 — and is why two unsigned
-- amendments of one consultation cannot coexist.
CREATE UNIQUE INDEX case_taking_one_open_version_idx
  ON public.case_taking_sessions (case_id, consultation_seq)
  WHERE signed_off_at IS NULL;

-- Version numbers are unique within a consultation.
CREATE UNIQUE INDEX case_taking_version_idx
  ON public.case_taking_sessions (case_id, consultation_seq, version);

-- The amendment chain stays linear: no two rows supersede the same row.
CREATE UNIQUE INDEX case_taking_supersedes_idx
  ON public.case_taking_sessions (supersedes)
  WHERE supersedes IS NOT NULL;

-- Cockpit list: open work for a case, newest consultation first.
CREATE INDEX case_taking_sessions_case_state_idx
  ON public.case_taking_sessions (case_id, state, consultation_seq DESC);

-- ONE CURRENT ANSWER per (session version, canonical question). Observations
-- are excluded by the WHERE, so a question may carry its single answer AND
-- any number of observations.
--
-- The kinds are listed explicitly rather than written as <> 'observation' so
-- that a future fourth entry kind has to be considered deliberately instead
-- of inheriting uniqueness by accident.
CREATE UNIQUE INDEX case_taking_one_current_answer_idx
  ON public.case_taking_answers (session_id, question_id)
  WHERE entry_kind IN ('answer','safety');

-- Every entry, each observation included, is individually addressable. This
-- is what autosave and the per-field history link write against.
CREATE UNIQUE INDEX case_taking_entry_identity_idx
  ON public.case_taking_answers (session_id, entry_id);

-- Fast CURRENT STATE read: one indexed scan per section.
CREATE INDEX case_taking_answers_session_section_idx
  ON public.case_taking_answers (session_id, section_id);

-- ─── D. RLS ──────────────────────────────────────────────────────────────────
-- One policy per table, anchored on the existing SECURITY DEFINER access
-- function. Nothing about consent, case-team membership, student supervision
-- or practitioner eligibility is restated here: it all arrives through that
-- one function. A second copy of the access rule is a second thing to get
-- wrong.

ALTER TABLE public.case_taking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_taking_answers  ENABLE ROW LEVEL SECURITY;

CREATE POLICY case_taking_sessions_access ON public.case_taking_sessions
  FOR ALL TO authenticated
  USING      (public.can_access_case_care_profile(case_id))
  WITH CHECK (public.can_access_case_care_profile(case_id));

CREATE POLICY case_taking_answers_access ON public.case_taking_answers
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.case_taking_sessions s
     WHERE s.id = case_taking_answers.session_id
       AND public.can_access_case_care_profile(s.case_id)))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.case_taking_sessions s
     WHERE s.id = case_taking_answers.session_id
       AND public.can_access_case_care_profile(s.case_id)));

-- ─── E. Authority, immutability and revision triggers ────────────────────────

-- E.1 Sign-off authority and Lead-start.
--
-- The sign-off rule is a STRUCTURAL COPY of the live
-- enforce_protocol_signature_authority(): active Lead case role, plus
-- practitioner_eligibility(actor,'lead').eligible, plus you may only sign as
-- yourself. Nothing is added. In particular sole_unregistered_lead is NOT
-- carried over — that is a Protocol-specific application rule and stays
-- Protocol-only. Case-taking sign-off asserts "this is the reviewed record of
-- the consultation", not "I professionally adopt this treatment Protocol".
--
-- The Lead-start rule is the Orchestrator's launch decision: an ACTIVE LEAD
-- may create or start a consultation; other authorised case-team
-- practitioners contribute to an existing one. No delegated
-- consultation-creation architecture is invented here.
--
-- SERVICE-ROLE NOTE. Like the Protocol trigger, this returns early when
-- auth.uid() IS NULL, because RLS and triggers are end-user controls and a
-- service-role caller has no uid. That gap is deliberate and is covered in
-- application code by authoriseCaseTakingSignOff()
-- (packages/db/src/cockpit/caseTakingSignOff.ts), which is WRITTEN AND TESTED
-- as of 7 Nov 2026 and must be in place before this migration is applied:
-- being server-side must never on its own be sufficient to sign. The single
-- supported write path is signOffCaseTakingSession() in the same module, and
-- a structural test fails if a second path to these columns ever appears.
CREATE OR REPLACE FUNCTION public.enforce_case_taking_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_eligible boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  -- Starting a consultation, or opening an amendment version, is a Lead act.
  if tg_op = 'INSERT' then
    if new.started_by is distinct from auth.uid() then
      raise exception 'case-taking: a session may only be started by the practitioner performing the action'
        using errcode = 'insufficient_privilege';
    end if;

    if not exists (
      select 1 from public.case_team_roles
       where case_id = new.case_id and practitioner_id = auth.uid()
         and team_role = 'lead' and ended_at is null
    ) then
      raise exception 'case-taking: only the active Lead Responsible Practitioner may start a consultation'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  -- Everything below concerns sign-off only. An edit that does not touch the
  -- signature is not a signing act.
  if new.signed_off_at is null
     or (tg_op = 'UPDATE' and new.signed_off_at is not distinct from old.signed_off_at
                          and new.signed_off_by is not distinct from old.signed_off_by) then
    return new;
  end if;

  if new.signed_off_by is distinct from auth.uid() then
    raise exception 'case-taking sign-off: a session may only be signed by the practitioner performing the action'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.case_team_roles
     where case_id = new.case_id and practitioner_id = auth.uid()
       and team_role = 'lead' and ended_at is null
  ) then
    raise exception 'case-taking sign-off: caller is not the active Lead Responsible Practitioner for this case'
      using errcode = 'insufficient_privilege';
  end if;

  select e.eligible into v_eligible
    from public.practitioner_eligibility(auth.uid(), 'lead') e;
  if v_eligible is not true then
    raise exception 'case-taking sign-off: Lead no longer passes assignment eligibility'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end $function$;

CREATE TRIGGER trg_case_taking_authority
  BEFORE INSERT OR UPDATE ON public.case_taking_sessions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_case_taking_authority();

-- E.2 A signed session is immutable. Mirrors
-- enforce_signed_protocol_immutability() and forbid_signed_protocol_delete().
CREATE OR REPLACE FUNCTION public.freeze_signed_case_taking()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  if tg_op = 'DELETE' then
    if old.signed_off_at is not null then
      raise exception 'case-taking: a signed session is part of the clinical record and cannot be deleted'
        using errcode = 'check_violation';
    end if;
    return old;
  end if;

  if old.signed_off_at is not null then
    raise exception 'case-taking: this session is signed and cannot be changed — create an amendment version instead'
      using errcode = 'check_violation';
  end if;

  return new;
end $function$;

CREATE TRIGGER trg_freeze_signed_case_taking
  BEFORE UPDATE OR DELETE ON public.case_taking_sessions
  FOR EACH ROW EXECUTE FUNCTION public.freeze_signed_case_taking();

-- E.3 Answers belonging to a signed session are frozen too. Without this the
-- session row would be immutable while its content stayed editable, which
-- would make the signature meaningless.
CREATE OR REPLACE FUNCTION public.freeze_signed_case_taking_answers()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
declare
  v_signed timestamptz;
begin
  select signed_off_at into v_signed
    from public.case_taking_sessions
   where id = case when tg_op = 'DELETE' then old.session_id else new.session_id end;

  if v_signed is not null then
    raise exception 'case-taking: this session is signed and its answers cannot be changed — create an amendment version instead'
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $function$;

CREATE TRIGGER trg_freeze_signed_case_taking_answers
  BEFORE INSERT OR UPDATE OR DELETE ON public.case_taking_answers
  FOR EACH ROW EXECUTE FUNCTION public.freeze_signed_case_taking_answers();

-- E.4 Optimistic concurrency. The server sends the revision it read; the
-- WHERE clause does the rejecting (zero rows updated = stale). This trigger
-- only guarantees the counter advances monotonically and cannot be forged,
-- so a client cannot pin a revision and win every race.
CREATE OR REPLACE FUNCTION public.bump_case_taking_revision()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
begin
  new.revision   := old.revision + 1;
  new.updated_at := now();
  return new;
end $function$;

CREATE TRIGGER trg_bump_case_taking_session_revision
  BEFORE UPDATE ON public.case_taking_sessions
  FOR EACH ROW EXECUTE FUNCTION public.bump_case_taking_revision();

CREATE TRIGGER trg_bump_case_taking_answer_revision
  BEFORE UPDATE ON public.case_taking_answers
  FOR EACH ROW EXECUTE FUNCTION public.bump_case_taking_revision();

-- ─── F. case_contributions extension ─────────────────────────────────────────
-- Extending the existing append-only audit record rather than creating a
-- second audit system. All three columns are nullable, so every existing row
-- and every non-case-taking contribution is unaffected.

ALTER TABLE public.case_contributions
  ADD COLUMN session_id  uuid NULL REFERENCES public.case_taking_sessions(id),
  ADD COLUMN entry_id    uuid NULL,
  ADD COLUMN question_id text NULL;

COMMENT ON COLUMN public.case_contributions.entry_id IS
  'The case_taking_answers entry this contribution concerns. The only identifier an '
  'observation has, since an observation carries no question_id.';
COMMENT ON COLUMN public.case_contributions.question_id IS
  'Canonical question identity. Survives amendment: a new session version mints new '
  'entry_ids, so entry_id alone cannot show a question history across versions.';
COMMENT ON COLUMN public.case_contributions.session_id IS
  'Denormalised: derivable via entry_id. Kept on Orchestrator decision so that '
  '"everything that changed in this consultation version" is one indexed read.';

-- "History · n changes" for one entry, newest first.
CREATE INDEX case_contributions_entry_history_idx
  ON public.case_contributions (entry_id, created_at DESC)
  WHERE entry_id IS NOT NULL;

-- The same question's history across versions and consultations.
CREATE INDEX case_contributions_case_question_idx
  ON public.case_contributions (case_id, question_id, created_at DESC)
  WHERE question_id IS NOT NULL;

-- ─── G. Widen block_contribution_rewrite() ───────────────────────────────────
-- THE ONLY CHANGE TO ANYTHING ALREADY LIVE.
--
-- Additive and strictly stricter: the three new columns join the five already
-- frozen. Nothing else about the function changes — same name, same signature,
-- same error message, same errcode, no SECURITY DEFINER added (it does not
-- have it today and does not need it).
--
-- Without this the linkage columns would be the one mutable part of an
-- append-only audit row, so a contribution could be silently re-pointed at a
-- different question after the fact.
CREATE OR REPLACE FUNCTION public.block_contribution_rewrite()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.author_id IS DISTINCT FROM OLD.author_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     -- 0066: the case-taking linkage is part of the append-only record.
     OR NEW.session_id IS DISTINCT FROM OLD.session_id
     OR NEW.entry_id IS DISTINCT FROM OLD.entry_id
     OR NEW.question_id IS DISTINCT FROM OLD.question_id THEN
    RAISE EXCEPTION 'contributions are append-only: record a new contribution instead of rewriting'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;

COMMIT;
