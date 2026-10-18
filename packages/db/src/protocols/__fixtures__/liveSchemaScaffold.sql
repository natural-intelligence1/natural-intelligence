-- Minimal stand-ins for the live NI schema that migration 0061 depends on.
-- Only the structures the triggers actually read are reproduced. Supabase
-- specifics (auth.uid, the eligibility function) are stubbed so the plpgsql
-- under test is the real thing.

create schema if not exists auth;

-- auth.uid() stubbed over a GUC so a test can "become" a practitioner, or
-- become nobody (the service-role / no-JWT case).
create or replace function auth.uid() returns uuid language plpgsql stable as $$
begin
  return nullif(current_setting('test.auth_uid', true), '')::uuid;
exception when others then return null;
end $$;

create table profiles (
  id uuid primary key default gen_random_uuid(),
  role text not null default 'member'
);

create table practitioners (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'regulated_clinician'
);

create table client_cases (id uuid primary key default gen_random_uuid());

create table case_team_roles (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references client_cases(id),
  practitioner_id uuid not null references practitioners(id),
  team_role text not null,
  ended_at timestamptz
);

-- Eligibility stubbed over a GUC: the real function is proven elsewhere; what
-- 0061 needs is that a false verdict blocks signing.
create or replace function practitioner_assignment_eligibility(p_id uuid)
returns table (eligible boolean) language plpgsql stable as $$
begin
  return query select coalesce(nullif(current_setting('test.eligible', true), ''), 'true')::boolean;
end $$;

create table protocol_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_published boolean not null default true
);

create table protocol_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references protocol_templates(id) on delete cascade,
  name text not null,
  item_type text not null,
  dose text, timing text, duration_weeks integer, notes text,
  display_order integer default 0,
  created_at timestamptz default now()
);

create table member_protocols (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles(id),
  template_id uuid references protocol_templates(id),
  name text not null,
  status text not null default 'active',
  started_at date not null default current_date,
  ends_at date,
  assigned_by uuid references profiles(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  version integer not null default 1,
  signed_at timestamptz,
  signed_by uuid references practitioners(id),
  supersedes uuid references member_protocols(id),
  case_id uuid references client_cases(id),
  constraint member_protocols_signature_complete check ((signed_at is null) = (signed_by is null))
);
create unique index member_protocols_supersedes_key on member_protocols (supersedes) where supersedes is not null;

create table daily_adherence (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references profiles(id),
  protocol_id uuid not null references member_protocols(id) on delete cascade,
  item_name text not null,
  item_type text,
  dose text, timing text,
  log_date date not null default current_date,
  completed boolean default false,
  completed_at timestamptz,
  skipped boolean default false,
  skip_reason text,
  notes text,
  created_at timestamptz default now(),
  unique (member_id, protocol_id, item_name, log_date)
);

-- ── 0059's live triggers, copied verbatim from the production catalogue ─────

create or replace function enforce_signed_protocol_immutability()
returns trigger language plpgsql security definer as $$
begin
  if old.signed_at is null then return new; end if;
  if new.name is distinct from old.name
     or new.template_id is distinct from old.template_id
     or new.member_id is distinct from old.member_id
     or new.case_id is distinct from old.case_id
     or new.version is distinct from old.version
     or new.signed_by is distinct from old.signed_by
     or new.signed_at is distinct from old.signed_at
     or new.started_at is distinct from old.started_at
     or new.ends_at is distinct from old.ends_at
     or new.notes is distinct from old.notes
     or new.supersedes is distinct from old.supersedes
  then
    raise exception 'Protocol % is signed (v%). A signed version cannot be edited in place — create a revision instead.',
      old.id, old.version using errcode = 'check_violation';
  end if;
  return new;
end $$;

create or replace function forbid_signed_protocol_delete()
returns trigger language plpgsql security definer as $$
begin
  if old.signed_at is not null then
    raise exception 'Signed protocol % cannot be deleted; supersede it instead.', old.id
      using errcode = 'check_violation';
  end if;
  return old;
end $$;

-- 0059 also creates the signature-authority function; 0061 replaces its body.
-- Declared here only so the trigger can be attached, exactly as production has it.
create or replace function enforce_protocol_signature_authority()
returns trigger language plpgsql security definer as $$
begin return new; end $$;

create trigger trg_signed_protocol_immutability before update on member_protocols
  for each row execute function enforce_signed_protocol_immutability();
create trigger trg_forbid_signed_protocol_delete before delete on member_protocols
  for each row execute function forbid_signed_protocol_delete();
create trigger trg_protocol_signature_authority before insert or update on member_protocols
  for each row execute function enforce_protocol_signature_authority();
