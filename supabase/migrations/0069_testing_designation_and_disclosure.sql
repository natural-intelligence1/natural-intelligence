-- ─── 0069_testing_designation_and_disclosure.sql ────────────────────────────
-- Admin Cockpit WP1. Infrastructure only. Grants no authority to anyone.
--
-- Number check at time of writing: the applied catalogue ends at
-- 20261108030204 = 0068_complete_intake_with_case. 0069 is unused in every
-- local and remote ref. 0061 and 0062 exist only on feature branches and are
-- frozen; 0055 was quarantined to supabase/deferred/ in this work package.
--
-- WHAT THIS DOES
--
--   1. A single master testing switch, OFF, with attribution for every change.
--   2. An authoritative new-case test default, applied by trigger so it covers
--      every case-creation path rather than one of them.
--   3. An explicit client_cases.is_test_data designation, set only on the
--      verified inventory of three cases named below.
--   4. The remaining four undesignated profiles marked as test data.
--   5. The pre-existing anonymous eligibility disclosure closed.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
--
-- There is no test privileges table, no override mechanism, no change to any
-- eligibility rule, and no change to professional evidence. After this
-- migration every practitioner is exactly as (in)eligible as before, and
-- practitioner_eligibility() returns byte-identical verdicts. Test
-- classification on its own confers nothing: authority still requires a real
-- case_team_roles row, which still requires real eligibility.
--
-- No BEGIN/COMMIT envelope: the migration tool supplies its own transaction,
-- and a nested COMMIT would break atomicity. The file and the applied text are
-- therefore identical, which earlier migrations could not claim.

-- ─── 1. THE MASTER TESTING SWITCH ───────────────────────────────────────────
-- One row, enforced by a boolean primary key that may only be true. A settings
-- table that can hold two rows is a settings table that will eventually
-- disagree with itself.
--
-- It lives in the database, not in an environment variable, because the
-- eligibility functions that will eventually consult it are PostgreSQL
-- functions and cannot read the application's environment. That is also why
-- its state is observable: an env var's live value cannot be verified from a
-- session, as WP0 found when the Vercel API refused to list it.

create table if not exists public.testing_mode (
  id                      boolean     primary key default true,
  enabled                 boolean     not null    default false,
  new_cases_default_test  boolean     not null    default true,
  changed_by              uuid        references public.profiles(id) on delete set null,
  changed_at              timestamptz not null    default now(),
  constraint testing_mode_singleton check (id)
);

comment on table  public.testing_mode is
  'Single-row control for Founder testing mode. enabled stays false until WP2 and WP3 are verified and the Founder authorises activation.';
comment on column public.testing_mode.enabled is
  'The master testing switch. OFF. No override authority exists until WP2 implements it; this column is inert infrastructure.';
comment on column public.testing_mode.new_cases_default_test is
  'The ONE authoritative source for whether a newly created case is test data. Applied by trigger on client_cases, so it covers every creation path. Must be set false at launch.';

-- Seed the singleton. OFF, and new cases default to test until launch.
insert into public.testing_mode (id, enabled, new_cases_default_test)
values (true, false, true)
on conflict (id) do nothing;

-- Readable by admins so the Cockpit can show testing state in WP3. There is
-- deliberately NO insert, update or delete policy: with RLS on and no write
-- policy, no authenticated user can flip the switch. Only the service role or
-- the table owner can, which keeps activation a deliberate act.
alter table public.testing_mode enable row level security;

drop policy if exists "Admins read testing mode" on public.testing_mode;
create policy "Admins read testing mode" on public.testing_mode
  for select using (
    exists (select 1 from public.profiles p
             where p.id = auth.uid() and p.role = 'admin')
  );

-- ─── 2. WHO CHANGED THE SWITCH, AND WHEN ────────────────────────────────────
-- Attribution is mandatory, not best effort. A switch change with no named
-- actor is refused outright.
--
-- The actor is taken from changed_by, which the caller must supply, and NOT
-- from auth.uid(). WP0 found audit_logs holding five rows with a NULL actor
-- precisely because auth.uid() is NULL on the service-role path. Reading the
-- actor from the session would reproduce that bug for the most
-- security-relevant event in the system.

create or replace function public.enforce_testing_mode_attribution()
returns trigger
language plpgsql
as $$
begin
  if new.changed_by is null then
    raise exception 'testing mode: a change must name the admin making it (changed_by)'
      using errcode = 'check_violation';
  end if;
  new.changed_at := now();
  return new;
end $$;

drop trigger if exists trg_testing_mode_attribution on public.testing_mode;
create trigger trg_testing_mode_attribution
  before update on public.testing_mode
  for each row execute function public.enforce_testing_mode_attribution();

-- Every switch change is recorded. audit_logs has no outcome column, so this
-- establishes the convention WP0 recommended: a required 'outcome' key in
-- metadata. An override-assisted action that was REFUSED must be
-- distinguishable from one that never happened, and only an explicit outcome
-- can do that.
create or replace function public.audit_testing_mode_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.audit_logs (id, actor_id, actor_role, action, resource_type, resource_id, metadata)
  values (
    gen_random_uuid(),
    new.changed_by,
    'admin',
    'testing_mode.changed',
    'testing_mode',
    null,
    jsonb_build_object(
      'outcome',                    'applied',
      'enabled_before',             old.enabled,
      'enabled_after',              new.enabled,
      'new_cases_default_before',   old.new_cases_default_test,
      'new_cases_default_after',    new.new_cases_default_test
    )
  );
  return null;
end $$;

drop trigger if exists trg_testing_mode_audit on public.testing_mode;
create trigger trg_testing_mode_audit
  after update on public.testing_mode
  for each row execute function public.audit_testing_mode_change();

-- ─── 3. EXPLICIT CASE DESIGNATION ───────────────────────────────────────────
-- WP0 established that client_cases had no test designation at all, and that
-- test status could only be inferred from the client's profile. Inference
-- cannot express a real client's test case, and the Founder's rule that
-- unclassified cases are excluded from override access needs a positive
-- per-case fact rather than the absence of one.

alter table public.client_cases
  add column if not exists is_test_data boolean;

comment on column public.client_cases.is_test_data is
  'Explicit test designation. Supplied on insert by trg_client_cases_test_default from testing_mode.new_cases_default_test. A case that is not designated is excluded from any future override access.';

-- The verified inventory, enumerated. These are the three cases that existed
-- at WP0 verification and were re-confirmed unchanged at WP1 preflight; the
-- Founder has confirmed all current data is his own or family test data.
--
-- Enumerated rather than applied as a blanket default ON PURPOSE. A case that
-- arrives between verification and application is NOT in this list, so it is
-- left undesignated rather than silently classified as test — which is the
-- safe direction, because undesignated means excluded.
update public.client_cases
   set is_test_data = true
 where id in (
   '10d4456a-5cc7-4c48-a035-0d6ed134c7c9',  -- 6 May 2026,  status active
   'cccccccc-0000-4000-8000-000000000003',  -- 11 May 2026, status active
   '37603918-6b60-4800-918e-9fa9190f6eb5'   -- 8 Nov 2026,  Tree Khan, intake_complete
 );

-- Anything not in that list is explicitly NOT designated.
update public.client_cases
   set is_test_data = false
 where is_test_data is null;

alter table public.client_cases
  alter column is_test_data set not null;

-- No column DEFAULT. The setting is the single authoritative source, and a
-- column default would be a second one that could disagree with it.
--
-- A trigger rather than a default because WP0 found TWO case-creation paths:
-- complete_intake_with_case() (the atomic Intake completion) and the direct
-- insert in packages/db/src/crt/getOrCreateClientCase.ts. A trigger covers
-- both, and any path added later, without either knowing about this rule.
--
-- It fills the value only when the caller did not supply one, so an explicit
-- designation always wins. BEFORE triggers run ahead of the NOT NULL check,
-- so a caller omitting the column is filled in rather than rejected.
create or replace function public.apply_new_case_test_default()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_default boolean;
begin
  if new.is_test_data is null then
    select t.new_cases_default_test into v_default from public.testing_mode t;
    -- Fail safe: with no setting row, treat the case as test. Never claim a
    -- case is genuine clinical data on the strength of a missing row.
    new.is_test_data := coalesce(v_default, true);
  end if;
  return new;
end $$;

drop trigger if exists trg_client_cases_test_default on public.client_cases;
create trigger trg_client_cases_test_default
  before insert on public.client_cases
  for each row execute function public.apply_new_case_test_default();

-- ─── 4. REMAINING PROFILE DESIGNATION ───────────────────────────────────────
-- Six of ten profiles were already designated. These are the four that were
-- not, enumerated for the same reason as the cases above. Roles are recorded
-- in the comments; no names appear in this migration.
update public.profiles
   set is_test_data = true
 where id in (
   '1854aa09-d732-4627-af19-729ec18654d7',  -- role admin, 3 Apr 2026 (the Founder)
   '87f1bb3a-c14b-4ac6-af44-c89febf5774a',  -- role user,  3 Apr 2026
   '01048cd3-55c7-4d32-a55a-72edb5302448',  -- role user,  5 Apr 2026
   'd9e6e127-024b-4993-a522-184ad4fa00d0'   -- role user,  6 Apr 2026
 );

-- ─── 5. ANONYMOUS ELIGIBILITY DISCLOSURE ────────────────────────────────────
-- Pre-existing, found in WP0, and unrelated to testing mode.
--
-- practitioner_eligibility(uuid, text) is SECURITY DEFINER, takes an arbitrary
-- practitioner id, and had EXECUTE granted to PUBLIC. Its blockers name
-- dbs_outstanding, credential_revoked, scope_suspended, indemnity_expired and
-- the rest, so any anonymous caller could read professional-conduct and
-- insurance status about a named, identifiable practitioner.
--
-- Safe to revoke, verified rather than assumed: all seven in-database callers
-- (practitioner_assignment_eligibility, can_access_case_care_profile,
-- enforce_case_team_role_rules, enforce_case_taking_authority,
-- enforce_protocol_signature_authority, record_lead_coordination_review and
-- release_care_plan) are SECURITY DEFINER owned by postgres, so they execute
-- it as postgres and never consult the caller's grants. No view and no RLS
-- policy references it. The only direct callers are two application RPC calls,
-- which run as authenticated or service_role.
--
-- The grants are re-stated explicitly afterwards so the end state is declared
-- rather than left to be whatever the revokes happened to leave behind.

revoke execute on function public.practitioner_eligibility(uuid, text) from public;
revoke execute on function public.practitioner_eligibility(uuid, text) from anon;

revoke execute on function public.practitioner_assignment_eligibility(uuid) from public;
revoke execute on function public.practitioner_assignment_eligibility(uuid) from anon;

grant execute on function public.practitioner_eligibility(uuid, text) to authenticated, service_role;
grant execute on function public.practitioner_assignment_eligibility(uuid) to authenticated, service_role;
