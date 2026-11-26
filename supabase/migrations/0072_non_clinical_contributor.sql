-- ─── 0072_non_clinical_contributor.sql ──────────────────────────────────────
-- Admin Cockpit WP2. The Coach, as a bounded NON-CLINICAL contributor.
--
-- Apply only after 0071, whose effective_eligibility() and case_action_roles()
-- this migration replaces.
--
-- WHY A NEW ROLE WAS GENUINELY NECESSARY
--
-- Checked first, as the brief requires. There is no existing mechanism:
-- case_team_roles_team_role_check permits exactly lead, care_team and student,
-- and practitioner_eligibility() returns 'role_unknown' for anything outside
-- that same three. A Coach given one of the clinical roles would inherit
-- clinical authority, which is the one outcome that must not happen — so the
-- answer is a fourth role with its own, narrower rules, not a borrowed one.
--
-- 0064 IS NOT TOUCHED
--
-- The clinical eligibility spine keeps its exact behaviour for lead, care_team
-- and student. A contributor never reaches it: 0071's effective_eligibility()
-- routes that role to contributor_eligibility() instead. So "keep the existing
-- clinical eligibility rules unchanged for clinical roles" is achieved by not
-- editing the function that holds them, rather than by editing it carefully.
--
-- WHAT NON-CLINICAL DOES NOT MEAN
--
-- It does not mean unverified and it does not mean unbounded. A Coach still
-- needs an active practitioner record, a clear safeguarding check and an
-- approved scope that names the contributor role. What they do NOT need is a
-- clinical category, a clinical credential or clinical indemnity, because they
-- do no clinical work.

-- ─── 1. THE ROLE EXISTS ─────────────────────────────────────────────────────

alter table public.case_team_roles
  drop constraint if exists case_team_roles_team_role_check;
alter table public.case_team_roles
  add constraint case_team_roles_team_role_check
  check (team_role = any (array['lead','care_team','student','contributor']));

comment on column public.case_team_roles.team_role is
  'lead, care_team and student are clinical. contributor is the non-clinical Coach: assigned to a case, able to read what their work needs and to record bounded non-clinical contributions, and able to do nothing clinical at all.';

-- NOTE, DELIBERATELY: case_taking_sessions.case_taking_effective_role_valid is
-- NOT widened. A signature can therefore only ever record lead, care_team or
-- student, which makes "a Coach cannot sign" a property of the schema rather
-- than a rule somebody has to remember to check.

-- ─── 2. NON-CLINICAL ELIGIBILITY ────────────────────────────────────────────
-- Identity, safeguarding and approved scope. No category, no clinical
-- credential, no indemnity floor — a Coach carries none of those because they
-- do none of that work, and demanding them would be theatre.
--
-- The blockers it returns are drawn from the SAME vocabulary 0064 uses, so
-- 0071's override scope applies to them unchanged: absent scope may be set
-- aside under testing mode, an inactive practitioner or an outstanding
-- safeguarding check never may.

create or replace function public.contributor_eligibility(p_practitioner_id uuid)
returns table (eligible boolean, blockers text[])
language plpgsql
stable
security definer
set search_path to 'public'
as $$
declare
  pr RECORD;
  sc RECORD;
  b  text[] := '{}';
begin
  select * into pr from public.practitioners where id = p_practitioner_id;
  if not found then
    eligible := false; blockers := array['practitioner_not_found']; return next; return;
  end if;

  if pr.status <> 'active' or pr.is_active is not true then
    b := array_append(b, 'practitioner_not_active');
  end if;

  -- A Coach meets clients. Safeguarding is not a clinical requirement and is
  -- never waived for being non-clinical.
  if pr.dbs_status in ('required','pending','flagged') then
    b := array_append(b, 'dbs_outstanding');
  end if;

  select * into sc from public.practitioner_scope
   where practitioner_id = p_practitioner_id and superseded_at is null;
  if not found then
    b := array_append(b, 'scope_missing');
  elsif sc.status = 'suspended' then
    b := array_append(b, 'scope_suspended');
  elsif sc.status = 'revoked' then
    b := array_append(b, 'scope_revoked');
  elsif sc.status <> 'approved' then
    b := array_append(b, 'scope_not_approved');
  elsif not ('contributor' = any (sc.permitted_roles)) then
    b := array_append(b, 'scope_role_not_permitted');
  end if;

  eligible := cardinality(b) = 0;
  blockers := b;
  return next;
end $$;

revoke execute on function public.contributor_eligibility(uuid) from public;
revoke execute on function public.contributor_eligibility(uuid) from anon;
revoke execute on function public.contributor_eligibility(uuid) from authenticated;

-- ─── 3. ROUTE THE ROLE ──────────────────────────────────────────────────────

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

  if p_case_role = 'contributor' then
    -- Non-clinical. Never reaches the clinical spine.
    select c.eligible, c.blockers into actual_eligible, actual_blockers
      from public.contributor_eligibility(p_actor) c;
  else
    select e.eligible, e.blockers into actual_eligible, actual_blockers
      from public.practitioner_eligibility(p_actor, p_case_role) e;
  end if;

  actual_eligible := coalesce(actual_eligible, false);
  actual_blockers := coalesce(actual_blockers, array['eligibility_unavailable']::text[]);

  if actual_eligible then
    effective_eligible := true; override_used := false; return next; return;
  end if;

  effective_eligible := false;
  override_used := false;

  if not override_active then return next; return; end if;

  select p.is_test_data into v_actor_test from public.profiles p where p.id = p_actor;
  if coalesce(v_actor_test, false) is not true then return next; return; end if;

  select c.is_test_data into v_case_test from public.client_cases c where c.id = p_case_id;
  if coalesce(v_case_test, false) is not true then return next; return; end if;

  select coalesce(array_agg(b), '{}') into v_unscoped
    from unnest(actual_blockers) b
   where b <> all (public.overridable_eligibility_blockers());

  if cardinality(v_unscoped) > 0 then return next; return; end if;

  effective_eligible := true;
  override_used := true;
  return next;
end $$;

-- What a Coach may be asked to do. Reading what their work needs, and
-- recording a contribution. Nothing else: no case-taking edit, no submit, no
-- sign, no coordination review.
create or replace function public.case_action_roles(p_action text)
returns text[]
language sql
immutable
as $$
  select case p_action
    when 'case_read'            then array['lead','care_team','student','contributor']
    when 'case_taking_edit'     then array['lead','care_team','student']
    when 'case_taking_submit'   then array['lead','care_team','student']
    when 'case_taking_sign'     then array['lead']
    when 'coordination_review'  then array['lead']
    when 'contribute'           then array['lead','care_team','student','contributor']
    else null
  end::text[];
$$;

-- ─── 4. ASSIGNMENT ──────────────────────────────────────────────────────────
-- A contributor needs no supervisor and is not subject to the Category 3 Lead
-- rule, because neither applies to a non-clinical role. Everything else is
-- unchanged, including the Founder-authorised test path from 0071.

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
  IF NEW.ended_at IS NOT NULL THEN RETURN NEW; END IF;

  IF NEW.team_role = 'contributor' THEN
    SELECT c.eligible, c.blockers INTO v_eligible, v_reasons
      FROM public.contributor_eligibility(NEW.practitioner_id) c;
  ELSE
    SELECT e.eligible, e.blockers INTO v_eligible, v_reasons
      FROM public.practitioner_eligibility(NEW.practitioner_id, NEW.team_role) e;
  END IF;

  IF v_eligible IS NOT TRUE THEN
    SELECT t.enabled INTO v_switch FROM public.testing_mode t;
    SELECT p.is_test_data INTO v_p_test FROM public.profiles p WHERE p.id = NEW.practitioner_id;
    SELECT c.is_test_data INTO v_c_test FROM public.client_cases c WHERE c.id = NEW.case_id;

    IF coalesce(v_switch, false)
       AND coalesce(v_p_test, false)
       AND coalesce(v_c_test, false)
       AND v_actor IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_actor AND p.role = 'admin')
    THEN
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
       WHERE s.case_id = NEW.case_id AND s.practitioner_id = NEW.supervisor_id
         AND s.team_role <> 'student' AND s.ended_at IS NULL
    ) THEN
      RAISE EXCEPTION 'care team: a Student Practitioner requires a named supervisor holding an active role on the same case'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- The care link has to admit a Coach too. enforce_practitioner_assignable()
-- guards client_practitioner_links, which carries no case and no role, so it
-- can only ask "may this practitioner work with this client at all?". Asked
-- only of the CLINICAL spine, that question refuses every Coach — they have no
-- category and no clinical credential by design, so a scoped Coach could never
-- be linked even in production, with testing mode irrelevant.
--
-- So the question becomes "assignable in ANY capacity": clinical OR
-- non-clinical. A person with neither is still refused.

create or replace function public.enforce_practitioner_assignable()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions'
as $$
DECLARE
  v_eligible BOOLEAN;
  v_reasons  TEXT[];
  v_contrib  BOOLEAN;
  v_actor    UUID := auth.uid();
  v_switch   BOOLEAN;
  v_p_test   BOOLEAN;
  v_c_test   BOOLEAN;
BEGIN
  SELECT e.eligible, e.reasons INTO v_eligible, v_reasons
    FROM public.practitioner_assignment_eligibility(NEW.practitioner_id) e;

  IF v_eligible IS NOT TRUE THEN
    SELECT c.eligible INTO v_contrib
      FROM public.contributor_eligibility(NEW.practitioner_id) c;
    v_eligible := coalesce(v_contrib, false);
  END IF;

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

-- ─── 5. THE CLINICAL WRITE BOUNDARY ─────────────────────────────────────────
-- THIS IS THE PART THE CENTRAL FUNCTION COULD NOT EXPRESS.
--
-- case_taking_sessions_access and case_taking_answers_access are FOR ALL via
-- can_access_case_care_profile(). A contributor passes that function — they
-- must, or they could not read the case they are assigned to — so leaving the
-- policies FOR ALL would let a Coach edit clinical case-taking answers, which
-- the brief forbids outright.
--
-- The distinction is per-table and per-role, which no single access function
-- can carry. So the two policies are split: SELECT stays as it was, and writes
-- additionally require a CLINICAL role. This is the one place where widening
-- the policies is the right answer rather than a shortcut.

create or replace function public.has_clinical_case_role(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.case_team_roles r
     where r.case_id = p_case_id
       and r.practitioner_id = auth.uid()
       and r.ended_at is null
       and r.team_role in ('lead','care_team','student')
  );
$$;

drop policy if exists case_taking_sessions_access on public.case_taking_sessions;
create policy case_taking_sessions_read on public.case_taking_sessions
  for select using (public.can_access_case_care_profile(case_id));
create policy case_taking_sessions_write on public.case_taking_sessions
  for insert with check (
    public.can_access_case_care_profile(case_id) and public.has_clinical_case_role(case_id));
create policy case_taking_sessions_update on public.case_taking_sessions
  for update using (
    public.can_access_case_care_profile(case_id) and public.has_clinical_case_role(case_id))
  with check (
    public.can_access_case_care_profile(case_id) and public.has_clinical_case_role(case_id));
create policy case_taking_sessions_delete on public.case_taking_sessions
  for delete using (
    public.can_access_case_care_profile(case_id) and public.has_clinical_case_role(case_id));

drop policy if exists case_taking_answers_access on public.case_taking_answers;
create policy case_taking_answers_read on public.case_taking_answers
  for select using (exists (
    select 1 from public.case_taking_sessions s
     where s.id = case_taking_answers.session_id
       and public.can_access_case_care_profile(s.case_id)));
create policy case_taking_answers_write on public.case_taking_answers
  for insert with check (exists (
    select 1 from public.case_taking_sessions s
     where s.id = case_taking_answers.session_id
       and public.can_access_case_care_profile(s.case_id)
       and public.has_clinical_case_role(s.case_id)));
create policy case_taking_answers_update on public.case_taking_answers
  for update using (exists (
    select 1 from public.case_taking_sessions s
     where s.id = case_taking_answers.session_id
       and public.can_access_case_care_profile(s.case_id)
       and public.has_clinical_case_role(s.case_id)))
  with check (exists (
    select 1 from public.case_taking_sessions s
     where s.id = case_taking_answers.session_id
       and public.can_access_case_care_profile(s.case_id)
       and public.has_clinical_case_role(s.case_id)));
create policy case_taking_answers_delete on public.case_taking_answers
  for delete using (exists (
    select 1 from public.case_taking_sessions s
     where s.id = case_taking_answers.session_id
       and public.can_access_case_care_profile(s.case_id)
       and public.has_clinical_case_role(s.case_id)));

-- ─── 6. A COACH DOES NOT VERIFY CLINICAL INFORMATION ────────────────────────
-- case_contributions.supervisor_verified_by is a clinical act recorded on a
-- contribution. block_contribution_rewrite() protects eight other columns but
-- not this one, so without a guard a contributor could mark their own or
-- another's contribution clinically verified.

create or replace function public.block_non_clinical_verification()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_actor uuid := auth.uid();
begin
  if new.supervisor_verified_by is null
     or new.supervisor_verified_by is not distinct from old.supervisor_verified_by then
    return new;
  end if;
  if v_actor is null then
    return new;
  end if;
  if not public.has_clinical_case_role(new.case_id) then
    raise exception 'contribution: a non-clinical contributor cannot verify clinical information'
      using errcode = 'insufficient_privilege';
  end if;
  return new;
end $$;

drop trigger if exists trg_block_non_clinical_verification on public.case_contributions;
create trigger trg_block_non_clinical_verification
  before update on public.case_contributions
  for each row execute function public.block_non_clinical_verification();

comment on function public.block_non_clinical_verification() is
  'A contributor may record a contribution but may not mark one clinically verified. The eight columns block_contribution_rewrite() freezes do not include supervisor_verified_by, so this closes that gap for the non-clinical role.';
