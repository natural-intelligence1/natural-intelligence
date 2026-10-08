-- ─────────────────────────────────────────────────────────────────────────────
-- 0059 — Protocol signing/versioning + DailyPath item linkage
-- ─────────────────────────────────────────────────────────────────────────────
--
--   ███  PREPARED. NOT APPLIED. DO NOT RUN WITHOUT KR AUTHORISATION.  ███
--
-- Written during the overnight Connected Care build under an explicit
-- instruction to prepare this migration and NOT apply it. It has never been
-- executed against any database, shared or local.
--
-- It is also UNVERIFIED against the live catalogue: the Supabase MCP
-- connection dropped during the session, so the column lists below were
-- derived from packages/db/src/types.ts (generated from the live database)
-- rather than read back from pg_catalog at authoring time. Run the
-- PRE-APPLY VERIFICATION block first and reconcile any difference before
-- considering this file authorised.
--
-- Note on numbering: 0058 is taken by 0058_agreements_public_and_prospectus
-- (applied 2026-10-03, version 20261003015129), whose file lives on branch
-- sprint/agreements-prospectus and is not present here. This is 0059.
--
-- ── WHY ──────────────────────────────────────────────────────────────────────
--
-- Two concrete, separately-evidenced defects:
--
-- 1. DAILYPATH IS BROKEN IN PRODUCTION. The live daily_adherence table has no
--    item_id column and no (member_id, protocol_id, item_id, log_date)
--    constraint, but the application depends on both:
--      · apps/web/app/dashboard/dailypath/page.tsx:46,75  select 'item_id'
--      · apps/web/app/dashboard/dailypath/page.tsx:95     reads a.item_id
--      · apps/web/app/dashboard/dailypath/page.tsx:71     upsert onConflict
--        'member_id,protocol_id,item_id,log_date'
--      · apps/web/app/dashboard/dailypath/actions.ts:255  same onConflict
--    supabase/migrations/0029_sprint11_dailypath_schema.sql DOES declare
--    item_id, but that file is a retrospective record of tables created by
--    hand in the dashboard and its own header says so — the live table
--    diverged. The generated types are the authoritative record here.
--
-- 2. A PROTOCOL CANNOT BE SIGNED. member_protocols has no version, signature,
--    author or history columns, so there is no such thing as a signed,
--    immutable, attributable protocol version — and today the CLIENT creates
--    their own protocol by choosing a template. assigned_by exists but is
--    never written. Until this lands, the Screen C contract
--    (/route-map/preview/signed-protocol) is a demonstration only.
--
-- ── WHAT THIS DOES NOT DO ────────────────────────────────────────────────────
--
-- Additive only. No column is dropped, no type narrowed, no row rewritten.
-- Every new column is nullable or defaulted so existing rows stay valid.
-- It changes no RLS policy, grants nothing to anon, enables no feature flag
-- and backfills no clinical content. It does not make practitioners able to
-- author protocols — that needs the application layer and a policy change,
-- deliberately left out of this file.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- PRE-APPLY VERIFICATION — run this FIRST, on its own, and read the output.
-- Apply nothing if the actual column set differs from the comments above.
-- ═════════════════════════════════════════════════════════════════════════════
--
--   select table_name, column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name in ('daily_adherence','member_protocols','protocol_items')
--    order by table_name, ordinal_position;
--
--   select conname, pg_get_constraintdef(oid)
--     from pg_constraint
--    where conrelid in ('public.daily_adherence'::regclass,
--                       'public.member_protocols'::regclass);
--
--   -- How many adherence rows exist that could not be linked to an item?
--   select count(*) as unlinkable_rows from public.daily_adherence;
--
-- ═════════════════════════════════════════════════════════════════════════════


begin;

-- ── §1. DailyPath item linkage ───────────────────────────────────────────────
-- NULLABLE on purpose. Existing production rows were written without an item
-- reference and there is no honest way to infer which protocol_item each one
-- meant: item_name is free text and templates have been edited since. Those
-- rows keep their denormalised item_name/item_type/dose/timing and simply have
-- no link. Backfilling by name match would fabricate a provenance that does
-- not exist, so this migration refuses to do it.

alter table public.daily_adherence
  add column if not exists item_id uuid references public.protocol_items(id);

-- PARTIAL unique index: enforces one row per item per day going forward
-- WITHOUT invalidating the legacy rows where item_id is null.
create unique index if not exists daily_adherence_member_protocol_item_date_key
  on public.daily_adherence (member_id, protocol_id, item_id, log_date)
  where item_id is not null;

create index if not exists daily_adherence_item_idx
  on public.daily_adherence (item_id)
  where item_id is not null;

-- NOTE FOR THE APPLIER: the application's upsert uses
--   onConflict: 'member_id,protocol_id,item_id,log_date'
-- PostgREST resolves that against a unique index on exactly those columns. A
-- PARTIAL index may not satisfy the inference — verify the upsert path works
-- after applying, and if it does not, the choice is an unconditional unique
-- index (which requires deciding what to do with the legacy null rows) or an
-- application change. Do not discover this in production.


-- ── §2. Protocol versioning and signature ────────────────────────────────────
-- A signed version is immutable; a revision is a NEW row that supersedes the
-- previous one. Nothing is ever edited in place.
--
-- protocol_state is a NEW column ALONGSIDE the existing `status`, not a
-- replacement for it. They are different axes and conflating them would lose
-- information: `status` is the care lifecycle (active | paused | archived) and
-- an active protocol can be a draft; protocol_state is the signature state
-- (draft | signed | superseded) and a signed protocol can be archived.
-- Reusing `status` would also have meant rewriting live rows, which this
-- migration does not do.

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
  if not exists (
    select 1 from pg_constraint where conname = 'member_protocols_state_check'
  ) then
    alter table public.member_protocols
      add constraint member_protocols_state_check
      check (protocol_state in ('draft','signed','superseded'));
  end if;

  -- A signed protocol must say who signed it and when. A draft must not.
  if not exists (
    select 1 from pg_constraint where conname = 'member_protocols_signature_complete'
  ) then
    alter table public.member_protocols
      add constraint member_protocols_signature_complete
      check (
        (protocol_state = 'draft'  and signed_by is null and signed_at is null)
        or
        (protocol_state in ('signed','superseded')
         and signed_by is not null and signed_at is not null)
      );
  end if;
end $$;

-- Existing rows default to 'draft' with no signature, which is accurate:
-- nothing in the live table was ever signed by a practitioner.

create index if not exists member_protocols_case_state_idx
  on public.member_protocols (case_id, protocol_state);


-- ── §3. Signed versions are immutable, enforced in the database ──────────────
-- The UI not showing an edit control is a convention. This is the guarantee.

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

  -- The ONLY permitted change to a signed row is being superseded, or being
  -- marked superseded. Everything clinical is frozen.
  if new.name            is distinct from old.name
     or new.template_id  is distinct from old.template_id
     or new.member_id    is distinct from old.member_id
     or new.case_id      is distinct from old.case_id
     or new.version      is distinct from old.version
     or new.signed_by    is distinct from old.signed_by
     or new.signed_at    is distinct from old.signed_at
     or new.started_at   is distinct from old.started_at
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

-- Deleting a signed protocol would destroy the clinical record.
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


-- ── §4. A DailyPath action carries its author and version ────────────────────
-- So the client can always see who set this, and a check-in can be traced to
-- the exact signed version it came from. Nullable: legacy rows have no signed
-- source, and that absence is itself accurate.

alter table public.daily_adherence
  add column if not exists source_protocol_version int,
  add column if not exists source_signed_by        uuid references public.profiles(id);

comment on column public.daily_adherence.item_id is
  'Links an adherence row to the protocol item it came from. Null on rows written before 0059 — not inferable, deliberately not backfilled.';
comment on column public.daily_adherence.source_protocol_version is
  'The signed protocol version this action came from. Null where there was no signed source.';
comment on column public.member_protocols.protocol_state is
  'draft | signed | superseded. Signed rows are immutable (trg_signed_protocol_immutability).';
comment on column public.member_protocols.supersedes is
  'The earlier version this one replaces. Revision creates a new row; the old row is never edited.';


commit;


-- ═════════════════════════════════════════════════════════════════════════════
-- POST-APPLY VERIFICATION
-- ═════════════════════════════════════════════════════════════════════════════
--
-- 1. A signed protocol cannot be edited:
--      insert into member_protocols (member_id, name, started_at, protocol_state,
--                                    signed_by, signed_at, version)
--      values ('<synthetic-uuid>', 'T', current_date, 'signed',
--              '<synthetic-uuid>', now(), 1) returning id;
--      update member_protocols set name = 'changed' where id = '<that id>';
--      -- EXPECTED: check_violation, 'cannot be edited in place'
--
-- 2. A signed protocol cannot be deleted:
--      delete from member_protocols where id = '<that id>';
--      -- EXPECTED: check_violation, 'supersede it instead'
--
-- 3. A draft still edits freely:
--      update member_protocols set name = 'fine' where protocol_state = 'draft';
--      -- EXPECTED: success
--
-- 4. A signature cannot be half-recorded:
--      insert into member_protocols (member_id, name, started_at, protocol_state)
--      values ('<synthetic-uuid>', 'T', current_date, 'signed');
--      -- EXPECTED: member_protocols_signature_complete violation
--
-- 5. The DailyPath upsert path actually works (see the NOTE in §1):
--      exercise apps/web/app/dashboard/dailypath against a synthetic member
--      and confirm no 'there is no unique or exclusion constraint matching the
--      ON CONFLICT specification' error.
--
-- 6. Clean up every synthetic row created by the checks above.
-- ═════════════════════════════════════════════════════════════════════════════
