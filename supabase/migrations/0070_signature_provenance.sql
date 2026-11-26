-- ─── 0070_signature_provenance.sql ──────────────────────────────────────────
-- Admin Cockpit WP1. Records the truth about every case-taking signature.
--
-- Apply ONLY after 0069, which creates public.testing_mode and
-- public.client_cases.is_test_data. The trigger below reads both.
--
-- WHY NOW, AND WHY THIS WINDOW CLOSES
--
-- WP0 found case_taking_sessions holding zero rows and zero signatures, and
-- WP1 preflight re-confirmed it. So these columns can be added with no
-- historical backfill and no risk of mislabelling an existing record: there
-- are none. The moment the first session is signed that window shuts for good,
-- because a signed row is frozen and its provenance could then only be guessed
-- at. Hence this lands before any authority work, not after.
--
-- NULL MEANS UNSIGNED, NOT UNKNOWN
--
-- All four columns are nullable, and a CHECK ties them to signed_off_at: all
-- four are NULL on a draft and all four are present once signed. A draft
-- carries no provenance because no signature has happened yet. No column has a
-- default, because a constant default would be a claim about a signature that
-- nothing had checked — false is as much a lie as true if nobody looked.
--
-- No BEGIN/COMMIT envelope: the migration tool supplies its own transaction.

alter table public.case_taking_sessions
  add column if not exists override_active_at_signing boolean,
  add column if not exists override_used_at_signing   boolean,
  add column if not exists is_test_output             boolean,
  add column if not exists effective_role             text;

comment on column public.case_taking_sessions.override_active_at_signing is
  'Was the master testing switch on at the instant of signing. Recorded even when the signature did not rely on it.';
comment on column public.case_taking_sessions.override_used_at_signing is
  'Did this signature actually depend on override authority. Deliberately distinct from override_active_at_signing: the switch may be on while a genuinely eligible practitioner signs, and conflating the two would taint a clean signature.';
comment on column public.case_taking_sessions.is_test_output is
  'Is this signed output non-clinical. Derived from the case designation at signing time and frozen with the row.';
comment on column public.case_taking_sessions.effective_role is
  'The case-team role the signature was actually taken under, read from case_team_roles at signing time. Never an invented or assumed role.';

-- ─── THE INVARIANTS ─────────────────────────────────────────────────────────

-- 1. Provenance exists exactly when a signature exists. This is what
--    accommodates unsigned drafts without allowing a signature to carry
--    partial provenance.
alter table public.case_taking_sessions
  drop constraint if exists case_taking_provenance_complete;
alter table public.case_taking_sessions
  add constraint case_taking_provenance_complete check (
        (signed_off_at is null) = (override_active_at_signing is null)
    and (signed_off_at is null) = (override_used_at_signing   is null)
    and (signed_off_at is null) = (is_test_output             is null)
    and (signed_off_at is null) = (effective_role             is null)
  );

-- 2. An override-assisted signature can NEVER be recorded as clinical output.
--    This is the structural half of "test-signed records stay permanently
--    distinguishable": it is not a filter anyone has to remember to apply.
alter table public.case_taking_sessions
  drop constraint if exists case_taking_override_implies_test;
alter table public.case_taking_sessions
  add constraint case_taking_override_implies_test check (
    coalesce(override_used_at_signing, false) = false
    or coalesce(is_test_output, false) = true
  );

-- 3. Authority cannot have been borrowed from a switch that was off.
alter table public.case_taking_sessions
  drop constraint if exists case_taking_override_used_requires_active;
alter table public.case_taking_sessions
  add constraint case_taking_override_used_requires_active check (
    coalesce(override_used_at_signing, false) = false
    or coalesce(override_active_at_signing, false) = true
  );

-- 4. Only the three canonical case roles. No invented signing roles.
alter table public.case_taking_sessions
  drop constraint if exists case_taking_effective_role_valid;
alter table public.case_taking_sessions
  add constraint case_taking_effective_role_valid check (
    effective_role is null
    or effective_role in ('lead', 'care_team', 'student')
  );

-- ─── PROVENANCE IS RECORDED BY THE DATABASE, NOT BY THE CALLER ──────────────
-- The writing code never supplies these values. If it did, the record would
-- say whatever the writer claimed, and a second writer could claim something
-- else. The trigger derives all four from the database's own state in the same
-- statement that creates the signature, so there is no window in which a
-- signature exists without truthful provenance.
--
-- This also means the existing signing path keeps working untouched:
-- signOffCaseTakingSession() still issues its one conditional UPDATE setting
-- state, signed_off_by and signed_off_at, with the signed_off_at IS NULL guard
-- and the revision compare-and-set intact. It simply does not mention
-- provenance, and does not need to.
--
-- WP2 replaces override_used_at_signing with the value its authority decision
-- actually produced, inside the same locked transaction. Until then no
-- override mechanism exists, so false is the truth rather than an assumption.

create or replace function public.set_case_taking_signature_provenance()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_switch  boolean;
  v_is_test boolean;
  v_role    text;
begin
  -- A draft carries no provenance. Nothing to record yet.
  if new.signed_off_at is null then
    return new;
  end if;

  -- Already signed before this statement began. freeze_signed_case_taking
  -- refuses the change in any case; returning early guarantees that recorded
  -- provenance is never rewritten, which is the point of recording it.
  if tg_op = 'UPDATE' and old.signed_off_at is not null then
    return new;
  end if;

  select t.enabled into v_switch from public.testing_mode t;
  new.override_active_at_signing := coalesce(v_switch, false);

  new.override_used_at_signing := false;

  select c.is_test_data into v_is_test
    from public.client_cases c
   where c.id = new.case_id;
  -- An unknown designation is treated as test output. The safe direction is to
  -- under-claim: never assert that something is genuine clinical data because
  -- a row could not be found.
  new.is_test_output := coalesce(v_is_test, true);

  select r.team_role into v_role
    from public.case_team_roles r
   where r.case_id         = new.case_id
     and r.practitioner_id = new.signed_off_by
     and r.ended_at is null
   limit 1;

  -- Refusing here cannot block any signature that passes today's gates: both
  -- authoriseCaseTakingSignOff() and enforce_case_taking_authority() already
  -- require the signer to hold an active Lead role on this case. It closes the
  -- one remaining way to create a signature with no honest role to record —
  -- including an already-signed row inserted directly — rather than writing a
  -- guess into the clinical record.
  if v_role is null then
    raise exception 'case-taking sign-off: cannot record truthful provenance - the signer holds no active case-team role on this case'
      using errcode = 'insufficient_privilege';
  end if;
  new.effective_role := v_role;

  return new;
end $$;

-- BEFORE INSERT OR UPDATE. Trigger order on this table is alphabetical, which
-- puts it after trg_case_taking_authority (authority is checked first) and
-- before trg_freeze_signed_case_taking (which reads only OLD, so it is
-- unaffected by what this sets on NEW).
drop trigger if exists trg_case_taking_signature_provenance on public.case_taking_sessions;
create trigger trg_case_taking_signature_provenance
  before insert or update on public.case_taking_sessions
  for each row execute function public.set_case_taking_signature_provenance();
