-- ─────────────────────────────────────────────────────────────────────────────
-- 0059 — Protocol signing and versioning
-- ─────────────────────────────────────────────────────────────────────────────
--
--   ███  PREPARED. NOT APPLIED. DO NOT RUN WITHOUT KR AUTHORISATION.  ███
--
-- Never executed against any database. Live catalogue read 2026-10-09.
--
-- Numbering: newest applied is 20261003015129 = 0058_agreements_public_and_
-- prospectus (file on sprint/agreements-prospectus). No 0059 applied, none
-- claimed on any other branch. 0059 is correct.
-- (Separately: 0055_functional_ranges_source_metadata.sql is a file that was
-- never applied — a real gap, untouched here.)
--
-- ─────────────────────────────────────────────────────────────────────────────
-- REUSE ANALYSIS — what already exists, and what this adds
-- ─────────────────────────────────────────────────────────────────────────────
--
-- The first draft of this migration added 9 things. Reviewing it against the
-- live database removed 4 of them and corrected 2. NI already has more of this
-- machinery than the draft assumed, and a second care-plan architecture is
-- explicitly not being built.
--
-- ALREADY EXISTS — reused, not duplicated:
--
--   care_plan_coordination (0057)   case_id, lead_id, reviewed_at,
--                                   released_at, released_by
--     The Lead's REVIEW AND RELEASE record for a case. Kept as-is. This
--     migration does NOT add a second release mechanism; the protocol's
--     signature is the artefact signature, and care_plan_coordination remains
--     the case-level Lead release record. They are complementary.
--
--   release_care_plan(p_case_id)    Already enforces the complete Lead gate:
--                                   active Lead on the case, Lead still passes
--                                   practitioner_assignment_eligibility(), an
--                                   authored case_analysis_plan exists, and a
--                                   Lead coordination review was recorded.
--     §3 below MIRRORS this gate rather than re-implementing the rules.
--
--   case_team_roles (0057)          team_role lead|care_team|student,
--                                   uniq_active_lead_per_case,
--                                   case_team_student_requires_supervisor
--     The single source of truth for Lead / student / Category 3 restrictions.
--     This migration does not restate any of those rules.
--
--   practitioner_agreements         version + is_current
--   practitioner_review_packs       pack_version
--     Row-per-version with an integer version is the established NI pattern,
--     so protocol versioning follows it rather than inventing another.
--
-- REMOVED FROM THE DRAFT after this analysis:
--
--   · protocol_state (draft|signed|superseded) + its CHECK — DERIVABLE.
--       signed_at IS NULL                       → draft
--       signed_at IS NOT NULL, nothing supersedes it → current signed version
--       signed_at IS NOT NULL, something supersedes it → superseded
--     A stored state column can drift from the facts that define it.
--
--   · superseded_by — REDUNDANT. It is the reverse of `supersedes`, and two
--     columns describing one edge can disagree. With unique(supersedes) the
--     chain is linear, so the reverse is a lookup.
--
--   · daily_adherence.source_protocol_version
--   · daily_adherence.source_signed_by
--     Nothing writes these yet. They belong with the feature that populates
--     them, not here. (They are also NOT needed by the DailyPath defect fix,
--     which is an application change requiring no migration at all.)
--
-- CORRECTED IN THE DRAFT:
--
--   · signed_by now references practitioners(id), NOT profiles(id). Live
--     care_plan_coordination.released_by and case_team_roles.practitioner_id
--     both use practitioners(id). profiles(id) would have allowed a
--     non-practitioner to be recorded as the signatory.
--
--   · §3 is NEW and is a BLOCKER FIX. member_protocols carries
--     "Members manage own protocols" ALL USING (member_id = auth.uid())
--     WITH CHECK (member_id = auth.uid()). Without §3, adding signature
--     columns to this table would let a CLIENT SIGN THEIR OWN PROTOCOL.
--     The draft did not account for this.
--
-- NET: 5 added columns (was 7 + 2), 1 unique index, 1 CHECK, 3 triggers.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- PRE-APPLY VERIFICATION — run on its own and read the output first.
-- ═════════════════════════════════════════════════════════════════════════════
--
--   select column_name, data_type from information_schema.columns
--    where table_schema='public' and table_name='member_protocols'
--    order by ordinal_position;
--   -- EXPECTED 12 columns: id, member_id, template_id, name, status,
--   -- started_at, ends_at, assigned_by, rootfinder_session_id, notes,
--   -- created_at, updated_at. None of the seven added below.
--
--   select policyname, cmd, qual, with_check from pg_policies
--    where schemaname='public' and tablename='member_protocols';
--   -- EXPECTED the three live policies, including "Members manage own
--   -- protocols" ALL — the reason §3 exists.
--
--   select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
--    where n.nspname='public'
--      and proname in ('practitioner_assignment_eligibility','release_care_plan');
--   -- EXPECTED both present; §3 depends on the first.
--
--   select count(*) from public.member_protocols;  -- rows becoming v1 drafts
--
-- ═════════════════════════════════════════════════════════════════════════════


begin;

-- ── §1. Versioning and signature ─────────────────────────────────────────────
-- `status` is NOT reused: live it is the care lifecycle, constrained to
-- (active|paused|completed|archived), and an active protocol can still be an
-- unsigned draft. Reusing it would mean rewriting live rows and widening a
-- CHECK that existing code reads.

alter table public.member_protocols
  add column if not exists version    int not null default 1,
  add column if not exists signed_at  timestamptz,
  add column if not exists signed_by  uuid references public.practitioners(id),
  add column if not exists supersedes uuid references public.member_protocols(id),
  -- Sprint 6 put clinical responsibility at CASE level, not client level.
  add column if not exists case_id    uuid references public.client_cases(id);

do $$
begin
  -- A signature is both halves or neither. There is no half-signed protocol.
  if not exists (select 1 from pg_constraint where conname = 'member_protocols_signature_complete') then
    alter table public.member_protocols
      add constraint member_protocols_signature_complete
      check ((signed_at is null) = (signed_by is null));
  end if;
end $$;

-- One successor per version: the chain stays linear, so "the current version"
-- is the signed row that nothing supersedes. This is what replaces the
-- removed superseded_by column.
create unique index if not exists member_protocols_supersedes_key
  on public.member_protocols (supersedes) where supersedes is not null;

create index if not exists member_protocols_case_signed_idx
  on public.member_protocols (case_id, signed_at);

-- Every existing row becomes v1, unsigned, which is accurate: nothing in the
-- live table was ever signed by a practitioner.


-- ── §2. A signed version is immutable, and cannot be deleted ─────────────────
-- The UI omitting an edit button is a convention. This is the guarantee.
-- Column list matches the live table as read 2026-10-09; `paused_at` from
-- migration 0029 does not exist live and is not referenced.

create or replace function public.enforce_signed_protocol_immutability()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.signed_at is null then
    return new;                          -- drafts are freely editable
  end if;

  if new.name           is distinct from old.name
     or new.template_id is distinct from old.template_id
     or new.member_id   is distinct from old.member_id
     or new.case_id     is distinct from old.case_id
     or new.version     is distinct from old.version
     or new.signed_by   is distinct from old.signed_by
     or new.signed_at   is distinct from old.signed_at
     or new.started_at  is distinct from old.started_at
     or new.ends_at     is distinct from old.ends_at
     or new.notes       is distinct from old.notes
     or new.supersedes  is distinct from old.supersedes
  then
    raise exception
      'Protocol % is signed (v%). A signed version cannot be edited in place — create a revision instead.',
      old.id, old.version using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_signed_protocol_immutability on public.member_protocols;
create trigger trg_signed_protocol_immutability
  before update on public.member_protocols
  for each row execute function public.enforce_signed_protocol_immutability();

-- The live FK daily_adherence_protocol_id_fkey is ON DELETE CASCADE, so
-- deleting a protocol would also silently destroy its adherence history.
create or replace function public.forbid_signed_protocol_delete()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.signed_at is not null then
    raise exception 'Signed protocol % cannot be deleted; supersede it instead.', old.id
      using errcode = 'check_violation';
  end if;
  return old;
end $$;

drop trigger if exists trg_forbid_signed_protocol_delete on public.member_protocols;
create trigger trg_forbid_signed_protocol_delete
  before delete on public.member_protocols
  for each row execute function public.forbid_signed_protocol_delete();


-- ── §3. Only the active Lead may sign — BLOCKER FIX ──────────────────────────
--
-- Without this, "Members manage own protocols" (ALL, member_id = auth.uid())
-- would let a client set signed_at / signed_by on their own protocol.
--
-- The gate MIRRORS release_care_plan(p_case_id) rather than restating the
-- rules: active Lead on the case, and the Lead still passes
-- practitioner_assignment_eligibility() — which is where Category 3 and
-- credentialing restrictions already live (0056). Student restrictions are
-- already structural: case_team_roles.team_role = 'student' is never 'lead',
-- so a student can never satisfy the Lead check.
--
-- TRUST BOUNDARY, stated deliberately: when auth.uid() IS NULL the caller is
-- trusted server-side code using the service role (which is how this codebase
-- reaches the database — createAdminClient()). Those callers are not gated
-- here. Every END-USER session has auth.uid() set, so a client is always
-- gated. Server code that signs a protocol is responsible for applying the
-- same Lead rule, exactly as it already is for release_care_plan.

create or replace function public.enforce_protocol_signature_authority()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_eligible boolean;
begin
  -- Only act when a signature is being applied or changed.
  if new.signed_at is null
     or (tg_op = 'UPDATE' and new.signed_at is not distinct from old.signed_at
                          and new.signed_by is not distinct from old.signed_by) then
    return new;
  end if;

  if auth.uid() is null then
    return new;                          -- trusted service-role path
  end if;

  if new.signed_by is distinct from auth.uid() then
    raise exception 'protocol signing: a protocol may only be signed by the practitioner performing the action'
      using errcode = 'insufficient_privilege';
  end if;

  if new.case_id is null then
    raise exception 'protocol signing: protocol is not linked to a case, so no Lead can be established'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.case_team_roles
     where case_id = new.case_id and practitioner_id = auth.uid()
       and team_role = 'lead' and ended_at is null
  ) then
    raise exception 'protocol signing: caller is not the active Lead Responsible Practitioner for this case'
      using errcode = 'insufficient_privilege';
  end if;

  select e.eligible into v_eligible
    from public.practitioner_assignment_eligibility(auth.uid()) e;
  if v_eligible is not true then
    raise exception 'protocol signing: Lead no longer passes assignment eligibility'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end $$;

drop trigger if exists trg_protocol_signature_authority on public.member_protocols;
create trigger trg_protocol_signature_authority
  before insert or update on public.member_protocols
  for each row execute function public.enforce_protocol_signature_authority();


comment on column public.member_protocols.signed_at is
  'Null = draft. Set = signed and immutable (trg_signed_protocol_immutability). State is derived, not stored.';
comment on column public.member_protocols.signed_by is
  'practitioners(id) of the signatory. Only the active Lead may sign (trg_protocol_signature_authority).';
comment on column public.member_protocols.supersedes is
  'The earlier version this one replaces. Revision creates a new row; the old row is never edited. The reverse edge is a lookup — there is deliberately no superseded_by column.';
comment on column public.member_protocols.version is
  'Row-per-version, following practitioner_agreements. The current version is the signed row that nothing supersedes.';


commit;


-- ═════════════════════════════════════════════════════════════════════════════
-- POST-APPLY VERIFICATION — synthetic rows only; clean up afterwards.
-- ═════════════════════════════════════════════════════════════════════════════
--
-- 1. Current-version lookup works without a state column:
--      select p.* from member_protocols p
--       where p.member_id = '<synthetic>' and p.signed_at is not null
--         and not exists (select 1 from member_protocols s where s.supersedes = p.id);
--
-- 2. A client cannot sign their own protocol (sign in AS the member):
--      update member_protocols set signed_at = now(), signed_by = auth.uid()
--       where member_id = auth.uid();
--      -- EXPECTED: insufficient_privilege, 'not the active Lead'
--
-- 3. A half-signature is rejected:
--      update member_protocols set signed_at = now() where id = '<draft id>';
--      -- EXPECTED: member_protocols_signature_complete violation
--
-- 4. A signed protocol cannot be edited or deleted:
--      update member_protocols set name = 'changed' where id = '<signed id>';
--      delete from member_protocols where id = '<signed id>';
--      -- EXPECTED: check_violation on both
--
-- 5. A version can be superseded only once:
--      insert two rows with supersedes = '<same id>'
--      -- EXPECTED: member_protocols_supersedes_key violation
--
-- 6. Existing rows were not disturbed:
--      select version, count(*) from member_protocols
--       where signed_at is null group by version;
--      -- EXPECTED: every pre-existing row v1, unsigned
--
-- 7. ROLLBACK, safe because every object is additive:
--      drop trigger if exists trg_protocol_signature_authority on public.member_protocols;
--      drop trigger if exists trg_signed_protocol_immutability on public.member_protocols;
--      drop trigger if exists trg_forbid_signed_protocol_delete on public.member_protocols;
--      drop function if exists public.enforce_protocol_signature_authority();
--      drop function if exists public.enforce_signed_protocol_immutability();
--      drop function if exists public.forbid_signed_protocol_delete();
--      alter table public.member_protocols
--        drop constraint if exists member_protocols_signature_complete;
--      drop index if exists member_protocols_supersedes_key;
--      drop index if exists member_protocols_case_signed_idx;
--      alter table public.member_protocols
--        drop column if exists version,    drop column if exists signed_at,
--        drop column if exists signed_by,  drop column if exists supersedes,
--        drop column if exists case_id;
--    No pre-existing column or row is touched.
-- ═════════════════════════════════════════════════════════════════════════════
