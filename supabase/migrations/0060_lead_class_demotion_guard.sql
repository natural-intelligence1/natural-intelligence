-- ─────────────────────────────────────────────────────────────────────────────
-- 0060 — Close the last path to an invalid "Category 3 + active Lead" state
-- ─────────────────────────────────────────────────────────────────────────────
--
--   ███  PREPARED. NOT APPLIED UNTIL THE DIFF AND TESTS ARE CLEAN.  ███
--
-- Live catalogue read 2026-10-11. Newest applied migration is
-- 20261010062725 = 0059_protocol_signing, so 0060 is the correct next number.
--
-- ── WHAT ALREADY WORKS — AND IS NOT REBUILT HERE ────────────────────────────
--
-- The Category 3 Lead rule is ALREADY enforced in the database. 0057 created
-- enforce_case_team_role_rules(), fired by trg_case_team_role_rules BEFORE
-- INSERT OR UPDATE on case_team_roles, which:
--
--   · refuses any role for a practitioner who fails
--     practitioner_assignment_eligibility() (so an unset class is refused —
--     'practitioner_class_not_set' — before the category test is reached);
--   · refuses team_role = 'lead' when practitioners.category = 'unregistered',
--     with the message "an NI Verified Practitioner (Category 3) cannot be the
--     sole Lead Responsible Practitioner";
--   · refuses a student without a named supervisor holding an active
--     non-student role on the same case;
--   · allows ended_at IS NOT NULL through, because ending a role is always
--     permitted.
--
-- Student/trainee Lead needs no separate backstop: 'student' and 'lead' are
-- mutually exclusive values of the same case_team_roles.team_role column
-- (CHECK team_role IN ('lead','care_team','student')), so a student row can
-- never also be a lead row. The rule is structural, not advisory.
--
-- Uniqueness of the Lead is likewise already enforced, by the partial index
-- uniq_active_lead_per_case ON case_team_roles (case_id) WHERE team_role =
-- 'lead' AND ended_at IS NULL.
--
-- ── THE ONE REMAINING HOLE ───────────────────────────────────────────────────
--
-- trg_case_team_role_rules fires on case_team_roles only. It therefore
-- validates the class AT THE MOMENT THE ROLE IS WRITTEN and never again.
-- practitioners.category can be changed afterwards, and none of the three
-- existing triggers on practitioners (profile completeness, updated_at,
-- sync_is_active) re-validates case roles. So this sequence reaches the
-- forbidden state with no error:
--
--   1. a Category 1 practitioner is assigned team_role = 'lead'   -> allowed
--   2. an admin later sets practitioners.category = 'unregistered' -> allowed
--   3. the case now has a Category 3 practitioner as its active Lead
--
-- ── THE SMALLEST CORRECTION ──────────────────────────────────────────────────
--
-- One BEFORE UPDATE trigger on practitioners that refuses a demotion to
-- 'unregistered' while that practitioner holds an active Lead role. It reuses
-- the existing class truth (practitioners.category) and the existing role
-- truth (case_team_roles); no second practitioner-class system is introduced.
--
-- REFUSING is deliberate. The alternative — silently ending the Lead role —
-- would remove clinical responsibility from a live case as a side effect of an
-- admin edit. Refusing makes the operator deal with the case explicitly: end
-- or reassign the Lead first, then change the class.
--
-- Additive only: no column, constraint, index, policy or row is changed, and
-- no existing function is replaced.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- PRE-APPLY VERIFICATION
-- ═════════════════════════════════════════════════════════════════════════════
--   select tgname from pg_trigger
--    where tgrelid='public.practitioners'::regclass and not tgisinternal;
--   -- EXPECTED: practitioner_completeness_trigger, practitioners_updated_at,
--   --           sync_is_active  (and NOT trg_practitioner_class_vs_lead_role)
--
--   select count(*) from public.case_team_roles
--    where team_role='lead' and ended_at is null;
--   -- Rows this guard will begin protecting.
--
--   -- Any already-invalid rows? Should be zero; if not, resolve them first,
--   -- because this migration does not retrospectively fix existing data.
--   select r.id, r.case_id, p.category
--     from public.case_team_roles r join public.practitioners p
--       on p.id = r.practitioner_id
--    where r.team_role='lead' and r.ended_at is null and p.category='unregistered';
-- ═════════════════════════════════════════════════════════════════════════════


create or replace function public.enforce_practitioner_class_vs_lead_role()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cases text;
begin
  -- Only act when the class actually changes to the Category 3 value.
  if new.category is not distinct from old.category then
    return new;
  end if;
  if new.category is distinct from 'unregistered' then
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
end $$;

drop trigger if exists trg_practitioner_class_vs_lead_role on public.practitioners;
create trigger trg_practitioner_class_vs_lead_role
  before update on public.practitioners
  for each row execute function public.enforce_practitioner_class_vs_lead_role();

comment on function public.enforce_practitioner_class_vs_lead_role() is
  'Companion to enforce_case_team_role_rules(). That trigger validates class when a case role is written; this one validates active case roles when the class is written. Together they make "Category 3 + active Lead" unreachable from either direction.';


-- ═════════════════════════════════════════════════════════════════════════════
-- POST-APPLY VERIFICATION — synthetic rows only; clean up afterwards.
-- ═════════════════════════════════════════════════════════════════════════════
--
-- 1. Demotion while holding an active Lead is refused:
--      update practitioners set category='unregistered' where id='<active lead>';
--      -- EXPECTED: check_violation naming the case id
--
-- 2. Demotion is allowed once the Lead role has ended:
--      update case_team_roles set ended_at=now() where practitioner_id='<id>' and team_role='lead';
--      update practitioners set category='unregistered' where id='<id>';
--      -- EXPECTED: success
--
-- 3. Demotion is allowed for a care_team member (not a Lead):
--      -- EXPECTED: success
--
-- 4. Unrelated practitioner updates are unaffected:
--      update practitioners set display_name='x' where id='<any>';
--      -- EXPECTED: success (trigger returns early when category is unchanged)
--
-- 5. The forward direction still works (0057, unchanged):
--      insert a 'lead' role for an 'unregistered' practitioner
--      -- EXPECTED: check_violation from enforce_case_team_role_rules
--
-- 6. ROLLBACK, safe because the migration is purely additive:
--      drop trigger if exists trg_practitioner_class_vs_lead_role on public.practitioners;
--      drop function if exists public.enforce_practitioner_class_vs_lead_role();
-- ═════════════════════════════════════════════════════════════════════════════
