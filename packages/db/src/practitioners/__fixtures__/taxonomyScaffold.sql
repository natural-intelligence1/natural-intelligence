-- Stand-ins for the live structures migration 0063 touches.
--
-- Taken from the production catalogue: both CHECK constraints in their PRE-0063
-- form, the three functions that carry taxonomy literals, and the two triggers
-- that invoke them. 0063 is then executed against this, so the tests exercise
-- the real migration rather than a paraphrase of it.
--
-- The three function bodies here are faithful in logic and wording but NOT
-- byte-identical to live: some of the live in-body comments are condensed.
-- Byte-identity of what 0063 INSTALLS against what Production holds is asserted
-- separately, against recorded hashes -- see taxonomy0063.db.test.ts,
-- "is a pure rename of the live function bodies".
--
-- auth.uid() is stubbed over a GUC. Of the four value-agnostic agreement
-- functions, only enforce_agreement_immutability is reproduced: 0063 does not
-- replace it, but 0063 DOES update practitioner_agreements.category, which that
-- trigger refuses. Leaving it out of this scaffold is what hid exactly that
-- defect on the first pass. The other three are not reproduced because nothing
-- in 0063 either replaces them or trips them.

create schema if not exists auth;
create schema if not exists extensions;

create or replace function auth.uid() returns uuid language plpgsql stable as $$
begin
  return nullif(current_setting('test.auth_uid', true), '')::uuid;
exception when others then return null;
end $$;

create table practitioners (
  id uuid primary key default gen_random_uuid(),
  display_name text,
  category text,
  status text not null default 'active',
  is_active boolean not null default true,
  credentials_verification_status text not null default 'unverified',
  indemnity_required boolean not null default true,
  insurance_expiry date,
  registration_number text,
  registration_body text,
  registration_status text,
  dbs_status text not null default 'not_required',
  scope_status text not null default 'pending',
  constraint practitioners_category_check
    check (category = any (array['regulated_clinician'::text, 'voluntary_registered'::text, 'unregistered'::text]))
);

create table practitioner_agreements (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  version text not null,
  title text not null default 't',
  body text not null default 'b',
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  constraint practitioner_agreements_category_check
    check (category = any (array['regulated_clinician'::text, 'voluntary_registered'::text, 'unregistered'::text]))
);

create table client_cases (
  id uuid primary key default gen_random_uuid()
);

create table case_team_roles (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references client_cases(id) on delete cascade,
  practitioner_id uuid not null references practitioners(id) on delete cascade,
  team_role text not null check (team_role = any (array['lead'::text,'care_team'::text,'student'::text])),
  supervisor_id uuid references practitioners(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Acceptance is stubbed to TRUE: 0063 does not change it, and leaving the real
-- hash check in would make every eligibility test depend on digest plumbing
-- that is not under test here.
create or replace function public.practitioner_has_current_acceptance(p_practitioner_id uuid)
returns boolean language sql stable as $$ select true $$;

-- ── Pre-0063 definitions, verbatim from the live catalogue ──────────────────

create or replace function public.practitioner_assignment_eligibility(p_practitioner_id uuid)
 returns table(eligible boolean, reasons text[])
 language plpgsql stable security definer set search_path to 'public'
as $function$
DECLARE
  pr RECORD;
  r  TEXT[] := '{}';
BEGIN
  SELECT * INTO pr FROM public.practitioners WHERE id = p_practitioner_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, ARRAY['practitioner_not_found']; RETURN;
  END IF;
  IF pr.status <> 'active' OR pr.is_active IS NOT TRUE THEN
    r := array_append(r, 'practitioner_not_active');
  END IF;
  IF pr.category IS NULL THEN
    r := array_append(r, 'practitioner_class_not_set');
  END IF;
  IF pr.category IS NOT NULL
     AND NOT public.practitioner_has_current_acceptance(p_practitioner_id) THEN
    r := array_append(r, 'no_current_agreement_acceptance');
  END IF;
  IF pr.credentials_verification_status IS DISTINCT FROM 'verified' THEN
    r := array_append(r, 'credentials_not_verified');
  END IF;
  IF pr.indemnity_required IS NOT FALSE THEN
    IF pr.insurance_expiry IS NULL THEN
      r := array_append(r, 'indemnity_missing');
    ELSIF pr.insurance_expiry < CURRENT_DATE THEN
      r := array_append(r, 'indemnity_expired');
    END IF;
  END IF;
  IF pr.category IN ('regulated_clinician','voluntary_registered') THEN
    IF pr.registration_number IS NULL OR pr.registration_body IS NULL
       OR pr.registration_status IS DISTINCT FROM 'registered' THEN
      r := array_append(r, 'registration_not_current');
    END IF;
  END IF;
  IF pr.dbs_status IN ('required','pending','flagged') THEN
    r := array_append(r, 'dbs_outstanding');
  END IF;
  IF pr.scope_status IS DISTINCT FROM 'approved' THEN
    r := array_append(r, 'scope_not_approved');
  END IF;
  RETURN QUERY SELECT (cardinality(r) = 0), r;
END;
$function$;

create or replace function public.enforce_case_team_role_rules()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
DECLARE
  v_category TEXT;
  v_eligible BOOLEAN;
  v_reasons  TEXT[];
BEGIN
  IF NEW.ended_at IS NOT NULL THEN RETURN NEW; END IF;
  SELECT e.eligible, e.reasons INTO v_eligible, v_reasons
    FROM public.practitioner_assignment_eligibility(NEW.practitioner_id) e;
  IF v_eligible IS NOT TRUE THEN
    RAISE EXCEPTION 'care team: practitioner not assignable: %', array_to_string(v_reasons, ', ')
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.team_role = 'lead' THEN
    SELECT category INTO v_category FROM public.practitioners WHERE id = NEW.practitioner_id;
    IF v_category = 'unregistered' THEN
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

create or replace function public.enforce_practitioner_class_vs_lead_role()
 returns trigger language plpgsql security definer set search_path to 'public'
as $function$
declare
  v_cases text;
begin
  if new.category is not distinct from old.category then return new; end if;
  if new.category is distinct from 'unregistered' then return new; end if;
  select string_agg(distinct r.case_id::text, ', ')
    into v_cases
    from public.case_team_roles r
   where r.practitioner_id = new.id and r.team_role = 'lead' and r.ended_at is null;
  if v_cases is not null then
    raise exception
      'practitioner class: cannot set class to NI Verified Practitioner (Category 3) while this practitioner is the active Lead Responsible Practitioner on case(s) %. End or reassign the Lead role first.',
      v_cases using errcode = 'check_violation';
  end if;
  return new;
end
$function$;

create trigger trg_case_team_role_rules before insert or update on public.case_team_roles
  for each row execute function public.enforce_case_team_role_rules();
create trigger trg_practitioner_class_vs_lead_role before update on public.practitioners
  for each row execute function public.enforce_practitioner_class_vs_lead_role();

-- Agreement immutability, verbatim from the live catalogue. Refuses any change
-- to category/version/title/body/created_at for every role, which is why 0063
-- must suspend it around the translation.
create or replace function public.enforce_agreement_immutability()
 returns trigger language plpgsql
as $function$
BEGIN
  IF NEW.category   IS DISTINCT FROM OLD.category
     OR NEW.version    IS DISTINCT FROM OLD.version
     OR NEW.title      IS DISTINCT FROM OLD.title
     OR NEW.body       IS DISTINCT FROM OLD.body
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'practitioner_agreements rows are immutable (only is_current may change); publish changed wording as a NEW version row'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

create trigger trg_practitioner_agreements_immutable before update on public.practitioner_agreements
  for each row execute function public.enforce_agreement_immutability();
