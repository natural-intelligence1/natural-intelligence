-- Stand-ins for the live structures migration 0064 depends on.
--
-- Reproduces the POST-0063 practitioners table (canonical taxonomy, the CHECK
-- vocabularies that 0064 reads), profiles, the agreement pair and the two
-- helper functions 0064 calls. 0064 is then executed against this, so the
-- tests exercise the real migration rather than a paraphrase of it.
--
-- auth.uid()/auth.role() are stubbed over GUCs. is_admin() and
-- practitioner_has_current_acceptance() are reproduced from the live
-- catalogue — the acceptance one verbatim in substance, because 0064's
-- agreement gate depends on exactly what it checks.

create schema if not exists auth;
create schema if not exists extensions;

-- PGlite has no pgcrypto, so extensions.digest is shimmed over md5, which is
-- in Postgres core. The property these tests exercise is "acceptance must
-- match the EXACT current agreement text" — md5 preserves that exactly. Live
-- uses sha256; only the algorithm differs, never the behaviour under test.
create or replace function extensions.digest(p_data text, p_algo text)
returns bytea language sql immutable as $$ select decode(md5(p_data), 'hex') $$;

create or replace function auth.uid() returns uuid language plpgsql stable as $$
begin
  return nullif(current_setting('test.auth_uid', true), '')::uuid;
exception when others then return null;
end $$;

create or replace function auth.role() returns text language plpgsql stable as $$
begin
  return coalesce(nullif(current_setting('test.auth_role', true), ''), 'authenticated');
end $$;

create table profiles (
  id           uuid primary key default gen_random_uuid(),
  full_name    text,
  role         text not null default 'user',
  is_test_data boolean not null default false
);

create or replace function public.is_admin() returns boolean language sql stable as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

-- Post-0063 practitioners: canonical taxonomy, live CHECK vocabularies.
create table practitioners (
  id                              uuid primary key default gen_random_uuid(),
  display_name                    text,
  category                        text,
  status                          text not null default 'pending_review',
  is_active                       boolean not null default false,
  credentials_verification_status text not null default 'unverified',
  indemnity_required              boolean not null default true,
  insurance_expiry                date,
  registration_number             text,
  registration_body               text,
  registration_status             text,
  dbs_status                      text,
  scope_status                    text not null default 'none',
  is_test_data                    boolean not null default false,
  constraint practitioners_category_check
    check (category = any (array['regulated_healthcare_professional'::text,
                                 'accredited_practitioner'::text,
                                 'ni_verified_practitioner'::text])),
  constraint practitioners_status_check
    check (status = any (array['pending_review','approved','active','suspended','archived'])),
  constraint practitioners_dbs_status_check
    check (dbs_status = any (array['required','not_required','pending','clear','flagged'])),
  constraint practitioners_scope_status_check
    check (scope_status = any (array['none','submitted','approved','revoked']))
);

create table practitioner_agreements (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,
  version    text not null,
  title      text not null default 't',
  body       text not null default 'b',
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);

create table practitioner_agreement_acceptances (
  id                 uuid primary key default gen_random_uuid(),
  practitioner_id    uuid not null references practitioners(id) on delete cascade,
  agreement_id       uuid not null references practitioner_agreements(id),
  agreement_version  text not null,
  accepted_at        timestamptz not null default now(),
  accepted_text_hash text not null
);

-- Verbatim in substance from the live catalogue: acceptance must match the
-- current agreement for the practitioner's category by id, version AND a
-- sha256 of its exact text. 0064's agreement gate depends on this precision.
create or replace function public.practitioner_has_current_acceptance(p_practitioner_id uuid)
returns boolean language sql stable as $$
  SELECT EXISTS (
    SELECT 1
      FROM public.practitioner_agreements a
      JOIN public.practitioners p
        ON p.id = p_practitioner_id AND p.category = a.category
      JOIN public.practitioner_agreement_acceptances acc
        ON acc.practitioner_id    = p_practitioner_id
       AND acc.agreement_id       = a.id
       AND acc.agreement_version  = a.version
       AND acc.accepted_text_hash = encode(extensions.digest(a.body, 'sha256'), 'hex')
     WHERE a.is_current
  );
$$;

-- ── Case-side structures, so 0064's rewired callers can be exercised ────────
-- Copied in the shape the live catalogue uses. Only what the role-specific
-- regression tests actually touch is reproduced.

create table client_cases (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references profiles(id) on delete cascade,
  status     text not null default 'active',
  created_at timestamptz not null default now()
);

create table case_team_roles (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references client_cases(id) on delete cascade,
  practitioner_id uuid not null references practitioners(id),
  team_role       text not null check (team_role = any (array['lead','care_team','student'])),
  supervisor_id   uuid references practitioners(id),
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  constraint case_team_student_requires_supervisor
    check ((team_role <> 'student') or (supervisor_id is not null))
);
create unique index uniq_active_lead_per_case
  on case_team_roles (case_id) where team_role = 'lead' and ended_at is null;
create unique index uniq_active_role_per_practitioner_case
  on case_team_roles (case_id, practitioner_id) where ended_at is null;

create table client_practitioner_links (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references profiles(id) on delete cascade,
  practitioner_id uuid not null references practitioners(id) on delete restrict,
  connection_type text not null default 'assigned_by_admin',
  role            text check (role = any (array['lead','specialist','reviewer','temporary'])),
  ended_at        timestamptz,
  created_at      timestamptz not null default now()
);

create table case_practitioner_work (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references client_cases(id) on delete cascade,
  practitioner_id uuid not null references practitioners(id) on delete restrict,
  work_type       text not null default 'case_review',
  status          text not null default 'assigned',
  assigned_at     timestamptz not null default now()
);

create table consent_records (
  id                      uuid primary key default gen_random_uuid(),
  profile_id              uuid not null references profiles(id) on delete cascade,
  consent_type            text not null,
  context_practitioner_id uuid references practitioners(id),
  consented               boolean not null default true,
  withdrawn_at            timestamptz,
  created_at              timestamptz not null default now()
);

create or replace function public.has_practitioner_access_consent(p_member_id uuid, p_practitioner_id uuid)
returns boolean language sql stable security definer set search_path to 'public' as $$
  SELECT EXISTS (
    SELECT 1 FROM public.consent_records c
     WHERE c.profile_id = p_member_id
       AND c.consent_type = 'practitioner_access'
       AND c.context_practitioner_id = p_practitioner_id
       AND c.consented IS TRUE
       AND c.withdrawn_at IS NULL
  );
$$;

-- Tables 0064's rewired Lead functions reference. Not exercised by these
-- tests, but present so the function bodies resolve if ever called.
create table case_analysis_plan (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references client_cases(id) on delete cascade
);
create table care_plan_coordination (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references client_cases(id) on delete cascade,
  lead_id           uuid not null references practitioners(id),
  coordination_note text,
  reviewed_at       timestamptz not null default now(),
  released_at       timestamptz,
  released_by       uuid references practitioners(id)
);

-- Pre-0064 placeholders for the two trigger functions, so the triggers below
-- can be wired exactly as they are in Production. 0064 CREATE OR REPLACEs both
-- with the role-aware versions, which is what the tests then exercise. These
-- bodies are deliberately permissive: if a test ever passes against THESE
-- rather than 0064's, it proves the migration did not land.
create or replace function public.enforce_case_team_role_rules() returns trigger
  language plpgsql as $$ begin return new; end $$;
create or replace function public.enforce_practitioner_assignable() returns trigger
  language plpgsql as $$ begin return new; end $$;

-- The two triggers 0064 rewires. Created here so the migration's
-- CREATE OR REPLACE lands on a live wiring, exactly as in Production.
create trigger trg_case_team_role_rules before insert or update on public.case_team_roles
  for each row execute function public.enforce_case_team_role_rules();
create trigger trg_enforce_assignable_link before insert or update on public.client_practitioner_links
  for each row execute function public.enforce_practitioner_assignable();
create trigger trg_enforce_assignable_work before insert or update on public.case_practitioner_work
  for each row execute function public.enforce_practitioner_assignable();
