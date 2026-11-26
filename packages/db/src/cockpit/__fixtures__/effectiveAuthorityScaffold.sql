-- Stand-ins for the live NI structures that migration 0071 depends on.
--
-- Only what 0071 actually reads is reproduced. Everything 0071 itself creates
-- is left to the migration file, which the test executes from disk — so the
-- tests exercise the real SQL rather than a paraphrase of it.
--
-- WHAT IS REAL HERE
--   * case_team_roles carries BOTH live partial unique indexes
--     (uniq_active_lead_per_case, uniq_active_role_per_practitioner_case) and
--     both live CHECK constraints, so a test cannot rely on a shape the real
--     table would refuse — and so "load the cast twice" genuinely cannot
--     duplicate a row.
--   * case_taking_sessions carries 0066's state machine and signature CHECKs
--     plus 0070's four provenance columns and their completeness CHECK, the
--     revision bump and both freeze triggers. The freeze is what makes
--     signed-record immutability testable rather than asserted.
--   * testing_mode is 0069's singleton, including the attribution trigger that
--     0071 replaces.
--
-- WHAT IS STUBBED, AND WHY
--   * auth.uid() over a GUC, so a test can be a particular signed-in person,
--     an admin, or the service role (no uid at all).
--   * practitioner_eligibility() is table-driven and returns BOTH `eligible`
--     and `blockers`. 0071's whole override decision turns on WHICH blockers
--     are present — absent evidence may be set aside, an adverse finding never
--     may — so a stub returning only a boolean would make these tests
--     decorative. The real function's internals have their own 45-test suite
--     under 0064; copying them here would test that migration, not this one.
--   * has_practitioner_access_consent() is table-driven for the same reason.

-- The Supabase roles 0071's GRANT/REVOKE statements name. PGlite starts with
-- none of them, and a revoke against a missing role is a hard error — so the
-- migration's grant hygiene is only testable once they exist.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;

create schema if not exists auth;

create or replace function auth.uid() returns uuid language plpgsql stable as $$
begin
  return nullif(current_setting('test.auth_uid', true), '')::uuid;
exception when others then return null;
end $$;

create or replace function auth.role() returns text language plpgsql stable as $$
begin
  return coalesce(nullif(current_setting('test.auth_role', true), ''), 'authenticated');
end $$;

-- ── Identity ────────────────────────────────────────────────────────────────

create table profiles (
  id           uuid primary key default gen_random_uuid(),
  role         text not null default 'user',
  full_name    text,
  is_test_data boolean not null default false
);

create table practitioners (
  id           uuid primary key default gen_random_uuid(),
  category     text,
  status       text not null default 'active',
  is_active    boolean not null default true,
  dbs_status   text,
  is_test_data boolean not null default false
);

-- 0072's non-clinical eligibility reads this: an approved scope naming the
-- contributor role is what a Coach has instead of a clinical credential.
create table practitioner_scope (
  id              uuid primary key default gen_random_uuid(),
  practitioner_id uuid not null references practitioners(id) on delete cascade,
  approved_scope  text,
  permitted_roles text[] not null default '{}',
  status          text not null default 'approved',
  superseded_at   timestamptz
);

-- ── Cases ───────────────────────────────────────────────────────────────────
-- is_test_data is 0069's column. No DEFAULT: the setting is the authoritative
-- source, exactly as in production.

create table client_cases (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references profiles(id) on delete cascade,
  status       text not null default 'active',
  is_test_data boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table case_team_roles (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references client_cases(id) on delete cascade,
  practitioner_id uuid not null references practitioners(id) on delete cascade,
  team_role       text not null,
  supervisor_id   uuid references practitioners(id),
  assigned_by     uuid not null,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz,
  end_reason      text,
  constraint case_team_roles_team_role_check
    check (team_role = any (array['lead','care_team','student'])),
  constraint case_team_student_requires_supervisor
    check (team_role <> 'student' or supervisor_id is not null)
);

create unique index uniq_active_lead_per_case
  on case_team_roles (case_id) where (team_role = 'lead' and ended_at is null);
create unique index uniq_active_role_per_practitioner_case
  on case_team_roles (case_id, practitioner_id) where (ended_at is null);

create table client_practitioner_links (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references profiles(id) on delete cascade,
  practitioner_id uuid not null references practitioners(id) on delete cascade,
  ended_at        timestamptz,
  created_at      timestamptz not null default now()
);

create table care_plan_coordination (
  id                uuid primary key default gen_random_uuid(),
  case_id           uuid not null references client_cases(id) on delete cascade,
  lead_id           uuid not null,
  coordination_note text,
  reviewed_at       timestamptz not null default now(),
  released_at       timestamptz,
  released_by       uuid
);

-- ── Audit (0026-era shape, unused by the app until WP2) ─────────────────────

create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor_id      uuid,
  actor_role    text,
  action        text not null,
  resource_type text not null,
  resource_id   uuid,
  metadata      jsonb,
  ip_address    text,
  created_at    timestamptz default now()
);

-- ── 0066 case-taking + 0070 provenance ──────────────────────────────────────

create table case_taking_sessions (
  id                 uuid primary key default gen_random_uuid(),
  case_id            uuid not null references client_cases(id) on delete cascade,
  consultation_seq   integer not null,
  consultation_kind  text not null,
  started_by         uuid not null,
  state              text not null default 'in_progress',
  current_position   text,
  submitted_by       uuid,
  submitted_at       timestamptz,
  review_started_by  uuid,
  review_started_at  timestamptz,
  ready_at           timestamptz,
  signed_off_by      uuid,
  signed_off_at      timestamptz,
  version            integer not null default 1,
  supersedes         uuid,
  revision           integer not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  override_active_at_signing boolean,
  override_used_at_signing   boolean,
  is_test_output             boolean,
  effective_role             text,
  constraint case_taking_sessions_state_check
    check (state = any (array['in_progress','submitted_to_lead','lead_review','ready_for_sign_off','signed_off'])),
  constraint case_taking_signoff_complete check ((signed_off_by is null) = (signed_off_at is null)),
  constraint case_taking_signoff_state    check ((state = 'signed_off') = (signed_off_at is not null)),
  constraint case_taking_sessions_revision_check check (revision >= 1),
  constraint case_taking_provenance_complete check (
        (signed_off_at is null) = (override_active_at_signing is null)
    and (signed_off_at is null) = (override_used_at_signing   is null)
    and (signed_off_at is null) = (is_test_output             is null)
    and (signed_off_at is null) = (effective_role             is null)
  ),
  constraint case_taking_override_implies_test check (
    coalesce(override_used_at_signing,false) = false or coalesce(is_test_output,false) = true),
  constraint case_taking_override_used_requires_active check (
    coalesce(override_used_at_signing,false) = false or coalesce(override_active_at_signing,false) = true),
  constraint case_taking_effective_role_valid check (
    effective_role is null or effective_role in ('lead','care_team','student'))
);

create or replace function bump_case_taking_revision() returns trigger language plpgsql as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end $$;

create trigger trg_bump_case_taking_session_revision
  before update on case_taking_sessions
  for each row execute function bump_case_taking_revision();

create or replace function freeze_signed_case_taking() returns trigger language plpgsql as $$
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
end $$;

create trigger trg_freeze_signed_case_taking
  before delete or update on case_taking_sessions
  for each row execute function freeze_signed_case_taking();

-- ── 0069 testing_mode ───────────────────────────────────────────────────────

create table testing_mode (
  id                     boolean primary key default true,
  enabled                boolean not null default false,
  new_cases_default_test boolean not null default true,
  changed_by             uuid references profiles(id) on delete set null,
  changed_at             timestamptz not null default now(),
  constraint testing_mode_singleton check (id)
);
insert into testing_mode (id, enabled, new_cases_default_test) values (true, false, true);

create or replace function enforce_testing_mode_attribution() returns trigger language plpgsql as $$
begin
  if new.changed_by is null then
    raise exception 'testing mode: a change must name the admin making it (changed_by)'
      using errcode = 'check_violation';
  end if;
  new.changed_at := now();
  return new;
end $$;

create trigger trg_testing_mode_attribution
  before update on testing_mode
  for each row execute function enforce_testing_mode_attribution();

-- ── Table-driven stubs ──────────────────────────────────────────────────────
-- 0071's override decision turns on WHICH blockers a practitioner has, so the
-- stub carries them. FAILS CLOSED when no row exists.

create table test_eligibility (
  practitioner_id uuid not null,
  case_role       text not null,
  eligible        boolean not null,
  blockers        text[] not null default '{}',
  primary key (practitioner_id, case_role)
);

create or replace function public.practitioner_eligibility(
  p_practitioner_id uuid, p_case_role text default null
) returns table (
  eligible boolean, evaluated_role text, eligible_roles text[], blockers text[],
  category text, required_cover numeric, actual_cover numeric, indemnity_expiry date,
  credential_state text, scope_state text, agreement_state text, evaluated_at timestamptz
) language sql stable as $$
  select
    coalesce((select e.eligible from public.test_eligibility e
               where e.practitioner_id = p_practitioner_id
                 and e.case_role = coalesce(p_case_role, 'lead')), false),
    p_case_role,
    '{}'::text[],
    coalesce((select e.blockers from public.test_eligibility e
               where e.practitioner_id = p_practitioner_id
                 and e.case_role = coalesce(p_case_role, 'lead')),
             array['practitioner_not_found']::text[]),
    (select pr.category from public.practitioners pr where pr.id = p_practitioner_id),
    null::numeric, null::numeric, null::date,
    'missing'::text, 'missing'::text, 'not_required'::text, now();
$$;

create or replace function public.practitioner_assignment_eligibility(p_practitioner_id uuid)
returns table (eligible boolean, reasons text[]) language sql stable as $$
  select e.eligible, e.blockers from public.practitioner_eligibility(p_practitioner_id, null) e;
$$;

create table test_access_consent (
  client_id       uuid not null,
  practitioner_id uuid not null,
  granted         boolean not null default true,
  primary key (client_id, practitioner_id)
);

create or replace function public.has_practitioner_access_consent(
  p_member_id uuid, p_practitioner_id uuid
) returns boolean language sql stable as $$
  select coalesce((select c.granted from public.test_access_consent c
                    where c.client_id = p_member_id
                      and c.practitioner_id = p_practitioner_id), false);
$$;

-- The pre-0071 case-access gate, so the migration's CREATE OR REPLACE is
-- proven to be a genuine replacement of what exists today.
create or replace function public.can_access_case_care_profile(p_case_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare v_client uuid; v_role record; v_eligible boolean;
begin
  if auth.uid() is null then return false; end if;
  select client_id into v_client from public.client_cases where id = p_case_id;
  if v_client is null then return false; end if;
  if not exists (select 1 from public.client_practitioner_links l
                  where l.client_id = v_client and l.practitioner_id = auth.uid()
                    and l.ended_at is null) then return false; end if;
  select * into v_role from public.case_team_roles
   where case_id = p_case_id and practitioner_id = auth.uid() and ended_at is null limit 1;
  if not found then return false; end if;
  select e.eligible into v_eligible
    from public.practitioner_eligibility(auth.uid(), v_role.team_role) e;
  if v_eligible is not true then return false; end if;
  if not public.has_practitioner_access_consent(v_client, auth.uid()) then return false; end if;
  return true;
end $$;

-- The pre-0071 assignment triggers, likewise.
create or replace function public.enforce_case_team_role_rules() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_eligible boolean; v_reasons text[];
begin
  if new.ended_at is not null then return new; end if;
  select e.eligible, e.blockers into v_eligible, v_reasons
    from public.practitioner_eligibility(new.practitioner_id, new.team_role) e;
  if v_eligible is not true then
    raise exception 'care team: practitioner not assignable as %: %', new.team_role, array_to_string(v_reasons, ', ')
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger trg_case_team_role_rules
  before insert or update on case_team_roles
  for each row execute function public.enforce_case_team_role_rules();

create or replace function public.enforce_practitioner_assignable() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_eligible boolean; v_reasons text[];
begin
  select e.eligible, e.reasons into v_eligible, v_reasons
    from public.practitioner_assignment_eligibility(new.practitioner_id) e;
  if v_eligible is not true then
    raise exception 'practitioner not assignable: %', array_to_string(v_reasons, ', ')
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger trg_enforce_assignable_link
  before insert on client_practitioner_links
  for each row execute function public.enforce_practitioner_assignable();

-- 0070's provenance trigger, which 0071 replaces.
create or replace function public.set_case_taking_signature_provenance() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_switch boolean; v_is_test boolean; v_role text;
begin
  if new.signed_off_at is null then return new; end if;
  if tg_op = 'UPDATE' and old.signed_off_at is not null then return new; end if;
  select t.enabled into v_switch from public.testing_mode t;
  new.override_active_at_signing := coalesce(v_switch, false);
  new.override_used_at_signing := false;
  select c.is_test_data into v_is_test from public.client_cases c where c.id = new.case_id;
  new.is_test_output := coalesce(v_is_test, true);
  select r.team_role into v_role from public.case_team_roles r
   where r.case_id = new.case_id and r.practitioner_id = new.signed_off_by
     and r.ended_at is null limit 1;
  if v_role is null then
    raise exception 'case-taking sign-off: cannot record truthful provenance - the signer holds no active case-team role on this case'
      using errcode = 'insufficient_privilege';
  end if;
  new.effective_role := v_role;
  return new;
end $$;

create trigger trg_case_taking_signature_provenance
  before insert or update on case_taking_sessions
  for each row execute function public.set_case_taking_signature_provenance();

create or replace function public.enforce_case_taking_authority() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then return new; end if;
  return new;
end $$;

create trigger trg_case_taking_authority
  before insert or update on case_taking_sessions
  for each row execute function public.enforce_case_taking_authority();

-- ── Case-taking answers and contributions, with REAL RLS ────────────────────
-- RLS is genuinely enforced below: the 0072 tests run after `set role
-- authenticated`, a role that owns nothing, so the policies actually apply.
-- The pre-0072 policies are FOR ALL, exactly as production has them, so the
-- migration's split is proven to be a real replacement rather than an addition
-- alongside a permissive policy that would mask it.

create table case_taking_answers (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references case_taking_sessions(id) on delete cascade,
  entry_kind text not null default 'answer',
  question_id text,
  value      text,
  revision   integer not null default 1
);

create table case_contributions (
  id                     uuid primary key default gen_random_uuid(),
  case_id                uuid not null references client_cases(id) on delete cascade,
  author_id              uuid not null,
  team_role              text,
  kind                   text not null default 'note',
  content                text,
  supervisor_verified_by uuid,
  supervisor_verified_at timestamptz,
  created_at             timestamptz not null default now()
);

alter table case_taking_sessions enable row level security;
alter table case_taking_answers  enable row level security;
alter table case_contributions   enable row level security;

create policy case_taking_sessions_access on case_taking_sessions
  for all using (public.can_access_case_care_profile(case_id))
  with check (public.can_access_case_care_profile(case_id));

create policy case_taking_answers_access on case_taking_answers
  for all using (exists (select 1 from case_taking_sessions s
                          where s.id = case_taking_answers.session_id
                            and public.can_access_case_care_profile(s.case_id)))
  with check (exists (select 1 from case_taking_sessions s
                       where s.id = case_taking_answers.session_id
                         and public.can_access_case_care_profile(s.case_id)));

create policy case_contributions_access on case_contributions
  for all using (public.can_access_case_care_profile(case_id))
  with check (public.can_access_case_care_profile(case_id));

grant usage on schema public to authenticated;
grant select, insert, update, delete on case_taking_sessions, case_taking_answers,
  case_contributions, case_team_roles, client_cases, profiles, practitioners,
  client_practitioner_links, testing_mode, audit_logs, practitioner_scope,
  test_eligibility, test_access_consent to authenticated;
