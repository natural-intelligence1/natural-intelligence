-- ─── 0071_effective_test_authority.sql ──────────────────────────────────────
-- Admin Cockpit WP2. Controlled pre-launch testing authority.
--
-- Number check: the applied catalogue ends at 20261126024012 = 0070. 0071 is
-- unused in every ref. 0055 stays quarantined in supabase/deferred/; 0061 and
-- 0062 remain unapplied on their feature branches and are untouched here.
--
-- APPLYING THIS MIGRATION DOES NOT ENABLE ANYTHING.
--
-- testing_mode.enabled stays false. Every mechanism below is inert until the
-- Founder flips that one row, and the flip is itself audited and locked
-- against in-flight signatures.
--
-- THE MODEL
--
--   master switch ON + test identity + test case + assigned case role
--
-- No test privileges table. Authority to ACT comes from the case-team role a
-- person actually holds; the switch and the two test designations only decide
-- whether missing professional EVIDENCE may be set aside while they hold it.
--
-- WHAT IS NEVER SET ASIDE
--
-- Authentication, individual identity attribution, case-team membership,
-- consent, role-specific authority, case isolation, and signed-record
-- immutability. Those are not eligibility questions and the override never
-- reaches them.
--
-- WHAT "OVERRIDE SCOPE" MEANS, AND WHY THE LINE IS WHERE IT IS
--
-- Only ABSENT evidence may be overridden: no category set, no credential on
-- file, no approved scope, no indemnity, no agreement acceptance. An ADVERSE
-- finding never may: a revoked credential, a suspended or revoked scope, an
-- outstanding DBS, an inactive practitioner, or the Category 3 Lead
-- restriction. The first group means "we have not collected this yet", which
-- is exactly the Founder's position before launch. The second means "somebody
-- looked and said no", and a testing switch must not be able to unsay it.

-- ─── 1. OVERRIDE SCOPE ──────────────────────────────────────────────────────

create or replace function public.overridable_eligibility_blockers()
returns text[]
language sql
immutable
as $$
  select array[
    -- Absent professional evidence. Not yet collected.
    'practitioner_class_not_set',
    'credential_missing',
    'credentials_not_verified',
    'scope_missing',
    'scope_not_approved',
    'scope_role_not_permitted',
    'indemnity_missing',
    'indemnity_unverified',
    'indemnity_requirement_unknown',
    'indemnity_insufficient',
    'no_current_agreement_acceptance'
  ]::text[];
$$;

comment on function public.overridable_eligibility_blockers() is
  'The ONLY professional-eligibility failures a Founder test override may set aside: absent evidence. Adverse findings (revoked, suspended, expired, dbs_outstanding, not_active, role_not_permitted_for_category) are deliberately absent and can never be overridden.';

-- ─── 2. ACTION → ROLE MAPPING. UNKNOWN ACTIONS FAIL CLOSED ──────────────────
-- NULL means "this action is not recognised", and every caller treats NULL as
-- a refusal. That is the same shape practitioner_eligibility already uses for
-- an unknown role, so the two fail the same way.

create or replace function public.case_action_roles(p_action text)
returns text[]
language sql
immutable
as $$
  select case p_action
    when 'case_read'            then array['lead','care_team','student']
    when 'case_taking_edit'     then array['lead','care_team','student']
    when 'case_taking_submit'   then array['lead','care_team','student']
    when 'case_taking_sign'     then array['lead']
    when 'coordination_review'  then array['lead']
    when 'contribute'           then array['lead','care_team','student']
    else null
  end::text[];
$$;

comment on function public.case_action_roles(text) is
  'Which case-team roles may perform an action. NULL for an unrecognised action, so unknown actions fail closed.';

-- ─── 3. LOCK ORDER ──────────────────────────────────────────────────────────
-- Two advisory locks, always taken GLOBAL-THEN-CASE. A signature takes both;
-- so does a switch change, a designation change and a role change. Taking them
-- in one order everywhere is what stops two of these deadlocking, and taking
-- the global one at all is what stops a signature completing on authority the
-- Founder has just withdrawn.

create or replace function public.lock_testing_authority()
returns void
language sql
volatile
as $$
  select pg_advisory_xact_lock(hashtextextended('ni.testing_authority', 0));
$$;

create or replace function public.lock_case(p_case_id uuid)
returns void
language sql
volatile
as $$
  select pg_advisory_xact_lock(hashtextextended('ni.case:' || p_case_id::text, 0));
$$;

-- ─── 4. THE INTERNAL EFFECTIVE-ELIGIBILITY HELPER ───────────────────────────
-- Takes an actor id, so it is NOT granted to clients: that parameter is how a
-- caller would ask about somebody else. Only SECURITY DEFINER functions owned
-- by postgres reach it, and they pass auth.uid(). The public entry point in
-- section 5 takes no actor at all.

create or replace function public.effective_eligibility(
  p_actor uuid,
  p_case_id uuid,
  p_case_role text
)
returns table (
  actual_eligible    boolean,
  actual_blockers    text[],
  effective_eligible boolean,
  override_used      boolean,
  override_active    boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_switch     boolean;
  v_actor_test boolean;
  v_case_test  boolean;
  v_unscoped   text[];
begin
  select t.enabled into v_switch from public.testing_mode t;
  override_active := coalesce(v_switch, false);

  select e.eligible, e.blockers
    into actual_eligible, actual_blockers
    from public.practitioner_eligibility(p_actor, p_case_role) e;

  actual_eligible := coalesce(actual_eligible, false);
  actual_blockers := coalesce(actual_blockers, array['eligibility_unavailable']::text[]);

  -- Genuinely eligible: the override is not consulted and not recorded.
  if actual_eligible then
    effective_eligible := true;
    override_used := false;
    return next;
    return;
  end if;

  effective_eligible := false;
  override_used := false;

  if not override_active then
    return next; return;
  end if;

  select p.is_test_data into v_actor_test from public.profiles p where p.id = p_actor;
  if coalesce(v_actor_test, false) is not true then
    return next; return;
  end if;

  select c.is_test_data into v_case_test from public.client_cases c where c.id = p_case_id;
  if coalesce(v_case_test, false) is not true then
    return next; return;
  end if;

  -- Every failure must be inside the approved scope. One adverse finding and
  -- the whole decision stands: this is not a per-blocker waiver.
  select coalesce(array_agg(b), '{}')
    into v_unscoped
    from unnest(actual_blockers) b
   where b <> all (public.overridable_eligibility_blockers());

  if cardinality(v_unscoped) > 0 then
    return next; return;
  end if;

  effective_eligible := true;
  override_used := true;
  return next;
end $$;

revoke execute on function public.effective_eligibility(uuid, uuid, text) from public;
revoke execute on function public.effective_eligibility(uuid, uuid, text) from anon;
revoke execute on function public.effective_eligibility(uuid, uuid, text) from authenticated;

comment on function public.effective_eligibility(uuid, uuid, text) is
  'INTERNAL. Actual vs effective eligibility for one actor, case and role. Not granted to clients because it takes an actor id; the public entry point is effective_case_authority(case, action), which uses auth.uid().';

-- ─── 5. THE PUBLIC ENTRY POINT — NO ACTOR PARAMETER ─────────────────────────
-- The actor is auth.uid() and cannot be supplied. An authority function that
-- accepts an actor id is a function that can be asked to decide about someone
-- else; omitting the parameter removes the question rather than guarding it.

create or replace function public.effective_case_authority(
  p_case_id uuid,
  p_action text
)
returns table (
  authorised         boolean,
  refusal            text,
  case_role          text,
  action             text,
  actual_eligible    boolean,
  actual_blockers    text[],
  effective_eligible boolean,
  override_used      boolean,
  override_active    boolean
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  v_actor   uuid := auth.uid();
  v_roles   text[];
  v_role    record;
  v_client  uuid;
  v_elig    record;
begin
  authorised := false; override_used := false; override_active := false;
  actual_eligible := false; effective_eligible := false;
  actual_blockers := '{}'; action := p_action; case_role := null;

  if v_actor is null then
    refusal := 'no_authenticated_actor'; return next; return;
  end if;

  v_roles := public.case_action_roles(p_action);
  if v_roles is null then
    refusal := 'action_unknown'; return next; return;
  end if;

  select c.client_id into v_client from public.client_cases c where c.id = p_case_id;
  if v_client is null then
    refusal := 'case_not_found'; return next; return;
  end if;

  -- Case-team membership. Never overridden.
  select * into v_role from public.case_team_roles r
   where r.case_id = p_case_id and r.practitioner_id = v_actor and r.ended_at is null
   limit 1;
  if not found then
    refusal := 'no_active_case_role'; return next; return;
  end if;
  case_role := v_role.team_role;

  -- Role-specific authority. Never overridden.
  if not (case_role = any (v_roles)) then
    refusal := 'role_not_permitted_for_action'; return next; return;
  end if;

  -- The care link, as can_access_case_care_profile requires it.
  if not exists (
    select 1 from public.client_practitioner_links l
     where l.client_id = v_client and l.practitioner_id = v_actor and l.ended_at is null
  ) then
    refusal := 'no_care_link'; return next; return;
  end if;

  -- Consent. Never overridden.
  if not public.has_practitioner_access_consent(v_client, v_actor) then
    refusal := 'no_consent'; return next; return;
  end if;

  -- Student supervision. Never overridden.
  if case_role = 'student' then
    if v_role.supervisor_id is null or not exists (
      select 1 from public.case_team_roles s
       where s.case_id = p_case_id and s.practitioner_id = v_role.supervisor_id
         and s.team_role <> 'student' and s.ended_at is null
    ) then
      refusal := 'student_supervisor_missing'; return next; return;
    end if;
  end if;

  select * into v_elig from public.effective_eligibility(v_actor, p_case_id, case_role);
  actual_eligible := v_elig.actual_eligible;
  actual_blockers := v_elig.actual_blockers;
  effective_eligible := v_elig.effective_eligible;
  override_used := v_elig.override_used;
  override_active := v_elig.override_active;

  if not effective_eligible then
    refusal := 'not_eligible'; return next; return;
  end if;

  authorised := true;
  refusal := null;
  return next;
end $$;

revoke execute on function public.effective_case_authority(uuid, text) from public;
revoke execute on function public.effective_case_authority(uuid, text) from anon;
grant execute on function public.effective_case_authority(uuid, text) to authenticated, service_role;

comment on function public.effective_case_authority(uuid, text) is
  'The one authorisation question for a case action. Actor is auth.uid() and cannot be supplied. Distinguishes actual from effective eligibility, names the blockers, says whether override authority was necessary, and fails closed on unknown actions and roles.';

-- ─── 6. CASE ACCESS — ONE FUNCTION, SEVEN POLICIES ──────────────────────────
-- Seven RLS policies delegate here (care_plan_coordination, case_analysis_plan,
-- case_contributions SELECT and INSERT, case_events, case_taking_answers,
-- case_taking_sessions). Changing this one function reaches all of them, so no
-- policy is edited and none can drift from the others.
--
-- Every existing restriction is kept in the same order. Only the eligibility
-- line changes, from actual to effective.

create or replace function public.can_access_case_care_profile(p_case_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path to 'public'
as $$
DECLARE
  v_client UUID;
  v_role RECORD;
  v_elig RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;

  SELECT client_id INTO v_client FROM public.client_cases WHERE id = p_case_id;
  IF v_client IS NULL THEN RETURN FALSE; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.client_practitioner_links l
     WHERE l.client_id = v_client AND l.practitioner_id = auth.uid()
       AND l.ended_at IS NULL
  ) THEN RETURN FALSE; END IF;

  SELECT * INTO v_role FROM public.case_team_roles
   WHERE case_id = p_case_id AND practitioner_id = auth.uid() AND ended_at IS NULL
   LIMIT 1;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  -- EFFECTIVE eligibility for the role actually held. Under testing mode, on a
  -- designated test case, for a test identity whose only failures are absent
  -- evidence, this passes where actual eligibility does not. Nothing else about
  -- the chain moves.
  SELECT * INTO v_elig
    FROM public.effective_eligibility(auth.uid(), p_case_id, v_role.team_role);
  IF v_elig.effective_eligible IS NOT TRUE THEN RETURN FALSE; END IF;

  IF NOT public.has_practitioner_access_consent(v_client, auth.uid()) THEN RETURN FALSE; END IF;

  IF v_role.team_role = 'student' THEN
    IF v_role.supervisor_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.case_team_roles s
       WHERE s.case_id = p_case_id AND s.practitioner_id = v_role.supervisor_id
         AND s.team_role <> 'student' AND s.ended_at IS NULL
    ) THEN RETURN FALSE; END IF;
  END IF;

  RETURN TRUE;
END;
$$;

-- ─── 7. ADMINISTRATIVE AUDIT ────────────────────────────────────────────────
-- The actor is ALWAYS passed in, never read from auth.uid(). WP0 found five
-- audit rows with a NULL actor precisely because the service-role path has no
-- uid, and these are the events where that would matter most.

create or replace function public.record_admin_audit(
  p_actor uuid,
  p_actor_role text,
  p_action text,
  p_resource_type text,
  p_resource_id uuid,
  p_metadata jsonb
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  insert into public.audit_logs (id, actor_id, actor_role, action, resource_type, resource_id, metadata)
  values (gen_random_uuid(), p_actor, p_actor_role, p_action, p_resource_type, p_resource_id,
          coalesce(p_metadata, '{}'::jsonb));
end $$;

revoke execute on function public.record_admin_audit(uuid, text, text, text, uuid, jsonb) from public;
revoke execute on function public.record_admin_audit(uuid, text, text, text, uuid, jsonb) from anon;
revoke execute on function public.record_admin_audit(uuid, text, text, text, uuid, jsonb) from authenticated;

-- ─── 8. TEST DESIGNATION PROTECTION ─────────────────────────────────────────
-- A designation change is an authority change: it decides which cases and
-- which people the override can ever reach. So it needs the same lock as
-- signing, an admin actor, and an audit row.

create or replace function public.guard_profile_test_designation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_actor uuid := auth.uid();
begin
  if new.is_test_data is not distinct from old.is_test_data then
    return new;
  end if;

  -- Service-role/system path (no uid) is left to the application; an
  -- authenticated caller must be an admin. A user can never flag themselves.
  if v_actor is not null then
    if not exists (select 1 from public.profiles p where p.id = v_actor and p.role = 'admin') then
      raise exception 'test designation: only an administrator may change a test designation'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  perform public.lock_testing_authority();

  perform public.record_admin_audit(
    v_actor, 'admin', 'profile.test_designation_changed', 'profiles', new.id,
    jsonb_build_object('outcome','applied','before',old.is_test_data,'after',new.is_test_data)
  );
  return new;
end $$;

drop trigger if exists trg_guard_profile_test_designation on public.profiles;
create trigger trg_guard_profile_test_designation
  before update on public.profiles
  for each row execute function public.guard_profile_test_designation();

create or replace function public.guard_case_test_designation()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_actor uuid := auth.uid();
begin
  if new.is_test_data is not distinct from old.is_test_data then
    return new;
  end if;

  if v_actor is not null then
    if not exists (select 1 from public.profiles p where p.id = v_actor and p.role = 'admin') then
      raise exception 'test designation: only an administrator may change a case test designation'
        using errcode = 'insufficient_privilege';
    end if;
  end if;

  perform public.lock_testing_authority();
  perform public.lock_case(new.id);

  perform public.record_admin_audit(
    v_actor, 'admin', 'case.test_designation_changed', 'client_cases', new.id,
    jsonb_build_object('outcome','applied','before',old.is_test_data,'after',new.is_test_data)
  );
  return new;
end $$;

drop trigger if exists trg_guard_case_test_designation on public.client_cases;
create trigger trg_guard_case_test_designation
  before update on public.client_cases
  for each row execute function public.guard_case_test_designation();

-- The switch itself takes the same global lock, so a flip cannot interleave
-- with a signature that has already read it.
create or replace function public.enforce_testing_mode_attribution()
returns trigger
language plpgsql
as $$
begin
  if new.changed_by is null then
    raise exception 'testing mode: a change must name the admin making it (changed_by)'
      using errcode = 'check_violation';
  end if;
  perform public.lock_testing_authority();
  new.changed_at := now();
  return new;
end $$;

-- ─── 9. ASSIGNMENT — BREAKING THE CIRCULARITY ───────────────────────────────
-- WP0 proved the deadlock: creating a role requires the eligibility the
-- override exists to supply, and case_team_roles holds no row to escape
-- through. The fix is to gate CREATING a role on different facts from
-- EXERCISING one.
--
--   creating   switch ON + test identity + test case + an ADMIN actor
--   exercising the role actually held, exactly as before
--
-- Nothing about holding a role appears in the creation condition, so there is
-- no circle. Every other rule stands: Category 3 Lead, student supervision,
-- and the existing partial unique indexes uniq_active_lead_per_case and
-- uniq_active_role_per_practitioner_case, which already make a repeated
-- "load test cast" idempotent rather than duplicating rows.

create or replace function public.enforce_case_team_role_rules()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
DECLARE
  v_category TEXT;
  v_eligible BOOLEAN;
  v_reasons  TEXT[];
  v_actor    UUID := auth.uid();
  v_elig     RECORD;
  v_switch   BOOLEAN;
  v_p_test   BOOLEAN;
  v_c_test   BOOLEAN;
  v_allowed  BOOLEAN := FALSE;
BEGIN
  IF NEW.ended_at IS NOT NULL THEN RETURN NEW; END IF; -- ending is always allowed

  SELECT e.eligible, e.blockers INTO v_eligible, v_reasons
    FROM public.practitioner_eligibility(NEW.practitioner_id, NEW.team_role) e;

  IF v_eligible IS NOT TRUE THEN
    -- A Founder-authorised test assignment. An ADMIN must be making it: there
    -- is deliberately no service-role path, because an unrestricted
    -- administrative bypass is exactly what this must not become.
    SELECT t.enabled INTO v_switch FROM public.testing_mode t;
    SELECT p.is_test_data INTO v_p_test FROM public.profiles p WHERE p.id = NEW.practitioner_id;
    SELECT c.is_test_data INTO v_c_test FROM public.client_cases c WHERE c.id = NEW.case_id;

    IF coalesce(v_switch, false)
       AND coalesce(v_p_test, false)
       AND coalesce(v_c_test, false)
       AND v_actor IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_actor AND p.role = 'admin')
    THEN
      -- Only absent evidence may be set aside, even here.
      SELECT * INTO v_elig
        FROM public.effective_eligibility(NEW.practitioner_id, NEW.case_id, NEW.team_role);
      v_allowed := v_elig.effective_eligible;
    END IF;

    IF NOT v_allowed THEN
      RAISE EXCEPTION 'care team: practitioner not assignable as %: %', NEW.team_role, array_to_string(v_reasons, ', ')
        USING ERRCODE = 'check_violation';
    END IF;

    PERFORM public.lock_testing_authority();
    PERFORM public.lock_case(NEW.case_id);
  END IF;

  -- Governance rules below are NEVER relaxed by testing mode.
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
$$;

-- The care link the access chain also requires, on the same conditions.
create or replace function public.enforce_practitioner_assignable()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
DECLARE
  v_eligible BOOLEAN;
  v_reasons  TEXT[];
  v_actor    UUID := auth.uid();
  v_switch   BOOLEAN;
  v_p_test   BOOLEAN;
  v_c_test   BOOLEAN;
BEGIN
  SELECT e.eligible, e.reasons INTO v_eligible, v_reasons
    FROM public.practitioner_assignment_eligibility(NEW.practitioner_id) e;

  IF v_eligible IS NOT TRUE THEN
    SELECT t.enabled INTO v_switch FROM public.testing_mode t;
    SELECT p.is_test_data INTO v_p_test FROM public.profiles p WHERE p.id = NEW.practitioner_id;
    SELECT p.is_test_data INTO v_c_test FROM public.profiles p WHERE p.id = NEW.client_id;

    IF NOT (coalesce(v_switch, false)
            AND coalesce(v_p_test, false)
            AND coalesce(v_c_test, false)
            AND v_actor IS NOT NULL
            AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_actor AND p.role = 'admin'))
    THEN
      RAISE EXCEPTION 'practitioner not assignable: %', array_to_string(v_reasons, ', ')
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Every role creation and ending is audited, with the actor named.
create or replace function public.audit_case_team_role_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid := coalesce(auth.uid(), case when tg_op = 'INSERT' then new.assigned_by else null end);
begin
  if tg_op = 'INSERT' then
    perform public.record_admin_audit(
      v_actor, 'admin', 'case_team_role.assigned', 'case_team_roles', new.id,
      jsonb_build_object('outcome','applied','case_id',new.case_id,
                         'practitioner_id',new.practitioner_id,'team_role',new.team_role,
                         'supervisor_id',new.supervisor_id)
    );
  elsif new.ended_at is distinct from old.ended_at and new.ended_at is not null then
    perform public.record_admin_audit(
      v_actor, 'admin', 'case_team_role.ended', 'case_team_roles', new.id,
      jsonb_build_object('outcome','applied','case_id',new.case_id,
                         'practitioner_id',new.practitioner_id,'team_role',new.team_role,
                         'end_reason',new.end_reason)
    );
  end if;
  return null;
end $$;

drop trigger if exists trg_audit_case_team_role on public.case_team_roles;
create trigger trg_audit_case_team_role
  after insert or update on public.case_team_roles
  for each row execute function public.audit_case_team_role_change();

-- ─── 10. PROVENANCE, NOW AWARE OF THE OVERRIDE ──────────────────────────────
-- 0070 recorded override_used as a constant false, which was true while no
-- override existed. It now asks the same helper the authority decision asks,
-- so the value is derived by the database rather than trusted from the caller
-- or passed through a transaction-local flag a direct writer could set.
--
-- 0070's file is NOT edited. This replaces the function it created, which is
-- what CREATE OR REPLACE is for.

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
  v_elig    record;
begin
  if new.signed_off_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.signed_off_at is not null then
    return new;
  end if;

  select t.enabled into v_switch from public.testing_mode t;
  new.override_active_at_signing := coalesce(v_switch, false);

  select c.is_test_data into v_is_test
    from public.client_cases c where c.id = new.case_id;
  new.is_test_output := coalesce(v_is_test, true);

  select r.team_role into v_role
    from public.case_team_roles r
   where r.case_id = new.case_id
     and r.practitioner_id = new.signed_off_by
     and r.ended_at is null
   limit 1;

  if v_role is null then
    raise exception 'case-taking sign-off: cannot record truthful provenance - the signer holds no active case-team role on this case'
      using errcode = 'insufficient_privilege';
  end if;
  new.effective_role := v_role;

  select * into v_elig
    from public.effective_eligibility(new.signed_off_by, new.case_id, v_role);
  new.override_used_at_signing := coalesce(v_elig.override_used, false);

  return new;
end $$;

-- ─── 11. ATOMIC SIGNING ─────────────────────────────────────────────────────
-- WP0 found the signing path checking authority in TypeScript and writing in a
-- separate round trip, with enforce_case_taking_authority() waving the
-- service role straight through. Both are closed here.
--
-- One statement sequence inside one transaction: locks, authority, state,
-- revision, write, provenance (by trigger), audit. The signature cannot
-- succeed on authority withdrawn after it was read, because the withdrawal
-- takes the same global lock.

create or replace function public.sign_case_taking_session(
  p_session_id uuid,
  p_expected_revision integer
)
returns table (signed boolean, refusal text, session_id uuid, override_used boolean)
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare
  v_actor uuid := auth.uid();
  v_s     record;
  v_auth  record;
begin
  signed := false; refusal := null; session_id := p_session_id; override_used := false;

  -- Closes the service-role bypass: no authenticated individual, no signature.
  if v_actor is null then
    refusal := 'no_authenticated_actor'; return next; return;
  end if;

  select * into v_s from public.case_taking_sessions s where s.id = p_session_id;
  if not found then
    refusal := 'session_not_found'; return next; return;
  end if;

  -- Global first, then case. Same order everywhere.
  perform public.lock_testing_authority();
  perform public.lock_case(v_s.case_id);

  -- Re-read under the locks: anything decided above may have moved.
  select * into v_s from public.case_taking_sessions s where s.id = p_session_id;

  if v_s.signed_off_at is not null then
    refusal := 'already_signed'; return next; return;
  end if;

  if v_s.state not in ('submitted_to_lead', 'lead_review', 'ready_for_sign_off') then
    refusal := 'state_forbids_sign_off'; return next; return;
  end if;

  if p_expected_revision is not null and v_s.revision is distinct from p_expected_revision then
    refusal := 'revision_changed'; return next; return;
  end if;

  select * into v_auth from public.effective_case_authority(v_s.case_id, 'case_taking_sign');
  if not v_auth.authorised then
    refusal := v_auth.refusal; return next; return;
  end if;
  override_used := v_auth.override_used;

  update public.case_taking_sessions
     set state = 'signed_off',
         signed_off_by = v_actor,
         signed_off_at = now()
   where id = p_session_id
     and signed_off_at is null
     and (p_expected_revision is null or revision = p_expected_revision);

  if not found then
    refusal := 'already_signed'; return next; return;
  end if;

  perform public.record_admin_audit(
    v_actor, v_auth.case_role, 'case_taking.signed', 'case_taking_sessions', p_session_id,
    jsonb_build_object('outcome','applied','case_id',v_s.case_id,
                       'effective_role',v_auth.case_role,
                       'override_used',v_auth.override_used,
                       'override_active',v_auth.override_active)
  );

  signed := true;
  return next;
end $$;

revoke execute on function public.sign_case_taking_session(uuid, integer) from public;
revoke execute on function public.sign_case_taking_session(uuid, integer) from anon;
grant execute on function public.sign_case_taking_session(uuid, integer) to authenticated, service_role;

-- The trigger keeps its own belt-and-braces role for end-user sessions, but it
-- no longer waves the service role through: a signature with no authenticated
-- actor is refused outright rather than silently permitted.
create or replace function public.enforce_case_taking_authority()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_elig record;
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
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
  end if;

  if new.signed_off_at is null
     or (tg_op = 'UPDATE' and new.signed_off_at is not distinct from old.signed_off_at
                          and new.signed_off_by is not distinct from old.signed_off_by) then
    return new;
  end if;

  -- A SIGNATURE always needs a named signer, whatever the connection.
  if new.signed_off_by is null then
    raise exception 'case-taking sign-off: a signature must name its signer'
      using errcode = 'insufficient_privilege';
  end if;

  if auth.uid() is not null and new.signed_off_by is distinct from auth.uid() then
    raise exception 'case-taking sign-off: a session may only be signed by the practitioner performing the action'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.case_team_roles
     where case_id = new.case_id and practitioner_id = new.signed_off_by
       and team_role = 'lead' and ended_at is null
  ) then
    raise exception 'case-taking sign-off: signer is not the active Lead Responsible Practitioner for this case'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_elig
    from public.effective_eligibility(new.signed_off_by, new.case_id, 'lead');
  if v_elig.effective_eligible is not true then
    raise exception 'case-taking sign-off: Lead no longer passes assignment eligibility'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end $$;

-- ─── 12. COORDINATION REVIEW ────────────────────────────────────────────────
-- Takes effective eligibility, per the WP2 brief. release_care_plan is
-- DELIBERATELY NOT CHANGED: it gates care-plan release, which is frozen, and
-- this mission must not enable blocked functionality.

create or replace function public.record_lead_coordination_review(p_case_id uuid, p_note text default null::text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
DECLARE
  v_auth RECORD;
  v_id UUID;
BEGIN
  SELECT * INTO v_auth FROM public.effective_case_authority(p_case_id, 'coordination_review');
  IF NOT v_auth.authorised THEN
    RAISE EXCEPTION 'coordination review: not authorised (%)', v_auth.refusal
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  INSERT INTO public.care_plan_coordination (case_id, lead_id, coordination_note)
  VALUES (p_case_id, auth.uid(), p_note)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ─── 13. ELIGIBILITY DISCLOSURE, AUTHENTICATED CALLERS ──────────────────────
-- WP1 closed anonymous access. An ordinary authenticated client could still
-- pass another practitioner's id and read their DBS, credential, scope and
-- indemnity blockers. Self-inspection and administrative inspection are
-- separated here, and the raw function stops being client-callable.

create or replace function public.my_practitioner_eligibility(p_case_role text default null)
returns table (
  eligible boolean, evaluated_role text, eligible_roles text[], blockers text[],
  category text, credential_state text, scope_state text, agreement_state text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null then return; end if;
  return query
    select e.eligible, e.evaluated_role, e.eligible_roles, e.blockers,
           e.category, e.credential_state, e.scope_state, e.agreement_state
      from public.practitioner_eligibility(auth.uid(), p_case_role) e;
end $$;

create or replace function public.admin_practitioner_eligibility(p_practitioner_id uuid, p_case_role text default null)
returns table (
  eligible boolean, evaluated_role text, eligible_roles text[], blockers text[],
  category text, credential_state text, scope_state text, agreement_state text
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  -- Inspecting someone else's evidence is an ADMIN act, and it is not the
  -- same thing as authority to act as them: this returns a verdict and grants
  -- nothing.
  if auth.uid() is null
     or not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  then
    raise exception 'eligibility inspection: administrator access required'
      using errcode = 'insufficient_privilege';
  end if;
  return query
    select e.eligible, e.evaluated_role, e.eligible_roles, e.blockers,
           e.category, e.credential_state, e.scope_state, e.agreement_state
      from public.practitioner_eligibility(p_practitioner_id, p_case_role) e;
end $$;

revoke execute on function public.my_practitioner_eligibility(text) from public;
revoke execute on function public.my_practitioner_eligibility(text) from anon;
grant execute on function public.my_practitioner_eligibility(text) to authenticated, service_role;

revoke execute on function public.admin_practitioner_eligibility(uuid, text) from public;
revoke execute on function public.admin_practitioner_eligibility(uuid, text) from anon;
grant execute on function public.admin_practitioner_eligibility(uuid, text) to authenticated, service_role;

-- The raw functions become internal: every in-database caller is SECURITY
-- DEFINER owned by postgres and reaches them regardless of these grants.
revoke execute on function public.practitioner_eligibility(uuid, text) from authenticated;
revoke execute on function public.practitioner_assignment_eligibility(uuid) from authenticated;
