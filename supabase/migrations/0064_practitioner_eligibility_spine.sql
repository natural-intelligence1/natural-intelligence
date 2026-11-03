-- ─── 0064_practitioner_eligibility_spine.sql ────────────────────────────────
--
-- NOT YET APPLIED at the time of writing. Do not trust this line — ask the
-- database (see README rule 2).
--
-- WHY 0064
--
-- Re-inventory of every migration-bearing branch, local and remote, 3 Nov 2026:
-- 0061 (protocol_version_items) lives only on feat/protocol-adoption-signing
-- and 0062 (case_events_client_authorship) only on feat/care-path-foundations,
-- both written and unapplied. 0063 is applied and closed. Nothing numbered
-- 0064 or higher exists anywhere. 0064 is therefore reserved for this work.
--
-- WHAT THIS DOES
--
-- Turns practitioner eligibility from an admin opinion into a COMPUTED FACT.
--
-- Today eligibility reads flat columns on `practitioners`: a free-text
-- credentials blob, an insurance expiry with NO COVER AMOUNT ANYWHERE, and a
-- single scope status. The locked indemnity floors (£4m student, £6m
-- qualified) cannot be evaluated at all, because the sum insured is not
-- recorded. This migration adds the structured evidence those rules need, and
-- one authority that reads it.
--
-- ── WHAT IS AND IS NOT CHANGED ──────────────────────────────────────────────
--
-- ADDED: four tables (credentials, indemnity, scope, indemnity_requirements)
-- and one canonical function, public.practitioner_eligibility(uuid, text).
--
-- REPLACED: public.practitioner_assignment_eligibility(uuid) becomes a THIN
-- COMPATIBILITY WRAPPER over the canonical function. It keeps its exact
-- signature and return shape so all six existing database callers, and the
-- unapplied 0061 on feat/protocol-adoption-signing, keep working and pick up
-- the new semantics automatically. It contains NO rules of its own.
--
-- NOT CHANGED: the flat columns on `practitioners` stay exactly where they
-- are. Nothing is dropped, nothing is backfilled here. Until evidence rows
-- exist, the new authority denies — which is the intended direction.
--
-- NOT CHANGED: 0063's taxonomy, the Category 3 sole-Lead rule, the DBS gate,
-- and the current-agreement-acceptance gate. All three are carried forward.
--
-- ── FAIL-CLOSED POSTURE ─────────────────────────────────────────────────────
--
-- There is no COALESCE(..., true) in this file, no exception handler that
-- yields eligible, and no default role grant. Absent evidence is a blocker,
-- never a pass. Expiry is evaluated against CURRENT_DATE at query time, so a
-- policy lapses because the date changed — no cron, no cached boolean, no
-- manual lapse step.

begin;

-- ── 1. Credentials — one row per credential ─────────────────────────────────

create table if not exists public.practitioner_credentials (
  id                  uuid primary key default gen_random_uuid(),
  practitioner_id     uuid not null references public.practitioners(id) on delete restrict,

  credential_type     text not null,
  issuing_body        text not null,
  -- Deterministic join key for indemnity_requirements. Display names drift;
  -- this does not. Lower-case, no spaces, e.g. 'gmc', 'cnhc', 'bant'.
  issuing_body_key    text not null,
  reference_number    text,
  -- OPAQUE STORAGE KEY (e.g. a Supabase Storage path). Never a public URL.
  evidence_reference  text,

  verification_status text not null default 'unverified',
  verified_by         uuid references public.profiles(id),
  verified_at         timestamptz,

  issued_at           date,
  expires_at          date,
  jurisdiction        text,
  -- Public register entry, for the human verifier. Not used by eligibility.
  registration_url    text,

  -- External standing, where the credential sits on a renewable register.
  -- A qualification with no register uses 'not_applicable'.
  standing_status     text not null default 'not_applicable',

  superseded_at       timestamptz,
  revoked_at          timestamptz,
  notes               text,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  is_test_data        boolean not null default false,

  constraint practitioner_credentials_type_check check (credential_type = any (array[
    'statutory_registration',   -- Category 1 evidence (GMC/NMC/HCPC and similar)
    'accredited_register',      -- Category 2 evidence (PSA-accredited register)
    'professional_body',        -- membership that may carry its own indemnity floor
    'qualification',            -- awarded qualification, no renewable register
    'student_enrolment'         -- training/enrolment evidence for the student role
  ])),
  constraint practitioner_credentials_verification_check
    check (verification_status = any (array['unverified','verified','rejected'])),
  constraint practitioner_credentials_standing_check
    check (standing_status = any (array['current','lapsed','suspended','revoked','not_applicable'])),

  -- "Verified" cannot be a hollow label. A verified row must name who verified
  -- it, when, and what they looked at. Enforced here, not in the UI.
  constraint practitioner_credentials_verified_is_evidenced check (
    verification_status <> 'verified'
    or (verified_by is not null and verified_at is not null and evidence_reference is not null)
  ),

  -- revoked_at is the authoritative fact; standing_status = 'revoked' is its
  -- label. They may never disagree.
  constraint practitioner_credentials_revocation_coherent
    check ((standing_status = 'revoked') = (revoked_at is not null))
);

comment on table public.practitioner_credentials is
  'One row per practitioner credential. Governance evidence: rows are superseded or revoked, never deleted. evidence_reference is an opaque storage key, never a public URL.';
comment on column public.practitioner_credentials.issuing_body_key is
  'Deterministic lower-case key joining to indemnity_requirements.source_key. Display names are not used for matching.';
comment on column public.practitioner_credentials.standing_status is
  'External standing on a renewable register. Qualifications with no register use not_applicable. revoked_at is authoritative for revocation; this column must agree with it.';

create index if not exists practitioner_credentials_live_idx
  on public.practitioner_credentials (practitioner_id, credential_type)
  where superseded_at is null and revoked_at is null;
create index if not exists practitioner_credentials_expiry_idx
  on public.practitioner_credentials (expires_at)
  where superseded_at is null and revoked_at is null;

-- ── 2. Indemnity — one row per policy ───────────────────────────────────────

create table if not exists public.practitioner_indemnity (
  id                  uuid primary key default gen_random_uuid(),
  practitioner_id     uuid not null references public.practitioners(id) on delete restrict,

  insurer             text not null,
  policy_number       text,
  -- The field the whole floor mechanism needs and the flat schema never had.
  cover_amount        numeric(14,2) not null,
  currency            char(3) not null default 'GBP',

  policy_start_date   date,
  expiry_date         date not null,
  evidence_reference  text,

  verification_status text not null default 'unverified',
  verified_by         uuid references public.profiles(id),
  verified_at         timestamptz,

  superseded_at       timestamptz,
  revoked_at          timestamptz,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  is_test_data        boolean not null default false,

  constraint practitioner_indemnity_cover_positive check (cover_amount > 0),
  -- GBP only this release. No FX conversion exists, so a non-GBP policy must
  -- never accidentally satisfy a GBP floor. The evaluator also refuses it with
  -- indemnity_currency_unsupported; this constraint stops it being stored.
  constraint practitioner_indemnity_currency_gbp check (currency = 'GBP'),
  constraint practitioner_indemnity_verification_check
    check (verification_status = any (array['unverified','verified','rejected'])),
  constraint practitioner_indemnity_verified_is_evidenced check (
    verification_status <> 'verified'
    or (verified_by is not null and verified_at is not null and evidence_reference is not null)
  )
);

comment on table public.practitioner_indemnity is
  'One row per indemnity policy. GBP only this release — no FX conversion exists. Policies are superseded or revoked, never deleted.';

create index if not exists practitioner_indemnity_live_idx
  on public.practitioner_indemnity (practitioner_id)
  where superseded_at is null and revoked_at is null;
create index if not exists practitioner_indemnity_expiry_idx
  on public.practitioner_indemnity (expiry_date)
  where superseded_at is null and revoked_at is null;

-- ── 3. Scope — versioned, one current row ───────────────────────────────────

create table if not exists public.practitioner_scope (
  id                uuid primary key default gen_random_uuid(),
  practitioner_id   uuid not null references public.practitioners(id) on delete restrict,

  approved_scope    text not null,
  -- A human-readable scope string cannot answer "may they be Lead?". This can.
  permitted_roles   text[] not null default '{}',

  status            text not null default 'pending',
  approver          uuid references public.profiles(id),
  approval_date     timestamptz,

  superseded_at     timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  is_test_data      boolean not null default false,

  constraint practitioner_scope_status_check
    check (status = any (array['pending','approved','suspended','revoked','expired'])),
  -- Constrained to the canonical case-team role set. There is no 'specialist',
  -- 'coach' or 'therapist' role in this schema.
  constraint practitioner_scope_roles_canonical
    check (permitted_roles <@ array['lead','care_team','student']::text[]),
  constraint practitioner_scope_approved_is_evidenced check (
    status <> 'approved' or (approver is not null and approval_date is not null)
  )
);

comment on table public.practitioner_scope is
  'Versioned approved scope. History is retained: a superseded row answers "what was their scope on the date of that consultation?". Scope has no expiry requirement, so none is invented.';

-- One current (non-superseded) scope row per practitioner. History is free to
-- accumulate behind it.
create unique index if not exists practitioner_scope_one_current_idx
  on public.practitioner_scope (practitioner_id)
  where superseded_at is null;

-- ── 4. Indemnity requirements — where the floors live ───────────────────────

create table if not exists public.indemnity_requirements (
  id                 uuid primary key default gen_random_uuid(),
  requirement_source text not null,
  -- Matches either a canonical role name (for ni_role_floor) or a credential's
  -- issuing_body_key. Deterministic, never a display name.
  source_key         text not null,
  minimum_cover      numeric(14,2) not null,
  currency           char(3) not null default 'GBP',
  effective_from     date not null default current_date,
  effective_to       date,
  note               text,
  -- Where the figure came from. A floor without a source is not governance.
  source_reference   text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint indemnity_requirements_source_check check (requirement_source = any (array[
    'ni_role_floor', 'regulator', 'accredited_register', 'professional_body'
  ])),
  constraint indemnity_requirements_cover_positive check (minimum_cover > 0),
  constraint indemnity_requirements_currency_gbp check (currency = 'GBP'),
  constraint indemnity_requirements_period_sane
    check (effective_to is null or effective_to >= effective_from),
  constraint indemnity_requirements_unique_period
    unique (requirement_source, source_key, effective_from)
);

comment on table public.indemnity_requirements is
  'Configured indemnity minimums. ni_role_floor rows carry the Founder-locked NI floors. regulator / accredited_register / professional_body rows carry external minimums, matched by a credential''s issuing_body_key. An applicable external body with NO configured row makes the practitioner NOT eligible (indemnity_requirement_unknown) — the NI floor is never silently assumed to be enough.';

-- Founder-locked NI role floors, 3 Nov 2026. These are the only figures in
-- this file: no regulator, register or professional-body minimum is invented.
insert into public.indemnity_requirements
  (requirement_source, source_key, minimum_cover, note, source_reference)
values
  ('ni_role_floor', 'student',   4000000.00, 'Student / supervised case role',  'Founder decision, 3 Nov 2026'),
  ('ni_role_floor', 'lead',      6000000.00, 'Lead Responsible Practitioner',   'Founder decision, 3 Nov 2026'),
  ('ni_role_floor', 'care_team', 6000000.00, 'Qualified care-team practitioner','Founder decision, 3 Nov 2026')
on conflict (requirement_source, source_key, effective_from) do nothing;

-- ── 5. RLS — governance evidence is admin/service only ──────────────────────
--
-- No practitioner-facing policy is granted here. These tables are read by
-- SECURITY DEFINER eligibility and written by admin tooling; nothing in the
-- member or practitioner apps reads them directly. Default-deny is the point.

alter table public.practitioner_credentials enable row level security;
alter table public.practitioner_indemnity   enable row level security;
alter table public.practitioner_scope       enable row level security;
alter table public.indemnity_requirements   enable row level security;

create policy practitioner_credentials_service_all on public.practitioner_credentials
  for all using (auth.role() = 'service_role');
create policy practitioner_indemnity_service_all on public.practitioner_indemnity
  for all using (auth.role() = 'service_role');
create policy practitioner_scope_service_all on public.practitioner_scope
  for all using (auth.role() = 'service_role');
create policy indemnity_requirements_service_all on public.indemnity_requirements
  for all using (auth.role() = 'service_role');

create policy practitioner_credentials_admin_all on public.practitioner_credentials
  for all using (public.is_admin());
create policy practitioner_indemnity_admin_all on public.practitioner_indemnity
  for all using (public.is_admin());
create policy practitioner_scope_admin_all on public.practitioner_scope
  for all using (public.is_admin());
create policy indemnity_requirements_admin_all on public.indemnity_requirements
  for all using (public.is_admin());

-- ── 6. The canonical eligibility authority ──────────────────────────────────
--
-- ONE function. All credential, indemnity, scope, category, agreement, DBS and
-- role logic lives here and nowhere else.
--
-- p_case_role NULL  → evaluate every canonical role; eligible_roles lists the
--                     ones that pass, eligible is true when any passes, and
--                     blockers carries the reasons common to ALL roles (the
--                     base problem set) when none passes.
-- p_case_role given → evaluate that role exactly; required_cover reflects it.
--
-- EXPIRY: valid THROUGH expiry_date inclusive; expired from the following day.
-- This is what the superseded function did and what UK insurers state.

create or replace function public.practitioner_eligibility(
  p_practitioner_id uuid,
  p_case_role       text default null
)
returns table (
  eligible         boolean,
  evaluated_role   text,
  eligible_roles   text[],
  blockers         text[],
  category         text,
  required_cover   numeric,
  actual_cover     numeric,
  indemnity_expiry date,
  credential_state text,
  scope_state      text,
  agreement_state  text,
  evaluated_at     timestamptz
)
language plpgsql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
DECLARE
  ROLES    CONSTANT text[] := array['lead','care_team','student'];
  pr       RECORD;
  sc       RECORD;
  ind      RECORD;
  r        text;
  b        text[];
  ok_roles text[] := '{}';
  common   text[];
  first    boolean := true;
  v_req    numeric;
  v_ext    numeric;
  v_unknown boolean;
  v_cred_ok boolean;
  v_cred_state text := 'missing';
  v_scope_state text := 'missing';
  v_agree_state text := 'not_required';
  v_need   text;
BEGIN
  evaluated_at := now();
  evaluated_role := p_case_role;
  eligible_roles := '{}';
  blockers := '{}';

  -- A role we do not recognise is never evaluated optimistically.
  IF p_case_role IS NOT NULL AND NOT (p_case_role = ANY (ROLES)) THEN
    eligible := false;
    blockers := array['role_unknown'];
    RETURN NEXT; RETURN;
  END IF;

  SELECT * INTO pr FROM public.practitioners WHERE id = p_practitioner_id;
  IF NOT FOUND THEN
    eligible := false;
    blockers := array['practitioner_not_found'];
    RETURN NEXT; RETURN;
  END IF;
  category := pr.category;

  -- Current scope row (one per practitioner by unique index).
  SELECT * INTO sc FROM public.practitioner_scope
   WHERE practitioner_id = p_practitioner_id AND superseded_at IS NULL;
  IF NOT FOUND THEN
    v_scope_state := 'missing';
  ELSE
    v_scope_state := CASE sc.status
                       WHEN 'approved'  THEN 'ok'
                       WHEN 'suspended' THEN 'suspended'
                       WHEN 'revoked'   THEN 'revoked'
                       ELSE 'unapproved'
                     END;
  END IF;
  scope_state := v_scope_state;

  -- Best live policy: verified, not revoked/superseded, highest cover first.
  -- Expiry and currency are judged below so their blockers stay distinct.
  SELECT * INTO ind FROM public.practitioner_indemnity
   WHERE practitioner_id = p_practitioner_id
     AND superseded_at IS NULL AND revoked_at IS NULL
   ORDER BY (verification_status = 'verified') DESC,
            (expiry_date >= CURRENT_DATE) DESC,
            cover_amount DESC
   LIMIT 1;
  IF FOUND THEN
    actual_cover     := ind.cover_amount;
    indemnity_expiry := ind.expiry_date;
  END IF;

  -- Agreement acceptance is a qualified-role gate only. Student evidence does
  -- not imply a category, and no student agreement exists to require.
  IF pr.category IS NOT NULL AND public.practitioner_has_current_acceptance(p_practitioner_id) THEN
    v_agree_state := 'ok';
  ELSIF pr.category IS NOT NULL THEN
    v_agree_state := 'missing';
  END IF;
  agreement_state := v_agree_state;

  -- ── Evaluate each canonical role through one body ────────────────────────
  FOREACH r IN ARRAY ROLES LOOP
    b := '{}';

    -- Lifecycle
    IF pr.status <> 'active' OR pr.is_active IS NOT TRUE THEN
      b := array_append(b, 'practitioner_not_active');
    END IF;

    -- Safeguarding gate, carried forward unchanged from 0056.
    IF pr.dbs_status IN ('required','pending','flagged') THEN
      b := array_append(b, 'dbs_outstanding');
    END IF;

    -- Category rules. A qualified role needs a canonical category; the student
    -- role deliberately does NOT — student is a case role, never a category.
    IF r <> 'student' THEN
      IF pr.category IS NULL THEN
        b := array_append(b, 'practitioner_class_not_set');
      ELSIF pr.category NOT IN ('regulated_healthcare_professional','accredited_practitioner','ni_verified_practitioner') THEN
        b := array_append(b, 'category_unsupported');
      ELSIF r = 'lead' AND pr.category = 'ni_verified_practitioner' THEN
        -- Governance rule from 0060/0063, not reopened here.
        b := array_append(b, 'role_not_permitted_for_category');
      END IF;
    END IF;

    -- Required credential for this role / category.
    v_need := CASE
                WHEN r = 'student' THEN 'student_enrolment'
                WHEN pr.category = 'regulated_healthcare_professional' THEN 'statutory_registration'
                WHEN pr.category = 'accredited_practitioner' THEN 'accredited_register'
                WHEN pr.category = 'ni_verified_practitioner' THEN 'qualification'
                ELSE NULL
              END;

    IF v_need IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM public.practitioner_credentials c
         WHERE c.practitioner_id = p_practitioner_id
           AND c.credential_type = v_need
           AND c.verification_status = 'verified'
           AND c.revoked_at IS NULL
           AND c.superseded_at IS NULL
           AND (c.expires_at IS NULL OR c.expires_at >= CURRENT_DATE)
           -- External registers must be in good standing; a qualification with
           -- no renewable register uses not_applicable.
           AND (c.credential_type IN ('qualification','student_enrolment')
                OR c.standing_status = 'current')
      ) INTO v_cred_ok;

      IF v_cred_ok THEN
        IF first THEN v_cred_state := 'ok'; END IF;
      ELSE
        -- Name the nearest failure so the blocker is actionable.
        IF EXISTS (SELECT 1 FROM public.practitioner_credentials c
                    WHERE c.practitioner_id = p_practitioner_id AND c.credential_type = v_need
                      AND c.revoked_at IS NOT NULL) THEN
          b := array_append(b, 'credential_revoked');
          IF first THEN v_cred_state := 'revoked'; END IF;
        ELSIF EXISTS (SELECT 1 FROM public.practitioner_credentials c
                       WHERE c.practitioner_id = p_practitioner_id AND c.credential_type = v_need
                         AND c.superseded_at IS NULL AND c.revoked_at IS NULL
                         AND c.expires_at IS NOT NULL AND c.expires_at < CURRENT_DATE) THEN
          b := array_append(b, 'credential_expired');
          IF first THEN v_cred_state := 'expired'; END IF;
        ELSIF EXISTS (SELECT 1 FROM public.practitioner_credentials c
                       WHERE c.practitioner_id = p_practitioner_id AND c.credential_type = v_need
                         AND c.superseded_at IS NULL AND c.revoked_at IS NULL
                         AND c.verification_status = 'verified'
                         AND c.credential_type NOT IN ('qualification','student_enrolment')
                         AND c.standing_status <> 'current') THEN
          b := array_append(b, 'registration_not_current');
          IF first THEN v_cred_state := 'expired'; END IF;
        ELSIF EXISTS (SELECT 1 FROM public.practitioner_credentials c
                       WHERE c.practitioner_id = p_practitioner_id AND c.credential_type = v_need
                         AND c.superseded_at IS NULL AND c.revoked_at IS NULL
                         AND c.verification_status <> 'verified') THEN
          b := array_append(b, 'credentials_not_verified');
          IF first THEN v_cred_state := 'unverified'; END IF;
        ELSE
          b := array_append(b, 'credential_missing');
          IF first THEN v_cred_state := 'missing'; END IF;
        END IF;
      END IF;
    END IF;

    -- Scope must exist, be approved, and permit this role.
    IF v_scope_state = 'missing' THEN
      b := array_append(b, 'scope_missing');
    ELSIF v_scope_state = 'suspended' THEN
      b := array_append(b, 'scope_suspended');
    ELSIF v_scope_state = 'revoked' THEN
      b := array_append(b, 'scope_revoked');
    ELSIF v_scope_state <> 'ok' THEN
      b := array_append(b, 'scope_not_approved');
    ELSIF NOT (r = ANY (sc.permitted_roles)) THEN
      b := array_append(b, 'scope_role_not_permitted');
    END IF;

    -- Agreement acceptance: qualified roles only.
    IF r <> 'student' AND pr.category IS NOT NULL AND v_agree_state <> 'ok' THEN
      b := array_append(b, 'no_current_agreement_acceptance');
    END IF;

    -- ── Indemnity ──────────────────────────────────────────────────────────
    -- NI role floor. Absent configuration is unknown, never zero.
    SELECT minimum_cover INTO v_req
      FROM public.indemnity_requirements
     WHERE requirement_source = 'ni_role_floor' AND source_key = r
       AND effective_from <= CURRENT_DATE
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
     ORDER BY effective_from DESC LIMIT 1;

    v_unknown := false;
    IF v_req IS NULL THEN
      v_unknown := true;
    END IF;

    -- External requirements implied by the practitioner's own verified,
    -- in-standing credentials. An applicable body with NO configured minimum
    -- makes this NOT eligible — the NI floor is never assumed sufficient.
    FOR v_ext IN
      SELECT ir.minimum_cover
        FROM public.practitioner_credentials c
        LEFT JOIN public.indemnity_requirements ir
               ON ir.source_key = c.issuing_body_key
              AND ir.requirement_source = CASE c.credential_type
                    WHEN 'statutory_registration' THEN 'regulator'
                    WHEN 'accredited_register'    THEN 'accredited_register'
                    WHEN 'professional_body'      THEN 'professional_body'
                  END
              AND ir.effective_from <= CURRENT_DATE
              AND (ir.effective_to IS NULL OR ir.effective_to >= CURRENT_DATE)
       WHERE c.practitioner_id = p_practitioner_id
         AND c.credential_type IN ('statutory_registration','accredited_register','professional_body')
         AND c.verification_status = 'verified'
         AND c.revoked_at IS NULL AND c.superseded_at IS NULL
         AND (c.expires_at IS NULL OR c.expires_at >= CURRENT_DATE)
         AND c.standing_status = 'current'
    LOOP
      IF v_ext IS NULL THEN
        v_unknown := true;           -- body applies, minimum not configured
      ELSIF v_req IS NULL OR v_ext > v_req THEN
        v_req := v_ext;              -- higher applicable requirement wins
      END IF;
    END LOOP;

    IF v_unknown THEN
      b := array_append(b, 'indemnity_requirement_unknown');
    END IF;

    IF ind.id IS NULL THEN
      b := array_append(b, 'indemnity_missing');
    ELSIF ind.verification_status <> 'verified' THEN
      b := array_append(b, 'indemnity_unverified');
    ELSIF ind.currency <> 'GBP' THEN
      b := array_append(b, 'indemnity_currency_unsupported');
    ELSIF ind.expiry_date < CURRENT_DATE THEN
      -- Valid THROUGH expiry_date; expired from the following day.
      b := array_append(b, 'indemnity_expired');
    ELSIF NOT v_unknown AND v_req IS NOT NULL AND ind.cover_amount < v_req THEN
      b := array_append(b, 'indemnity_insufficient');
    END IF;

    -- Report the floor for whichever role the caller asked about.
    IF p_case_role IS NOT NULL AND r = p_case_role THEN
      required_cover := v_req;
    END IF;

    IF cardinality(b) = 0 THEN
      ok_roles := array_append(ok_roles, r);
    END IF;

    -- Blockers common to every role, for the role-free base evaluation.
    IF first THEN
      common := b;
      first := false;
    ELSE
      SELECT coalesce(array_agg(x), '{}') INTO common
        FROM unnest(common) x WHERE x = ANY (b);
    END IF;

    IF p_case_role IS NOT NULL AND r = p_case_role THEN
      blockers := b;
    END IF;
  END LOOP;

  credential_state := v_cred_state;
  eligible_roles   := ok_roles;

  IF p_case_role IS NULL THEN
    required_cover := NULL;
    eligible := cardinality(ok_roles) > 0;
    blockers := CASE WHEN eligible THEN '{}'::text[] ELSE common END;
  ELSE
    eligible := p_case_role = ANY (ok_roles);
  END IF;

  RETURN NEXT;
END;
$function$;

comment on function public.practitioner_eligibility(uuid, text) is
  'THE authority on practitioner eligibility. Role-aware: lead | care_team | student, or NULL to evaluate all. All credential, indemnity, scope, category, agreement and DBS logic lives here and nowhere else. Fail-closed throughout: absent evidence is a blocker, never a pass. Expiry is judged against CURRENT_DATE at query time, so cover lapses because the date changed — no cron, no cached boolean.';

-- ── 7. Compatibility wrapper — NOT AUTHORITY ────────────────────────────────
--
-- COMPATIBILITY WRAPPER, NOT AUTHORITY.
--
-- Six database callers and the unapplied 0061 on feat/protocol-adoption-signing
-- call practitioner_assignment_eligibility(uuid) and read (eligible, reasons).
-- Its signature and return shape are preserved exactly so none of them break,
-- and so a later application of 0061 cannot reintroduce the old semantics.
--
-- It contains NO rules. Every verdict comes from practitioner_eligibility.
-- The role-free evaluation is used, which answers "could this practitioner
-- hold ANY canonical role" — the same question the old function answered.

create or replace function public.practitioner_assignment_eligibility(p_practitioner_id uuid)
returns table(eligible boolean, reasons text[])
language sql
stable
security definer
set search_path to 'public', 'extensions'
as $function$
  SELECT e.eligible, e.blockers
    FROM public.practitioner_eligibility(p_practitioner_id, NULL) e;
$function$;

comment on function public.practitioner_assignment_eligibility(uuid) is
  'COMPATIBILITY WRAPPER — NOT AUTHORITY. Delegates entirely to practitioner_eligibility(uuid, NULL). Retained so existing callers, and the unapplied 0061, keep working and inherit the canonical semantics. Contains no eligibility logic of its own; do not add any.';

commit;

-- ── NOT DONE HERE, AND WHY ──────────────────────────────────────────────────
--
-- · No backfill. The flat columns on `practitioners` are untouched and no
--   evidence rows are synthesised from them. Inventing verified evidence from
--   a free-text blob is exactly the "admin opinion" this migration exists to
--   end. Verification is a human act and is recorded as one.
--
-- · No regulator, Accredited Register or professional-body minimum is seeded.
--   None is source-backed. Until one is configured, any practitioner holding
--   such a credential is refused with indemnity_requirement_unknown rather
--   than being passed on the NI floor alone.
--
-- · No admin verification UI. Separate sprint; estimated 4–6 person-days for
--   the minimal surface, 12–18 for the polished one.
--
-- · case_events RLS is NOT repaired here. This migration supplies what that
--   repair needs: an active case/team relation, one authoritative eligibility
--   verdict, and practitioner-specific consent — with no credential, insurance
--   or scope logic duplicated into the policy.
