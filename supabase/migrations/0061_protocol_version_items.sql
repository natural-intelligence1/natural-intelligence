-- ─── 0061_protocol_version_items.sql ────────────────────────────────────────
-- Makes the signed Protocol version the authoritative clinical record.
--
-- THE PROBLEM THIS FIXES
--
-- Until now a member's Protocol content was not owned by the member's
-- Protocol. protocol_items.template_id is NOT NULL and references
-- protocol_templates, so both read paths (DailyPath and the Protocol detail
-- page) resolved a client's items with
--     select * from protocol_items where template_id = <the shared template>
-- Three consequences, each of which this migration removes:
--
--   1. A practitioner could not edit one client's Protocol. Changing a dose
--      would have edited the shared template and silently rewritten every
--      other client on it.
--   2. Signing could not freeze the clinical content. 0059's immutability
--      trigger guards member_protocols' own columns; it cannot guard content
--      that lives in another, trigger-free table.
--   3. DailyPath had no lineage to an originating Protocol action — only a
--      free-text item_name.
--
-- AFTER THIS MIGRATION
--
--   protocol_templates / protocol_items  = reusable DRAFTING SOURCE only.
--   protocol_version_items               = the clinical record, per Protocol
--                                          version, frozen when that version
--                                          is signed.
--
-- A template may be edited or deleted freely afterwards: source_template_item_id
-- is ON DELETE SET NULL, so historical signed content is never altered or
-- invalidated by template churn.
--
-- Applies to: nothing live. member_protocols has 0 rows, so there is no
-- backfill and no client data to migrate.
--
-- NOT in this migration, deliberately: Systems Under Stress / Care Queue.
-- That schema does not exist yet and belongs to the Treatment Plan slice.
-- Nothing here forecloses it.

-- ── 1. The per-version clinical record ──────────────────────────────────────

create table if not exists public.protocol_version_items (
  id          uuid primary key default gen_random_uuid(),
  protocol_id uuid not null references public.member_protocols(id) on delete cascade,

  -- Clinically substantive content. These mirror the fields NI actually uses
  -- on protocol_items today, plus the two the practitioner needs in order to
  -- own the work: what the client is told to do (instructions) and why
  -- (rationale / therapeutic aim). No field is added here that the current
  -- model does not need.
  name           text    not null,
  item_type      text    not null,
  dose           text,            -- amount, where applicable
  timing         text,            -- when / how often
  duration_weeks integer,
  instructions   text,            -- client-facing: how to carry it out
  rationale      text,            -- practitioner-facing: why, and the aim it serves
  display_order  integer not null default 0,
  is_active      boolean not null default true,  -- retained vs removed by the practitioner

  -- Provenance. Records how the draft reached the practitioner. It never
  -- couples signed content back to a mutable template: the reference is
  -- optional and SET NULL on delete, so losing a template cannot change what
  -- a signed Protocol says.
  source_template_item_id uuid references public.protocol_items(id) on delete set null,
  drafted_source text not null default 'practitioner',
  drafted_by     uuid references public.profiles(id),
  last_edited_by uuid references public.profiles(id),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint protocol_version_items_item_type_check
    check (item_type in ('supplement','lifestyle','nutrition','test','practitioner')),
  constraint protocol_version_items_drafted_source_check
    check (drafted_source in ('ni_tooling','ai_assisted','student','practitioner','template')),
  constraint protocol_version_items_duration_check
    check (duration_weeks is null or duration_weeks > 0),
  constraint protocol_version_items_name_not_blank
    check (length(btrim(name)) > 0)
);

create index if not exists protocol_version_items_protocol_order_idx
  on public.protocol_version_items (protocol_id, display_order);

comment on table public.protocol_version_items is
  'The clinical content of one Protocol version. Authoritative for a signed Protocol; protocol_items/protocol_templates are drafting source only. Frozen by trigger once the parent member_protocols row is signed.';

-- ── 2. Signed items are immutable, enforced in the database ─────────────────
-- UI disablement is not a control. Once the parent Protocol carries a
-- signature, its items cannot be inserted, updated or deleted by anyone —
-- including service-role code. Revision copies the items forward into a new
-- unsigned version; the signed predecessor is never touched.

create or replace function public.enforce_signed_protocol_items_immutability()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_protocol_id uuid;
  v_signed_at   timestamptz;
  v_version     integer;
begin
  -- Re-parenting an item would move clinical content between versions.
  if tg_op = 'UPDATE' and new.protocol_id is distinct from old.protocol_id then
    raise exception
      'protocol items: an item cannot be moved between Protocol versions'
      using errcode = 'check_violation';
  end if;

  v_protocol_id := case when tg_op = 'DELETE' then old.protocol_id else new.protocol_id end;

  select mp.signed_at, mp.version
    into v_signed_at, v_version
    from public.member_protocols mp
   where mp.id = v_protocol_id;

  -- One update is permitted against a signed version: the database's own
  -- ON DELETE SET NULL on source_template_item_id when a drafting template
  -- item is deleted. Without this the FK action would be blocked by the
  -- freeze below, and a template item could never be deleted again once any
  -- signed Protocol referenced it. Nulling a provenance pointer does not
  -- change a single word of what the Protocol says, so the clinical record
  -- is still untouched — every other column must be identical.
  if tg_op = 'UPDATE' and v_signed_at is not null
     and old.source_template_item_id is not null
     and new.source_template_item_id is null
     and new.name           is not distinct from old.name
     and new.item_type      is not distinct from old.item_type
     and new.dose           is not distinct from old.dose
     and new.timing         is not distinct from old.timing
     and new.duration_weeks is not distinct from old.duration_weeks
     and new.instructions   is not distinct from old.instructions
     and new.rationale      is not distinct from old.rationale
     and new.display_order  is not distinct from old.display_order
     and new.is_active      is not distinct from old.is_active
     and new.drafted_source is not distinct from old.drafted_source
     and new.drafted_by     is not distinct from old.drafted_by
     and new.last_edited_by is not distinct from old.last_edited_by
  then
    return new;  -- deliberately without touching updated_at: not a practitioner edit
  end if;

  if v_signed_at is not null then
    raise exception
      'Protocol % is signed (v%). Its items are the signed clinical record and cannot be changed (%) — revise the Protocol to create a new draft version instead.',
      v_protocol_id, v_version, lower(tg_op)
      using errcode = 'check_violation';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_signed_protocol_items_immutability on public.protocol_version_items;
create trigger trg_signed_protocol_items_immutability
  before insert or update or delete on public.protocol_version_items
  for each row execute function public.enforce_signed_protocol_items_immutability();

comment on function public.enforce_signed_protocol_items_immutability() is
  'Companion to enforce_signed_protocol_immutability(). That one freezes the Protocol header at signature; this one freezes its clinical items, which is where the content actually lives.';

-- ── 3. Row level security ───────────────────────────────────────────────────
-- Deliberately NOT mirroring member_protocols, which grants members ALL on
-- their own row. A client must never author clinical content, and must never
-- see an unsigned draft as their plan: an unsigned draft has no clinical
-- status. Writes are server-side only, exactly as signing already is.

alter table public.protocol_version_items enable row level security;

-- Clients: read only, and only once the version carries a signature.
create policy "Members read items of their own signed protocols"
  on public.protocol_version_items for select to authenticated
  using (exists (
    select 1 from public.member_protocols mp
     where mp.id = protocol_version_items.protocol_id
       and mp.member_id = auth.uid()
       and mp.signed_at is not null
  ));

-- Practitioners: read drafts and signed versions for cases they are on.
create policy "Practitioners read items for their case protocols"
  on public.protocol_version_items for select to authenticated
  using (exists (
    select 1 from public.member_protocols mp
     where mp.id = protocol_version_items.protocol_id
       and (
         mp.assigned_by = auth.uid()
         or exists (
           select 1 from public.case_team_roles r
            where r.case_id = mp.case_id
              and r.practitioner_id = auth.uid()
              and r.ended_at is null
         )
       )
  ));

create policy "Admins manage protocol version items"
  on public.protocol_version_items for all to authenticated
  using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- ── 4. DailyPath lineage ────────────────────────────────────────────────────
-- Nullable and additive. The live uniqueness key
-- (member_id, protocol_id, item_name, log_date) and all existing behaviour are
-- untouched; item_name stays for compatibility. New signed-Protocol-driven
-- actions carry an exact reference to the originating version item.

alter table public.daily_adherence
  add column if not exists protocol_version_item_id uuid
    references public.protocol_version_items(id) on delete set null;

create index if not exists daily_adherence_version_item_idx
  on public.daily_adherence (protocol_version_item_id)
  where protocol_version_item_id is not null;

comment on column public.daily_adherence.protocol_version_item_id is
  'Exact originating item of the signed Protocol version this action derives from. Nullable: pre-existing rows and template-era actions have none.';

-- ── 5. Close the service-role signing bypass ────────────────────────────────
-- Unchanged from 0059 except the auth.uid() IS NULL branch.
--
-- 0059 returned early when there was no JWT, so any service-role or
-- server-side context could write signed_at/signed_by without passing the
-- self-attribution, Lead and eligibility checks — an invisible everyday route
-- to a signature in a practitioner's name. A clinical signature now requires
-- an authenticated practitioner session, with no exceptions and no runtime
-- escape hatch: no-JWT, service-role, admin and automated contexts all fail
-- closed.
--
-- There is deliberately no session setting, GUC or flag that relaxes this. If
-- an exceptional database repair is ever genuinely required it will be done
-- through its own reviewed maintenance migration, visible in the migration
-- history, rather than through a mechanism that sits permanently in the
-- schema waiting to be used.
--
-- Drafts are unaffected: service and admin processes may still create and
-- manage unsigned Protocol versions where otherwise authorised. It is only
-- the clinical signature that is reserved to the practitioner.

create or replace function public.enforce_protocol_signature_authority()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_eligible boolean;
begin
  if new.signed_at is null
     or (tg_op = 'UPDATE' and new.signed_at is not distinct from old.signed_at
                          and new.signed_by is not distinct from old.signed_by) then
    return new;
  end if;

  if auth.uid() is null then
    raise exception 'protocol signing: a clinical signature requires an authenticated practitioner session. Service-role, admin and automated contexts cannot sign on a practitioner''s behalf.'
      using errcode = 'insufficient_privilege';
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

comment on function public.enforce_protocol_signature_authority() is
  'Signature authority for member_protocols. Requires an authenticated practitioner who is themselves the signer, the active Lead on the case, and currently eligible. A null auth.uid() is always refused: there is no runtime override.';
