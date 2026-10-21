-- Stand-ins for the live NI structures that migration 0062 depends on.
--
-- Only what the policies and triggers under test actually read is reproduced.
-- case_events itself is copied from the production catalogue verbatim —
-- columns, CHECK, foreign key and all three existing policies — because the
-- migration adds to it and the test must prove the addition composes with
-- what is already there.
--
-- Supabase specifics (auth.uid, auth.role) are stubbed over GUCs so a test
-- can act as a particular signed-in person, or as the service role.
--
-- RLS IS REAL HERE. The tables are owned by the PGlite superuser, who would
-- bypass RLS, so every test that exercises a policy does `set role
-- authenticated` first — a plain role that owns nothing. That is what makes
-- the forgery tests meaningful rather than decorative.

create schema if not exists auth;

create or replace function auth.uid() returns uuid language plpgsql stable as $$
begin
  return nullif(current_setting('test.auth_uid', true), '')::uuid;
exception when others then return null;
end $$;

create or replace function auth.role() returns text language plpgsql stable as $$
begin
  return coalesce(nullif(current_setting('test.auth_role', true), ''), 'authenticated');
end $$;

create table profiles (
  id   uuid primary key default gen_random_uuid(),
  role text not null default 'member'
);

create table practitioners (
  id       uuid primary key default gen_random_uuid(),
  category text not null default 'regulated_clinician'
);

create table client_cases (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table case_practitioner_work (
  id              uuid primary key default gen_random_uuid(),
  case_id         uuid not null references client_cases(id) on delete cascade,
  practitioner_id uuid not null references practitioners(id) on delete cascade,
  status          text not null default 'assigned'
);

-- Copied from the live catalogue.
create table case_events (
  id            uuid primary key default gen_random_uuid(),
  case_id       uuid not null references client_cases(id) on delete cascade,
  event_type    text not null,
  source_table  text,
  source_id     uuid,
  event_payload jsonb not null,
  created_at    timestamptz not null default now(),
  constraint case_events_event_type_check check (
    event_type = any (array[
      'intake_answer', 'follow_up_answer', 'lab_upload', 'gp_record_upload',
      'grocery_receipt', 'practitioner_note', 'practitioner_decision', 'protocol_update'
    ])
  )
);

alter table case_events enable row level security;

-- The three policies that already exist in production, verbatim in effect.
create policy case_events_service_all on case_events
  for all using (auth.role() = 'service_role');

create policy case_events_member_select on case_events
  for select using (
    exists (select 1 from client_cases cc
            where cc.id = case_events.case_id and cc.client_id = auth.uid())
  );

create policy case_events_practitioner_select on case_events
  for select using (
    exists (select 1 from case_practitioner_work cpw
            where cpw.case_id = case_events.case_id
              and cpw.practitioner_id = auth.uid()
              and cpw.status = any (array['assigned','in_review','completed','escalated']))
  );

-- RLS only bites for a role that does not own the tables.
create role authenticated;
grant usage on schema public, auth to authenticated;
grant select, insert, update, delete on
  case_events, client_cases, profiles, practitioners, case_practitioner_work
  to authenticated;
