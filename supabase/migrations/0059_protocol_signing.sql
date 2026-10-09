-- ─────────────────────────────────────────────────────────────────────────────
-- 0059 — Protocol signing and versioning
-- ─────────────────────────────────────────────────────────────────────────────
--
--   ███  PREPARED. NOT APPLIED. DO NOT RUN WITHOUT KR AUTHORISATION.  ███
--
-- Has never been executed against any database.
--
-- ── VERIFICATION STATUS: live catalogue READ, 2026-10-09 ─────────────────────
-- Every column, constraint, index and policy referenced below was read from
-- pg_catalog / pg_policies on project yftxzvdrxnhwpcnsrktn. The overnight
-- draft's warning ("unverified, derived from generated types") no longer
-- applies to this file.
--
-- Numbering confirmed against the live applied list: the newest applied
-- migration is 20261003015129 = 0058_agreements_public_and_prospectus, whose
-- FILE lives on sprint/agreements-prospectus, not here. No 0059 is applied and
-- no other branch claims 0059, so 0059 is the correct identifier.
-- Separately: 0055_functional_ranges_source_metadata.sql exists as a file and
-- is NOT applied — a real gap in the sequence, untouched by this migration.
--
-- ── WHAT CHANGED SINCE THE OVERNIGHT DRAFT ───────────────────────────────────
--
-- The overnight file was 0059_protocol_signing_and_dailypath_items.sql and its
-- §1 added `daily_adherence.item_id` plus a partial unique index.
--
-- THAT SECTION IS REMOVED. Reading the live catalogue showed it solved the
-- problem the wrong way round. Live `daily_adherence` already has a working
-- discriminator with a unique constraint on it:
--
--     UNIQUE (member_id, protocol_id, item_name, log_date)
--
-- and the insert path at apps/web/app/dashboard/dailypath/page.tsx:60-68
-- already writes `item_name` / `item_type`. The DailyPath defect is therefore
-- an APPLICATION bug — three places name a column that never existed — not a
-- missing schema feature:
--
--   · page.tsx:46,75  select 'id, item_id, item_name, …'  → item_id unknown
--   · page.tsx:71     onConflict 'member_id,protocol_id,item_id,log_date'
--   · page.tsx:90,95  itemMeta keyed by protocol_items.id, read with a.item_id
--                     → always undefined, so dose / timing / notes / order
--                       silently fall back to defaults
--   · actions.ts:255  same onConflict as page.tsx:71
--
-- The fix is to use `item_name`, which the live constraint and the insert path
-- already agree on: no migration, no backfill, no data impact. It is a change
-- to apps/web and is deliberately NOT bundled into the Connected Care release
-- — see the integration report.
--
-- ── WHY A MIGRATION IS UNAVOIDABLE FOR THE REST ──────────────────────────────
--
-- Protocol signing has no existing column that could carry it. Live
-- `member_protocols` is exactly: id, member_id, template_id, name, status,
-- started_at, ends_at, assigned_by, rootfinder_session_id, notes, created_at,
-- updated_at. No version, no signature, no author of a signature, no
-- supersession link — so a signed, immutable, attributable protocol version
-- does not exist as a concept. `assigned_by` exists and is never written.
-- Today a CLIENT creates their own protocol by choosing a template, and
-- apps/care contains no protocol code at all.
--
-- Until this is applied, /route-map/preview/signed-protocol demonstrates an
-- intended contract, and the page says so on its face.
--
-- ── WHAT THIS DOES NOT DO ────────────────────────────────────────────────────
--
-- Additive only. No column dropped, no type narrowed, no row rewritten or
-- deleted. Every new column is nullable or defaulted so existing rows stay
-- valid. It changes no RLS policy, grants nothing to anon, enables no feature
-- flag, backfills no clinical content, and does not make practitioners able to
-- author protocols — that needs an application layer and a policy change, both
-- deliberately out of scope.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- PRE-APPLY VERIFICATION — run on its own and read the output first.
-- Re-run even though the catalogue was read on 2026-10-09; it may have moved.
-- ═════════════════════════════════════════════════════════════════════════════
--
--   select column_name, data_type, is_nullable, column_default
--     from information_schema.columns
--    where table_schema='public' and table_name='member_protocols'
--    order by ordinal_position;
--   -- EXPECTED: 12 columns, none of them version / protocol_state / signed_by
--   --           / signed_at / supersedes / superseded_by / case_id.
--
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid='public.member_protocols'::regclass;
--   -- EXPECTED: pkey, member_id fkey, template_id fkey, assigned_by fkey,
--   --           member_protocols_status_check (active|paused|completed|archived).
--
--   select count(*) from public.member_protocols;  -- rows that default to 'draft'
--
-- ═════════════════════════════════════════════════════════════════════════════


begin;

-- ── §1. Versioning and signature columns ─────────────────────────────────────
--
-- protocol_state is a NEW column ALONGSIDE the existing `status`, not a
-- replacement. They are different axes and conflating them would lose
-- information: live `status` is the care lifecycle, constrained to
-- (active | paused | completed | archived), and an active protocol can still
-- be an unsigned draft; protocol_state is the signature state, and a signed
-- protocol can be archived. Reusing `status` would also mean rewriting live
-- rows and widening a CHECK constraint that existing code reads.

alter table public.member_protocols
  add column if not exists version        int  not null default 1,
  add column if not exists protocol_state text not null default 'draft',
  add column if not exists signed_by      uuid references public.profiles(id),
  add column if not exists signed_at      timestamptz,
  add column if not exists supersedes     uuid references public.member_protocols(id),
  add column if not exists superseded_by  uuid references public.member_protocols(id),
  -- Sprint 6 put clinical responsibility at CASE level, not client level.
  add column if not exists case_id        uuid references public.client_cases(id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'member_protocols_state_check') then
    alter table public.member_protocols
      add constraint member_protocols_state_check
      check (protocol_state in ('draft','signed','superseded'));
  end if;

  -- A signed protocol must say who signed it and when. A draft must not.
  if not exists (select 1 from pg_constraint where conname = 'member_protocols_signature_complete') then
    alter table public.member_protocols
      add constraint member_protocols_signature_complete
      check (
        (protocol_state = 'draft' and signed_by is null and signed_at is null)
        or
        (protocol_state in ('signed','superseded') and signed_by is not null and signed_at is not null)
      );
  end if;
end $$;

-- Existing rows default to 'draft' with no signature, which is accurate:
-- nothing in the live table was ever signed by a practitioner.

create index if not exists member_protocols_case_state_idx
  on public.member_protocols (case_id, protocol_state);


-- ── §2. Signed versions are immutable, enforced in the database ──────────────
-- The UI not showing an edit control is a convention. This is the guarantee.
-- The column list below matches the live table exactly as read on 2026-10-09;
-- `paused_at` from migration 0029 does NOT exist live and is not referenced.

create or replace function public.enforce_signed_protocol_immutability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.protocol_state = 'draft' then
    return new;                         -- drafts are freely editable
  end if;

  -- The only permitted change to a signed row is being superseded. Everything
  -- clinical is frozen.
  if new.name            is distinct from old.name
     or new.template_id  is distinct from old.template_id
     or new.member_id    is distinct from old.member_id
     or new.case_id      is distinct from old.case_id
     or new.version      is distinct from old.version
     or new.signed_by    is distinct from old.signed_by
     or new.signed_at    is distinct from old.signed_at
     or new.started_at   is distinct from old.started_at
     or new.ends_at      is distinct from old.ends_at
     or new.notes        is distinct from old.notes
     or new.supersedes   is distinct from old.supersedes
  then
    raise exception
      'Protocol % is signed (v%). A signed version cannot be edited in place — create a revision instead.',
      old.id, old.version
      using errcode = 'check_violation';
  end if;

  if new.protocol_state not in ('signed','superseded') then
    raise exception 'A signed protocol cannot return to %', new.protocol_state
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_signed_protocol_immutability on public.member_protocols;
create trigger trg_signed_protocol_immutability
  before update on public.member_protocols
  for each row execute function public.enforce_signed_protocol_immutability();

-- Deleting a signed protocol would destroy the clinical record. Note the live
-- FK daily_adherence_protocol_id_fkey is ON DELETE CASCADE, so without this
-- trigger deleting a protocol silently removes its adherence history too.
create or replace function public.forbid_signed_protocol_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.protocol_state in ('signed','superseded') then
    raise exception 'Signed protocol % cannot be deleted; supersede it instead.', old.id
      using errcode = 'check_violation';
  end if;
  return old;
end $$;

drop trigger if exists trg_forbid_signed_protocol_delete on public.member_protocols;
create trigger trg_forbid_signed_protocol_delete
  before delete on public.member_protocols
  for each row execute function public.forbid_signed_protocol_delete();


-- ── §3. A DailyPath action carries its author and version ────────────────────
-- So a client can always see who set this, and a check-in can be traced to the
-- signed version it came from. Nullable: legacy rows have no signed source and
-- that absence is accurate. Additive columns ONLY — this does not change the
-- existing (member_id, protocol_id, item_name, log_date) key.

alter table public.daily_adherence
  add column if not exists source_protocol_version int,
  add column if not exists source_signed_by        uuid references public.profiles(id);

comment on column public.daily_adherence.source_protocol_version is
  'The signed protocol version this action came from. Null where there was no signed source.';
comment on column public.member_protocols.protocol_state is
  'draft | signed | superseded. Signed rows are immutable (trg_signed_protocol_immutability). Distinct from `status`, which is the care lifecycle.';
comment on column public.member_protocols.supersedes is
  'The earlier version this one replaces. Revision creates a new row; the old row is never edited.';


commit;


-- ═════════════════════════════════════════════════════════════════════════════
-- POST-APPLY VERIFICATION — synthetic rows only, and clean them up afterwards.
-- ═════════════════════════════════════════════════════════════════════════════
--
-- 1. A signed protocol cannot be edited in place:
--      update member_protocols set name='changed' where id='<signed synthetic id>';
--      -- EXPECTED: check_violation, 'cannot be edited in place'
--
-- 2. A signed protocol cannot be deleted:
--      delete from member_protocols where id='<signed synthetic id>';
--      -- EXPECTED: check_violation, 'supersede it instead'
--
-- 3. A draft still edits freely:
--      update member_protocols set name='fine' where protocol_state='draft';
--      -- EXPECTED: success
--
-- 4. A signature cannot be half-recorded:
--      insert into member_protocols (member_id,name,started_at,protocol_state)
--      values ('<synthetic>','T',current_date,'signed');
--      -- EXPECTED: member_protocols_signature_complete violation
--
-- 5. Existing rows were not disturbed:
--      select protocol_state, count(*) from member_protocols group by 1;
--      -- EXPECTED: every pre-existing row 'draft', signed_by / signed_at null
--
-- 6. ROLLBACK, if needed. Safe because every object here is additive:
--      drop trigger if exists trg_signed_protocol_immutability on public.member_protocols;
--      drop trigger if exists trg_forbid_signed_protocol_delete on public.member_protocols;
--      drop function if exists public.enforce_signed_protocol_immutability();
--      drop function if exists public.forbid_signed_protocol_delete();
--      alter table public.member_protocols
--        drop constraint if exists member_protocols_signature_complete,
--        drop constraint if exists member_protocols_state_check;
--      drop index if exists member_protocols_case_state_idx;
--      alter table public.member_protocols
--        drop column if exists version,       drop column if exists protocol_state,
--        drop column if exists signed_by,     drop column if exists signed_at,
--        drop column if exists supersedes,    drop column if exists superseded_by,
--        drop column if exists case_id;
--      alter table public.daily_adherence
--        drop column if exists source_protocol_version,
--        drop column if exists source_signed_by;
--    No pre-existing column or row is touched by this rollback.
-- ═════════════════════════════════════════════════════════════════════════════
