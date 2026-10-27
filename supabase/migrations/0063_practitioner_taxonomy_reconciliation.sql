-- ─── 0063_practitioner_taxonomy_reconciliation.sql ──────────────────────────
--
-- NOT YET APPLIED at the time of writing. Do not trust this line — ask the
-- database (see README rule 2).
--
-- WHY 0063
--
-- Cross-branch inventory of all 49 branches plus the live history, 27 Oct 2026:
-- live head is 0060; 0061 (protocol_version_items) lives only on
-- feat/protocol-adoption-signing and 0062 (case_events_client_authorship) only
-- on feat/care-path-foundations, both written and unapplied. 0063 was free
-- everywhere and is now reserved globally for this migration. The next new
-- migration takes 0064 or higher, after another all-branch inventory — this
-- folder already contains one collision (two different 0059 files) and that is
-- the failure the inventory exists to prevent.
--
-- 0061, 0062 and 0063 are mutually independent and may be applied in any order.
--
-- WHAT THIS DOES
--
-- Reconciles the database to the locked governance taxonomy:
--
--   regulated_clinician   -> regulated_healthcare_professional  (Category 1)
--   voluntary_registered  -> accredited_practitioner            (Category 2)
--   unregistered          -> ni_verified_practitioner           (Category 3)
--
-- This is a RENAME, not a governance-policy change. Every eligibility rule,
-- registration requirement and Lead restriction keeps exactly the behaviour it
-- has today. The mapping is not inferred: the live function bodies already
-- state it — enforce_case_team_role_rules raises "an NI Verified Practitioner
-- (Category 3)" on the value 'unregistered'.
--
-- STUDENTS ARE UNTOUCHED. A student is case_team_roles.team_role = 'student',
-- never a practitioner category, and the supervision rules in
-- enforce_case_team_role_rules are reproduced below character for character.
--
-- ── WHAT IS AND IS NOT CHANGED ──────────────────────────────────────────────
--
-- Two CHECK constraints carry the value set:
--   practitioners_category_check
--   practitioner_agreements_category_check
--
-- Seven functions reference the category COLUMN. Only THREE contain taxonomy
-- LITERALS and are replaced here:
--   practitioner_assignment_eligibility      IN ('regulated_clinician','voluntary_registered')
--   enforce_case_team_role_rules             = 'unregistered'
--   enforce_practitioner_class_vs_lead_role  is distinct from 'unregistered'
--
-- The other four — accept_current_agreement, enforce_agreement_immutability,
-- has_accepted_current_agreement, practitioner_has_current_acceptance — join or
-- compare the column (p.category = a.category) and never name a value. They are
-- value-agnostic and correct after the rename. Rewriting them identically would
-- add transcription risk for no behavioural gain, so they are deliberately left
-- alone. Each was read in full to confirm this, not assumed from a name match.
--
-- No RLS policy references category. No generated type does either:
-- packages/db/src/types.ts types the column as plain text, with no union.
--
-- The three replaced bodies are byte-identical to the live ones under pure
-- literal substitution -- verified, not asserted. After applying this, the
-- hashes below must come back unchanged, which proves the three literals are
-- the only difference: no reordering, no reworded error, no dropped branch:
--
--   select p.proname, md5(p.prosrc), length(p.prosrc)
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.proname in ('practitioner_assignment_eligibility',
--                        'enforce_case_team_role_rules',
--                        'enforce_practitioner_class_vs_lead_role');
--
--   practitioner_assignment_eligibility      4fd356e50abe3f5f985fc8f52b6e477d  2112
--   enforce_case_team_role_rules             1b2c04c9993a361764dadda9ed079096  1358
--   enforce_practitioner_class_vs_lead_role  5ea04c00dffc5be004f79bc52624095c   818
--
-- The same check runs in packages/db/src/practitioners/taxonomy0063.db.test.ts.

begin;

-- ── 1. Drop the old CHECKs first ────────────────────────────────────────────
--
-- Order matters. The translation below writes the NEW values, which the OLD
-- constraints reject — so the constraints come off before the data moves and
-- the new ones go on after. Everything is inside one transaction, so no other
-- session ever observes the table unconstrained.

alter table public.practitioners
  drop constraint if exists practitioners_category_check;
alter table public.practitioner_agreements
  drop constraint if exists practitioner_agreements_category_check;

-- ── 2. Translate any existing values ────────────────────────────────────────
--
-- Production holds 5 practitioner rows with category NULL and 0 agreement rows,
-- so this is a no-op there. It exists because other environments and fixtures
-- may hold the old values, and because a migration that only works against one
-- database is not a migration.

-- The class-vs-Lead guard fires BEFORE UPDATE on practitioners. Renaming a
-- value is NOT a class change, but the guard cannot tell the difference: a row
-- moving to 'ni_verified_practitioner' would look like a demotion to Category 3
-- and would be refused if that practitioner is an active Lead. Suspended for
-- the translation only, inside this transaction, and re-enabled below.
alter table public.practitioners disable trigger trg_practitioner_class_vs_lead_role;

update public.practitioners
   set category = case category
         when 'regulated_clinician'  then 'regulated_healthcare_professional'
         when 'voluntary_registered' then 'accredited_practitioner'
         when 'unregistered'         then 'ni_verified_practitioner'
         else category
       end
 where category is not null;

alter table public.practitioners enable trigger trg_practitioner_class_vs_lead_role;

update public.practitioner_agreements
   set category = case category
         when 'regulated_clinician'  then 'regulated_healthcare_professional'
         when 'voluntary_registered' then 'accredited_practitioner'
         when 'unregistered'         then 'ni_verified_practitioner'
         else category
       end
 where category is not null;

-- ── 3. Refuse anything unexpected, loudly ───────────────────────────────────
--
-- The `else category` above deliberately passes unknown values through rather
-- than nulling them: silently discarding a category would destroy a governance
-- fact. Instead the migration stops here and names what it found, so a human
-- decides. Adding the new CHECK would also fail, but with a constraint error
-- that does not say which value or which table.
do $$
declare v_bad text;
begin
  select string_agg(distinct category, ', ')
    into v_bad
    from public.practitioners
   where category is not null
     and category not in ('regulated_healthcare_professional','accredited_practitioner','ni_verified_practitioner');
  if v_bad is not null then
    raise exception
      '0063: practitioners.category holds unrecognised value(s): %. Map them explicitly before applying.', v_bad
      using errcode = 'check_violation';
  end if;

  select string_agg(distinct category, ', ')
    into v_bad
    from public.practitioner_agreements
   where category is not null
     and category not in ('regulated_healthcare_professional','accredited_practitioner','ni_verified_practitioner');
  if v_bad is not null then
    raise exception
      '0063: practitioner_agreements.category holds unrecognised value(s): %. Map them explicitly before applying.', v_bad
      using errcode = 'check_violation';
  end if;
end $$;

-- ── 4. Apply the new CHECK constraints ──────────────────────────────────────

alter table public.practitioners
  add constraint practitioners_category_check
  check (category = any (array[
    'regulated_healthcare_professional'::text,  -- Category 1
    'accredited_practitioner'::text,            -- Category 2 (PSA)
    'ni_verified_practitioner'::text            -- Category 3
  ]));

alter table public.practitioner_agreements
  add constraint practitioner_agreements_category_check
  check (category = any (array[
    'regulated_healthcare_professional'::text,
    'accredited_practitioner'::text,
    'ni_verified_practitioner'::text
  ]));

comment on column public.practitioners.category is
  'NI governance category. regulated_healthcare_professional = Category 1; '
  'accredited_practitioner = Category 2 (PSA); ni_verified_practitioner = Category 3. '
  'A student is NOT a category — see case_team_roles.team_role.';

-- ── 5. The three functions that name values ─────────────────────────────────
--
-- Reproduced from the live definitions with ONLY the literals changed. Every
-- other line, including the student supervision block and all error wording, is
-- unchanged.

-- 5a. Eligibility. The registration requirement applies to Categories 1 and 2,
--     exactly as before — this is the single line where a careless rename would
--     silently move the requirement onto Category 3.
create or replace function public.practitioner_assignment_eligibility(p_practitioner_id uuid)
 returns table(eligible boolean, reasons text[])
 language plpgsql
 stable security definer
 set search_path to 'public', 'extensions'
as $function$
DECLARE
  pr RECORD;
  r  TEXT[] := '{}';
BEGIN
  SELECT * INTO pr FROM public.practitioners WHERE id = p_practitioner_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, ARRAY['practitioner_not_found']; RETURN;
  END IF;

  -- Lifecycle: only an approved, ACTIVE practitioner is assignable.
  IF pr.status <> 'active' OR pr.is_active IS NOT TRUE THEN
    r := array_append(r, 'practitioner_not_active');
  END IF;

  -- Class must be determined (never inferred from modality).
  IF pr.category IS NULL THEN
    r := array_append(r, 'practitioner_class_not_set');
  END IF;

  -- Current class agreement accepted (id + version + exact-text hash).
  IF pr.category IS NOT NULL
     AND NOT public.practitioner_has_current_acceptance(p_practitioner_id) THEN
    r := array_append(r, 'no_current_agreement_acceptance');
  END IF;

  -- Credential set admin-verified (capture alone never counts).
  IF pr.credentials_verification_status IS DISTINCT FROM 'verified' THEN
    r := array_append(r, 'credentials_not_verified');
  END IF;

  -- HARD control: required indemnity must exist and be in date.
  IF pr.indemnity_required IS NOT FALSE THEN
    IF pr.insurance_expiry IS NULL THEN
      r := array_append(r, 'indemnity_missing');
    ELSIF pr.insurance_expiry < CURRENT_DATE THEN
      r := array_append(r, 'indemnity_expired');
    END IF;
  END IF;

  -- Registered classes must hold a current registration.
  IF pr.category IN ('regulated_healthcare_professional','accredited_practitioner') THEN
    IF pr.registration_number IS NULL OR pr.registration_body IS NULL
       OR pr.registration_status IS DISTINCT FROM 'registered' THEN
      r := array_append(r, 'registration_not_current');
    END IF;
  END IF;

  -- DBS: outstanding or flagged blocks; 'clear' or 'not_required' passes.
  IF pr.dbs_status IN ('required','pending','flagged') THEN
    r := array_append(r, 'dbs_outstanding');
  END IF;

  -- Scope must be admin-approved.
  IF pr.scope_status IS DISTINCT FROM 'approved' THEN
    r := array_append(r, 'scope_not_approved');
  END IF;

  RETURN QUERY SELECT (cardinality(r) = 0), r;
END;
$function$;

-- 5b. Care-team rules. The Category 3 sole-Lead restriction and the student
--     supervision requirement are both preserved verbatim.
create or replace function public.enforce_case_team_role_rules()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
DECLARE
  v_category TEXT;
  v_eligible BOOLEAN;
  v_reasons  TEXT[];
BEGIN
  IF NEW.ended_at IS NOT NULL THEN RETURN NEW; END IF; -- ending is always allowed

  SELECT e.eligible, e.reasons INTO v_eligible, v_reasons
    FROM public.practitioner_assignment_eligibility(NEW.practitioner_id) e;
  IF v_eligible IS NOT TRUE THEN
    RAISE EXCEPTION 'care team: practitioner not assignable: %', array_to_string(v_reasons, ', ')
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.team_role = 'lead' THEN
    SELECT category INTO v_category FROM public.practitioners WHERE id = NEW.practitioner_id;
    IF v_category = 'ni_verified_practitioner' THEN
      RAISE EXCEPTION 'care team: an NI Verified Practitioner (Category 3) cannot be the sole Lead Responsible Practitioner'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.team_role = 'student' THEN
    IF NEW.supervisor_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.case_team_roles s
       WHERE s.case_id = NEW.case_id
         AND s.practitioner_id = NEW.supervisor_id
         AND s.team_role <> 'student'
         AND s.ended_at IS NULL
    ) THEN
      RAISE EXCEPTION 'care team: a Student Practitioner requires a named supervisor holding an active role on the same case'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 5c. Demotion guard: refuses moving a practitioner to Category 3 while they
--     hold an active Lead role.
--     The closing dollar-quote shares the final line on purpose: the live body
--     ends "end " with no trailing newline, and matching that exactly keeps the
--     stored body byte-identical to the live one under literal substitution.
create or replace function public.enforce_practitioner_class_vs_lead_role()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_cases text;
begin
  -- Only act when the class actually changes to the Category 3 value.
  if new.category is not distinct from old.category then
    return new;
  end if;
  if new.category is distinct from 'ni_verified_practitioner' then
    return new;
  end if;

  select string_agg(distinct r.case_id::text, ', ')
    into v_cases
    from public.case_team_roles r
   where r.practitioner_id = new.id
     and r.team_role = 'lead'
     and r.ended_at is null;

  if v_cases is not null then
    raise exception
      'practitioner class: cannot set class to NI Verified Practitioner (Category 3) while this practitioner is the active Lead Responsible Practitioner on case(s) %. End or reassign the Lead role first.',
      v_cases
      using errcode = 'check_violation';
  end if;

  return new;
end $function$;

commit;

-- ── NOT DONE HERE, AND WHY ──────────────────────────────────────────────────
--
-- · The practitioner agreement TITLES and BODIES still use the older
--   descriptive language ("Unregistered Practitioners", "Voluntarily Registered
--   Practitioners"). Those are approved legal wording, and
--   practitioner_has_current_acceptance checks an exact-text hash — editing them
--   is a wording change that requires an AGREEMENT_VERSION bump and
--   re-acceptance by every practitioner. Out of scope for a value rename, and a
--   Founder/legal decision. Zero agreement rows exist today, so nothing is
--   invalidated either way.
--
-- · Historical migration files keep the old values. Migration history is a
--   record of what was applied and is never rewritten.
