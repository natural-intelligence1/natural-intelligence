-- Stand-ins for the live NI structures that migration 0066 depends on.
--
-- Only what 0066's policies, triggers and constraints actually read is
-- reproduced. Everything 0066 itself creates is left to the migration file,
-- which the test executes from disk — so the tests exercise the real SQL
-- rather than a paraphrase of it.
--
-- WHAT IS REAL HERE
--   * can_access_case_care_profile() is reproduced from the live catalogue
--     almost line for line, including the care-link requirement, the
--     active-role requirement, the consent requirement and the student
--     supervision rule. It is the single gate 0066's RLS depends on, so a
--     simplified version would make the RLS tests decorative.
--   * case_contributions and block_contribution_rewrite() are copied from the
--     live catalogue in their PRE-0066 form, so the migration's
--     CREATE OR REPLACE is proven to be a genuine replacement of the function
--     that exists today — and the pre-existing freeze is proven still to work.
--   * RLS is genuinely enforced: every policy assertion runs after
--     `set role authenticated`, a role that owns nothing.
--
-- WHAT IS STUBBED, AND WHY
--   * auth.uid() / auth.role() over GUCs, so a test can be a particular
--     signed-in practitioner or the service role.
--   * practitioner_eligibility() is narrowed to the single column that both
--     the live Protocol trigger and 0066's trigger read (`eligible`), driven
--     by a table so each test states its own assumption. It FAILS CLOSED when
--     no row exists. The real function's internals (credentials, indemnity,
--     scope, agreements) have their own suite under migration 0064; copying
--     them here would test that migration, not this one.
--   * has_practitioner_access_consent() is table-driven for the same reason.

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

create table profiles (
  id   uuid primary key default gen_random_uuid(),
  role text not null default 'member'
);

create table practitioners (
  id         uuid primary key default gen_random_uuid(),
  category   text not null default 'regulated_healthcare_professional',
  is_active  boolean not null default true
);

create table client_cases (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references profiles(id) on delete cascade,
  status     text not null default 'active',
  created_at timestamptz not null default now()
);

-- Live shape: time-bounded role assignment. ended_at IS NULL means active.
-- Both CHECK constraints are copied from the live catalogue, so a test cannot
-- rely on a team_role the real table would refuse. The live domain is exactly
-- 'lead' | 'care_team' | 'student' — the same vocabulary as CASE_ROLES in
-- packages/db/src/cockpit/caseTaking.ts.
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

create table client_practitioner_links (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references profiles(id) on delete cascade,
  practitioner_id uuid not null references practitioners(id) on delete cascade,
  connection_type text not null default 'care',
  role            text not null default 'lead',
  control_level   text not null default 'full',
  creation_actor  text not null default 'admin',
  ended_at        timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Copied from the live catalogue, PRE-0066: no session_id / entry_id /
-- question_id. 0066 adds them.
create table case_contributions (
  id                     uuid primary key default gen_random_uuid(),
  case_id                uuid not null references client_cases(id) on delete cascade,
  author_id              uuid not null,
  team_role              text not null,
  profession             text,
  kind                   text not null,
  content                text not null,
  source                 text not null default 'consultation',
  client_confirmed       boolean not null default false,
  supervisor_verified_by uuid,
  supervisor_verified_at timestamptz,
  created_at             timestamptz not null default now()
);

-- ── Stubs driven by tables, so every test states its own assumptions ────────

create table test_eligibility (
  practitioner_id uuid not null,
  case_role       text not null,
  eligible        boolean not null,
  primary key (practitioner_id, case_role)
);

-- Narrowed to the one column the triggers read. FAILS CLOSED when unknown.
create or replace function public.practitioner_eligibility(
  p_practitioner_id uuid, p_case_role text
) returns table (eligible boolean) language sql stable as $$
  select coalesce(
    (select e.eligible from public.test_eligibility e
      where e.practitioner_id = p_practitioner_id and e.case_role = p_case_role),
    false);
$$;

create table test_access_consent (
  client_id       uuid not null,
  practitioner_id uuid not null,
  granted         boolean not null,
  primary key (client_id, practitioner_id)
);

create or replace function public.has_practitioner_access_consent(
  p_member_id uuid, p_practitioner_id uuid
) returns boolean language sql stable as $$
  select coalesce(
    (select c.granted from public.test_access_consent c
      where c.client_id = p_member_id and c.practitioner_id = p_practitioner_id),
    false);
$$;

create or replace function public.is_admin() returns boolean language sql stable as $$
  select exists (select 1 from public.profiles p
                  where p.id = auth.uid() and p.role = 'admin');
$$;

-- ── The real access gate, reproduced from the live catalogue ────────────────
create or replace function public.can_access_case_care_profile(p_case_id uuid)
returns boolean language plpgsql stable security definer set search_path to 'public' as $$
declare
  v_client uuid;
  v_role record;
  v_eligible boolean;
begin
  if auth.uid() is null then return false; end if;

  select client_id into v_client from public.client_cases where id = p_case_id;
  if v_client is null then return false; end if;

  if not exists (
    select 1 from public.client_practitioner_links l
     where l.client_id = v_client and l.practitioner_id = auth.uid()
       and l.ended_at is null
  ) then return false; end if;

  select * into v_role from public.case_team_roles
   where case_id = p_case_id and practitioner_id = auth.uid() and ended_at is null
   limit 1;
  if not found then return false; end if;

  select e.eligible into v_eligible
    from public.practitioner_eligibility(auth.uid(), v_role.team_role) e;
  if v_eligible is not true then return false; end if;

  if not public.has_practitioner_access_consent(v_client, auth.uid()) then return false; end if;

  if v_role.team_role = 'student' then
    if v_role.supervisor_id is null or not exists (
      select 1 from public.case_team_roles s
       where s.case_id = p_case_id and s.practitioner_id = v_role.supervisor_id
         and s.team_role <> 'student' and s.ended_at is null
    ) then return false; end if;
  end if;

  return true;
end $$;

-- Pre-0066 append-only guard, copied from the live catalogue verbatim.
create or replace function public.block_contribution_rewrite()
returns trigger language plpgsql as $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content
     OR NEW.author_id IS DISTINCT FROM OLD.author_id
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.case_id IS DISTINCT FROM OLD.case_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'contributions are append-only: record a new contribution instead of rewriting'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

create trigger trg_block_contribution_rewrite
  before update on case_contributions
  for each row execute function block_contribution_rewrite();

alter table case_contributions enable row level security;

create policy "Active team read contributions" on case_contributions
  for select using (can_access_case_care_profile(case_id));
create policy "Admin read contributions" on case_contributions
  for select using (is_admin());
create policy "Author inserts own contribution" on case_contributions
  for insert with check (author_id = auth.uid() and can_access_case_care_profile(case_id));

-- RLS only bites for a role that does not own the tables.
create role authenticated;
grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on
  profiles, practitioners, client_cases, case_team_roles,
  client_practitioner_links, case_contributions,
  test_eligibility, test_access_consent
  to authenticated;
