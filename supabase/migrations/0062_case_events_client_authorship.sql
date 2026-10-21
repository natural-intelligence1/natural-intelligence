-- ─── 0062_case_events_client_authorship.sql ─────────────────────────────────
--
-- NOT YET APPLIED at the time of writing. Do not trust this line — ask the
-- database (see README rule 2).
--
-- WHY 0062 AND NOT 0061
--
-- `0061_protocol_version_items.sql` already exists, unapplied, on the branch
-- `feat/protocol-adoption-signing`. It is absent from this branch's
-- supabase/migrations folder, so `ls` here would wrongly suggest 0061 is free.
-- Taking 0061 would give two different migrations the same identifier, one of
-- which touches protocol signing. 0061 stays reserved for that file; this is
-- 0062. The two are independent and may be applied in either order.
--
-- WHAT THIS DOES
--
-- `case_events` is already the canonical home for dated case history. It
-- already keys on client_cases(id), already carries a type and a timestamp,
-- and already lets the client and the care team READ. Three things stop a
-- client recording their own update, and this migration addresses exactly
-- those three and nothing else:
--
--   A. No client INSERT authority.      -> case_events_client_insert
--   B. No first-class actor attribution. -> actor_user_id, actor_capacity
--   C. No structural append-only guard.  -> trg_block_case_event_rewrite
--
-- FULLY ADDITIVE. Every new column is nullable with no default, every new
-- CHECK passes for a NULL capacity, and the existing service-role writer
-- (complete_practitioner_work) keeps working untouched. The five existing
-- rows need no backfill: the application reader derives role from event_type
-- and falls back to created_at where occurred_at is absent.
--
-- IDENTITY. profiles.id references auth.users(id), and so does
-- practitioners.id — one person has one id across both. So `actor_user_id
-- references profiles(id)` is enough for a client, a practitioner or an admin
-- alike, and `actor_user_id = auth.uid()` is enforceable for all of them.
-- This is the same relationship audit_logs.actor_id already uses.

begin;

-- ── B. Actor attribution ───────────────────────────────────────────────────
--
-- `actor_user_id`, not `author_id`: this records the authenticated HUMAN
-- responsible for creating the event, which is not always the clinical
-- author of its content.
--
-- Nullable, because a system/NI event has no human actor — and because the
-- five existing rows have none recorded. The coherence CHECK below makes the
-- null cases explicit rather than accidental.
--
-- ON DELETE SET NULL, not CASCADE: erasing a person must not silently delete
-- a case's clinical history. The event survives, unattributed.
alter table public.case_events
  add column actor_user_id uuid references public.profiles(id) on delete set null;

-- The capacity the actor was acting in. Deliberately NOT reusing
-- audit_logs.actor_role: that column is free text, nullable, unconstrained
-- and has never held a row, so it is a naming precedent and not a trustworthy
-- vocabulary. This one is constrained.
alter table public.case_events
  add column actor_capacity text;

alter table public.case_events
  add constraint case_events_actor_capacity_check
  check (actor_capacity in ('client', 'practitioner', 'admin_support', 'system'));

-- A system/NI event has no human actor, permanently.
--
-- The converse — that a HUMAN capacity must name its actor — is deliberately
-- NOT a table CHECK. A CHECK is an invariant that must hold forever, and this
-- one would not survive erasure: ON DELETE SET NULL above nulls the actor of a
-- practitioner's or client's past events when that person is erased, and a
-- CHECK requiring an actor would then refuse the erasure. Attribution is a
-- rule about CREATING an event, so it is enforced at insert time by
-- enforce_case_event_authorship() below.
--
-- A NULL capacity is permitted throughout: the five existing rows have none,
-- and neither does the existing service-role writer. Capacity cannot become
-- NOT NULL until every writer sets it.
alter table public.case_events
  add constraint case_events_system_has_no_actor
  check (actor_capacity is distinct from 'system' or actor_user_id is null);

-- When the thing HAPPENED, as distinct from when it was submitted to NI
-- (created_at). A client reporting on Tuesday something that happened on
-- Sunday must have it dated Sunday, or the practitioner reads the sequence
-- wrongly. Carried in event_payload until now, where nothing could constrain
-- it; the client INSERT policy requires it and bounds it.
alter table public.case_events
  add column occurred_at timestamptz;

comment on column public.case_events.actor_user_id is
  'The authenticated human who created this event. NULL for system/NI events, and for '
  'rows predating 0062. Not necessarily the clinical author of the content.';
comment on column public.case_events.actor_capacity is
  'The capacity the actor was acting in. NULL only for rows predating 0062 and for '
  'existing service-role writers that do not set it.';
comment on column public.case_events.occurred_at is
  'When the event happened, which for a client report is client-stated. Distinct from '
  'created_at, which is when NI received it. NULL where not recorded.';

-- ── A. Client INSERT authority ─────────────────────────────────────────────
--
-- The narrowest policy that makes the flow work. A client may add ONE kind of
-- event, to their OWN case, attributed to THEMSELVES.
--
-- Restricting event_type here is what stops a client forging a
-- practitioner_note, a practitioner_decision, a protocol_update or a system
-- event. Requiring actor_user_id = auth.uid() is what stops them claiming
-- another actor's identity — the check is made by the database against the
-- JWT, never against a form payload.
--
-- Case ownership resolves through client_cases.client_id, the same
-- relationship the existing case_events_member_select policy reads, so a
-- client can only ever write to a case they can already see.
--
-- This does NOT grant UPDATE or DELETE. Those are blocked structurally below.
--
-- No GRANT is needed: `authenticated` already holds INSERT on case_events in
-- production (checked in the live catalogue, not assumed), so RLS is the only
-- gate and this policy is the whole of it. `anon` holds the same grant and is
-- still refused, because actor_user_id = auth.uid() is false when auth.uid()
-- is null.
create policy case_events_client_insert on public.case_events
  for insert to authenticated
  with check (
    event_type = 'follow_up_answer'
    and actor_capacity = 'client'
    and actor_user_id = auth.uid()
    and occurred_at is not null
    and occurred_at <= now()
    and exists (
      select 1 from public.client_cases cc
      where cc.id = public.case_events.case_id
        and cc.client_id = auth.uid()
    )
  );

-- Two write-time rules that a table CHECK cannot express.
create or replace function public.enforce_case_event_authorship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 1. An event created in a human capacity must name the human. Enforced here
  --    rather than as a CHECK so that erasing that person later — which nulls
  --    the attribution through the foreign key — is not refused by the same
  --    rule. See case_events_system_has_no_actor above.
  if new.actor_capacity in ('client', 'practitioner', 'admin_support')
     and new.actor_user_id is null then
    raise exception
      'a case event created in the % capacity must name its actor', new.actor_capacity
      using errcode = 'check_violation';
  end if;

  -- 2. created_at is NI's record of receipt and is not the client's to set.
  --    Without this a client could backdate a submission and place their own
  --    report before a review that had already happened. occurred_at remains
  --    theirs to state — that is the point of it — and the policy bounds it.
  if new.actor_capacity = 'client' then
    new.created_at := now();
  end if;

  return new;
end;
$$;

create trigger trg_enforce_case_event_authorship
  before insert on public.case_events
  for each row execute function public.enforce_case_event_authorship();

-- ── C. Structural append-only ──────────────────────────────────────────────
--
-- case_events is longitudinal clinical history. A correction is a NEW event;
-- nothing is ever rewritten. Following the case_contributions precedent, but
-- stricter: block_contribution_rewrite guards named columns on UPDATE and
-- leaves DELETE to the absence of a policy. Absence of a policy is not a
-- guarantee — it is one `create policy` away from being gone.
--
-- This fires for EVERY role, service_role included. That is deliberate: the
-- instruction is no ambient runtime bypass. Exceptional backfill or
-- maintenance must disable this trigger inside an explicit, reviewed one-off
-- migration, which leaves a record. A permanent escape hatch would not.
create or replace function public.block_case_event_rewrite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    -- ONE exception, and it is not a loophole: the actor_user_id foreign key
    -- above is ON DELETE SET NULL, and a foreign key enforces that by issuing
    -- an ordinary UPDATE. Without this branch, an unconditional block would
    -- make the guard refuse its own referential action and erasing a person
    -- would fail outright.
    --
    -- Permitted only when the ONLY difference is actor_user_id going from
    -- something to null. Every other column must be identical, so this cannot
    -- be used to alter what an event says — the most it can do is remove the
    -- attribution, which is precisely what erasing the person means.
    if old.actor_user_id is not null
       and new.actor_user_id is null
       and new.case_id       is not distinct from old.case_id
       and new.event_type    is not distinct from old.event_type
       and new.source_table  is not distinct from old.source_table
       and new.source_id     is not distinct from old.source_id
       and new.event_payload is not distinct from old.event_payload
       and new.created_at    is not distinct from old.created_at
       and new.occurred_at   is not distinct from old.occurred_at
       and new.actor_capacity is not distinct from old.actor_capacity
    then
      return new;
    end if;

    raise exception
      'case_events is append-only: record a new event instead of rewriting one'
      using errcode = 'check_violation';
  end if;

  -- DELETE. Erasing a whole case legitimately removes its events through the
  -- ON DELETE CASCADE on case_id — a right-to-erasure request must not be
  -- blocked by this guard. By the time a cascade reaches here the parent row
  -- is already gone, which is exactly what separates it from someone deleting
  -- a single event to tidy away history.
  --
  -- SECURITY DEFINER so this existence check is authoritative. Were it to run
  -- as the caller, RLS could hide the parent case and make a forbidden delete
  -- look like a cascade.
  if exists (select 1 from public.client_cases cc where cc.id = old.case_id) then
    raise exception
      'case_events is append-only: an event cannot be deleted while its case exists'
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

create trigger trg_block_case_event_rewrite
  before update or delete on public.case_events
  for each row execute function public.block_case_event_rewrite();

commit;

-- ── NOT DONE HERE, AND WHY ─────────────────────────────────────────────────
--
-- · actor_capacity is not NOT NULL. It cannot be until complete_practitioner_work
--   and any other writer sets it. Tightening it is a later migration, after a
--   backfill, and is not needed for this flow.
--
-- · No index added. The reader filters on case_id, which is already indexed by
--   the foreign key; ordering happens in the application over one case's rows.
--   Revisit when a case accumulates enough events to matter.
--
-- · case_events_practitioner_select is NOT touched. It authorises practitioners
--   through case_practitioner_work, while the wired care-team flow reads
--   case_team_roles, so a practitioner on the care team is not guaranteed to be
--   able to read that case's events. That mismatch is real and is reported
--   separately — broadening a read policy is not something to slip into a
--   migration about client authorship.
