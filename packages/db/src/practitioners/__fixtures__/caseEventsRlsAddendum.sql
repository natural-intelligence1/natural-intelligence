-- case_events and its PRE-0065 policies, loaded after eligibilityScaffold.sql.
--
-- Copied from the production catalogue: the table, and all three policies in
-- their current form — including the stale work-item practitioner rule that
-- 0065 replaces. 0065 is then executed against this, so the tests prove the
-- real migration rather than a paraphrase of it.
--
-- RLS IS REAL HERE. The tables are owned by the PGlite superuser, who would
-- bypass RLS, so every read test does `set role authenticated` first — a
-- plain role that owns nothing. That is what makes the denial tests mean
-- something rather than merely pass.

-- The authenticated role the read tests assume. Owns nothing, so RLS applies
-- to it. Created first: a policy cannot name a role that does not yet exist.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated;
  end if;
end $$;

create table case_events (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references client_cases(id) on delete cascade,
  event_type text not null,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table case_events enable row level security;

-- Clients read their own case's events. NOT touched by 0065.
create policy case_events_member_select on public.case_events
  for select
  using (exists (
    select 1 from public.client_cases cc
     where cc.id = case_events.case_id and cc.client_id = auth.uid()
  ));

-- Service role, full access. NOT touched by 0065.
create policy case_events_service_all on public.case_events
  for all
  using (auth.role() = 'service_role');

-- THE DEFECT 0065 REPAIRS: a work item alone, in any open-ish status, grants
-- sight of the client's case events. No team role, no eligibility, no consent.
create policy case_events_practitioner_select on public.case_events
  for select
  to authenticated
  using (exists (
    select 1 from public.case_practitioner_work cpw
     where cpw.case_id = case_events.case_id
       and cpw.practitioner_id = auth.uid()
       and cpw.status = any (array['assigned','in_review','completed','escalated'])
  ));

-- Supabase grants `authenticated` table privileges broadly and relies on RLS
-- to do the filtering. Mirrored here, otherwise a policy that sub-selects
-- another table (case_events_member_select reads client_cases) fails with a
-- permission error instead of exercising the policy. The evidence tables are
-- included deliberately: they have RLS enabled with service/admin-only
-- policies, so a grant proves RLS is what denies, not a missing privilege.
grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
