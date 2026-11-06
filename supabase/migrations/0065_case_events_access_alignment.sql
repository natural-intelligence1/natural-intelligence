-- ─── 0065_case_events_access_alignment.sql ──────────────────────────────────
--
-- NOT YET APPLIED at the time of writing. Do not trust this line — ask the
-- database (see README rule 2).
--
-- WHY 0065
--
-- Re-inventory of every migration-bearing branch, local and remote,
-- 3 Nov 2026: 0061 and 0062 reserved and unapplied, 0063 applied and closed,
-- 0064 built and unapplied. Nothing numbered 0065 or higher exists anywhere.
--
-- WHAT THIS DOES
--
-- Retires the last place where a work item alone granted sight of a client's
-- case events.
--
-- case_events_practitioner_select currently reads:
--
--   EXISTS (case_practitioner_work cpw
--            WHERE cpw.case_id = case_events.case_id
--              AND cpw.practitioner_id = auth.uid()
--              AND cpw.status IN ('assigned','in_review','completed','escalated'))
--
-- That predates the care-team model. It asks only "were you ever given work
-- on this case", and never asks whether you hold a role on the team, whether
-- you are eligible for the role you hold, or whether the client consented to
-- YOU specifically. 0064 made eligibility real and role-aware, which makes
-- this gap sharper rather than softer: a student who satisfies the student
-- evidence bar can pass the role-neutral work-item gate while this policy
-- never checks their supervisor or the client's consent.
--
-- The replacement delegates to the canonical authority that already encodes
-- the whole chain:
--
--   can_access_case_care_profile(case_id)
--     = active client-practitioner link
--     + active case_team_roles row on THIS case
--     + practitioner_eligibility(auth.uid(), that role).eligible   [0064]
--     + has_practitioner_access_consent(client, auth.uid())
--     + for a student role: a named supervisor holding an active
--       non-student role on the same case
--
-- Calling it is deliberate reuse, not convenience. Restating the chain inside
-- the policy would mean two copies of a security rule that must never drift,
-- and it would duplicate credential, indemnity, scope, agreement, DBS and
-- category logic that belongs only in the eligibility function.
--
-- ── WHY THIS IS SAFE TO CALL FROM A POLICY ──────────────────────────────────
--
-- Audited before adopting, not assumed:
--   · SECURITY DEFINER, STABLE, search_path pinned to 'public'
--   · it does NOT read case_events, so there is no recursion
--   · none of the tables it DOES read (client_cases, client_practitioner_links,
--     case_team_roles, consent_records, practitioners and the evidence tables)
--     carries an RLS policy that references case_events, so there is no
--     indirect recursion either
--   · being SECURITY DEFINER it reads those tables as the owner, bypassing
--     their RLS, so no policy-on-policy loop can form
--   · it returns FALSE when auth.uid() IS NULL, so an unauthenticated or
--     service-role session gains nothing from it
--
-- ── A DELIBERATE TIGHTENING, STATED PLAINLY ─────────────────────────────────
--
-- The canonical function additionally requires an ACTIVE CLIENT-PRACTITIONER
-- LINK, which the old policy did not. That is stricter, not looser, and it is
-- the correct chain — but it means a practitioner holding only a case-team
-- role and no link loses case_events read. There are currently 0 rows in
-- client_practitioner_links, so in practice this denies rather than grants.
-- Denial is the acceptable direction; a grant would not be.
--
-- ── WHAT IS NOT CHANGED ─────────────────────────────────────────────────────
--
-- case_events_member_select (the client reading their own case) and
-- case_events_service_all are untouched. Client access is not part of this
-- repair and must not be collateral damage of it.

begin;

-- ── 1. Refuse to apply without 0064 ─────────────────────────────────────────
--
-- This policy is only as strong as the eligibility function behind it. If
-- 0064 has not been applied, can_access_case_care_profile is still the
-- pre-0064 role-NEUTRAL version, and installing this policy would quietly
-- grant read on "eligible for any role" rather than "eligible for the role
-- actually held". Fail loudly instead.

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'practitioner_eligibility'
  ) then
    raise exception
      '0065 requires 0064: public.practitioner_eligibility(uuid, text) does not exist. Apply 0064_practitioner_eligibility_spine first.'
      using errcode = 'check_violation';
  end if;

  -- And prove the canonical access function is the ROLE-AWARE one, not the
  -- pre-0064 body that called the role-neutral wrapper.
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'can_access_case_care_profile'
       and p.prosrc ~ 'practitioner_eligibility'
  ) then
    raise exception
      '0065 requires the role-aware can_access_case_care_profile from 0064; the live body still uses the role-neutral wrapper.'
      using errcode = 'check_violation';
  end if;
end $$;

-- ── 2. Replace the practitioner read authority ──────────────────────────────

drop policy if exists case_events_practitioner_select on public.case_events;

create policy case_events_practitioner_select on public.case_events
  for select
  to authenticated
  using (public.can_access_case_care_profile(case_events.case_id));

comment on policy case_events_practitioner_select on public.case_events is
  'Practitioner read authority for case events. Delegates entirely to can_access_case_care_profile(case_id), which requires an active client-practitioner link, an active case-team role on this case, role-aware eligibility for the role actually held, practitioner-specific client consent, and for a student role a named supervisor holding an active non-student role on the same case. A work item alone grants nothing. Do not restate the chain here: credential, indemnity, scope, agreement, DBS and category logic live only in practitioner_eligibility.';

commit;

-- ── NOT DONE HERE, AND WHY ──────────────────────────────────────────────────
--
-- · case_practitioner_work is NOT dropped and its own policies are untouched.
--   Work items remain the inbox's organising record; they simply no longer
--   confer sight of the client's case events by themselves.
--
-- · No client_id is denormalised onto case_events. The client is derived
--   through case_events.case_id -> client_cases.id -> client_cases.client_id
--   inside the canonical function, which already holds that join. Adding a
--   second copy of the relationship for a policy's convenience would create a
--   drift risk for no gain.
--
-- · The client and service-role policies are unchanged, deliberately.
--
-- · Supervisor validity is not reimplemented here. It is case-specific and
--   already enforced inside can_access_case_care_profile and by
--   enforce_case_team_role_rules on write.
